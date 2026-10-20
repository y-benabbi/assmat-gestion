"""Lecture des montants des bulletins de salaire (PDF) et totaux pour le tableau de bord.

Chaque bulletin rangé dans le dossier est lu une seule fois : les montants trouvés sont gardés
dans donnees\\revenus.json (clé : chemin + date de modification). Ce fichier contient des
données personnelles : il reste sur le poste, jamais dans le dépôt.

Le texte d'un bulletin Pajemploi est une suite de lignes « libellé … montant ». On cherche
chaque rubrique par son libellé (plusieurs formulations possibles) et on garde le dernier
montant de la ligne.
"""
import json
import re
import threading
from pathlib import Path

import bibliotheque
from chemins import DOSSIER_DONNEES

FICHIER_CACHE = DOSSIER_DONNEES / "revenus.json"
VERSION_LECTURE = 3       # à augmenter quand les règles changent : les bulletins sont relus

RE_MONTANT = re.compile(r"-?\d{1,3}(?:[ \u202f\xa0.]\d{3})*,\d{1,2}|-?\d+(?:[.,]\d{1,2})?")

# Rubrique -> libellés possibles (texte normalisé : minuscules, sans accents).
# L'ordre compte : le premier libellé trouvé l'emporte. Les libellés en tête de liste sont ceux
# des bulletins Pajemploi actuels (vérifiés sur de vrais bulletins, de 2016 à 2024).
RUBRIQUES = {
    "brut": [r"salaire brut", r"remuneration brute", r"total brut"],
    "cotisations": [r"montant total des cotisations", r"total (des )?cotisations( et contributions)? salariales",
                    r"cotisations salariales", r"total (des )?retenues"],
    "net": [r"salaire net declare(?! \(y compris)", r"salaire net\b(?! a payer)(?! imposable)(?! paye)",
            r"remuneration nette", r"net avant impot"],
    "net_a_payer": [r"net a payer", r"montant net (verse|paye)", r"salaire net paye"],
    "net_paye": [r"net paye en euros"],
    "net_imposable": [r"net imposable", r"montant net imposable", r"salaire imposable"],
    "impot": [r"^(montant (de l.)?)?impot sur le revenu", r"prelevement a la source"],
    "entretien": [r"indemnites? d.?entretien", r"frais d.?entretien"],
    "repas": [r"indemnites? de repas", r"frais de repas", r"indemnites? de nourriture"],
    "km": [r"indemnites? kilometriques?", r"frais kilometriques"],
    "rupture": [r"indemnites? de rupture"],
    "exoneration": [r"montant de l.?exoneration"],
    "heures": [r"nombre d.?heures normales", r"heures (normales|travaillees|d.?accueil)",
               r"nombre d.?heures(?! compl)"],
    "heures_comp": [r"nombre d.?heures complementaires"],
    "jours": [r"nombre de jours d.?(activite|accueil)", r"nombre de jours travailles", r"jours d.?(activite|accueil)"],
}

# Sur le bulletin, ces lignes portent d'autres nombres après le bon : « Nombre d'heures normales 201
# Salaire horaire net 4,00 », « Montant total des cotisations 353,07 (salarié) 700,10 (employeur) ».
# On y garde donc le premier nombre, et le dernier partout ailleurs.
PREMIER_NOMBRE = {"cotisations", "heures", "heures_comp", "jours"}

MODULE_ABSENT = "module de lecture des PDF absent"

_verrou = threading.Lock()


def nombre(texte: str):
    t = texte.replace(" ", "").replace("\xa0", "").replace(" ", "")
    if "," in t:
        t = t.replace(".", "").replace(",", ".")
    try:
        return float(t)
    except ValueError:
        return None


def lire_texte_pdf(chemin: str) -> str:
    import logging

    from pypdf import PdfReader

    logging.getLogger("pypdf").setLevel(logging.ERROR)
    lecteur = PdfReader(chemin)
    return "\n".join((p.extract_text() or "") for p in lecteur.pages)


def analyser_texte(texte: str) -> dict:
    """Montants trouvés dans le texte d'un bulletin : {rubrique: valeur}."""
    brutes = [l.strip() for l in texte.splitlines() if l.strip()]
    lignes = [bibliotheque.normaliser(l) for l in brutes]
    trouve = {}
    for rubrique, motifs in RUBRIQUES.items():
        for motif in motifs:
            for i, ligne in enumerate(lignes):
                m = re.search(motif, ligne)
                if not m:
                    continue
                reste = ligne[m.end():]
                montants = RE_MONTANT.findall(reste)
                if not montants and i + 1 < len(lignes):
                    if not re.search(r"[a-z]", lignes[i + 1]):
                        # Montant parfois renvoyé seul à la ligne suivante.
                        montants = RE_MONTANT.findall(lignes[i + 1])[:1]
                    elif brutes[i + 1][0].islower() or brutes[i + 1][0] in "(":
                        # Libellé coupé en deux lignes : « … de l'exonération » / « fiscale) 1294,93 ».
                        montants = RE_MONTANT.findall(lignes[i + 1])
                valeurs = [v for v in (nombre(x) for x in montants) if v is not None]
                if valeurs:
                    trouve[rubrique] = abs(valeurs[0] if rubrique in PREMIER_NOMBRE else valeurs[-1])
                    break
            if rubrique in trouve:
                break
    # Cohérence : si le net manque, on le déduit du brut et des cotisations.
    if "net" not in trouve and "brut" in trouve and "cotisations" in trouve:
        trouve["net"] = round(trouve["brut"] - trouve["cotisations"], 2)
    if "cotisations" not in trouve and "brut" in trouve and "net" in trouve:
        trouve["cotisations"] = round(trouve["brut"] - trouve["net"], 2)
    trouve["encaisse"] = encaisse(trouve)
    return trouve


CIVILITES = {"madame": "Mme", "monsieur": "M.", "mme": "Mme", "m.": "M.", "mr": "M."}


def lire_employeur(texte: str) -> str:
    """Nom du parent employeur : ligne qui suit « Référence employeur » (« MADAME CLAIRE DUPONT »),
    rendu « Mme Claire Dupont ». Le bloc précédent, au même format, est celui de l'assistante
    maternelle : on ne prend donc jamais le premier « MADAME » du texte."""
    lignes = [l.strip() for l in texte.splitlines() if l.strip()]
    for i, ligne in enumerate(lignes[:-1]):
        if re.fullmatch(r"r[ée]f[ée]rence employeur\s*:?", ligne, re.I):
            mots = lignes[i + 1].split()
            if not mots or re.search(r"\d", lignes[i + 1]):
                return ""
            civilite = CIVILITES.get(mots[0].lower())
            nom = " ".join(m.capitalize() if m.isupper() else m for m in (mots[1:] if civilite else mots))
            nom = re.sub(r"[-'](\w)", lambda x: x.group(0).upper(), nom)       # Jean-Pierre, D'Arc
            return f"{civilite} {nom}" if civilite else nom
    return ""


def _adresse(l: str) -> str:
    """« 12 RUE DES LILAS » → « 12 rue des Lilas »."""
    petits = {"rue", "avenue", "impasse", "allee", "allée", "chemin", "route", "place", "boulevard", "bd", "bat",
              "de", "des", "du", "la", "le", "les", "et", "en", "sur", "aux", "au", "residence", "résidence", "lieu", "dit"}
    return " ".join(m.lower() if m.lower() in petits else m.capitalize() for m in l.split())


def lire_bloc_employeur(texte: str) -> dict:
    """Bloc « Référence employeur » du bulletin : nom du parent (ligne suivante), adresse (lignes
    suivantes, la dernière commençant par le code postal) et « N°Employeur ». Champs absents : vides."""
    lignes = [l.strip() for l in texte.splitlines() if l.strip()]
    debut = next((i for i, l in enumerate(lignes) if re.fullmatch(r"r[ée]f[ée]rence employeur\s*:?", l, re.I)), None)
    if debut is None:
        return {}
    fiche = {}
    nom = lire_employeur(texte)
    if nom:
        mots = nom.split()
        fiche["civilite"] = mots.pop(0) if mots[0] in ("Mme", "M.") else ""
        fiche["prenom"], fiche["nom"] = (mots[0], " ".join(mots[1:])) if len(mots) > 1 else ("", " ".join(mots))
    adresse = []
    for l in lignes[debut + 2:debut + 8]:
        numero = re.match(r"n[°o]\s*employeur\s*:?\s*(\S+)", l, re.I)
        if numero:
            fiche["numero_pajemploi"] = numero.group(1)
            break
        ville = re.fullmatch(r"(\d{5})\s+(.+)", l)
        if ville:
            fiche["code_postal"], fiche["ville"] = ville.group(1), ville.group(2).title().replace(" Sur ", " sur ")
        elif not fiche.get("ville"):
            adresse.append(_adresse(l))
    if fiche.get("ville") and adresse:
        fiche["adresse"] = ", ".join(adresse)
    return fiche


def encaisse(m: dict) -> float:
    """Somme versée pour le mois : « Net payé en euros » du bulletin (un acompte éventuel y est compris).
    À défaut, on la reconstitue : net + indemnités + exonération des heures complémentaires - impôt."""
    if "net_paye" in m:
        return m["net_paye"]
    if "net_a_payer" in m:
        return round(m["net_a_payer"] - m.get("impot", 0.0), 2)
    return round(sum(m.get(r, 0.0) for r in ("net", "entretien", "repas", "km", "rupture", "exoneration"))
                 - m.get("impot", 0.0), 2)


TAUX_NET_DEFAUT = 0.78      # net ≈ 78 % du brut (cotisations salariales d'une assistante maternelle, environ)


def taux_net(lignes: list, nombre: int = 6) -> dict:
    """Part du brut qui reste en net, d'après les derniers bulletins lus (à défaut : estimation)."""
    lus = sorted((l for l in lignes if (l.get("montants") or {}).get("brut") and l["montants"].get("net")),
                 key=lambda l: l["periode"])[-nombre:]
    brut = sum(l["montants"]["brut"] for l in lus)
    if not brut:
        return {"taux": TAUX_NET_DEFAUT, "source": "estimation"}
    return {"taux": round(sum(l["montants"]["net"] for l in lus) / brut, 4), "source": "bulletins", "bulletins": len(lus)}


def _charger_cache() -> dict:
    try:
        cache = json.loads(FICHIER_CACHE.read_text(encoding="utf-8"))
        if cache.get("version") != VERSION_LECTURE:
            return {"version": VERSION_LECTURE}
        # Avant la 1.4.2, l'absence de pypdf (« No module named… ») était gardée en cache : ces
        # bulletins seraient restés illisibles pour toujours. On les oublie pour les relire.
        return {c: v for c, v in cache.items()
                if c == "version" or "No module named" not in (v.get("erreur") or "")}
    except (OSError, ValueError):
        return {"version": VERSION_LECTURE}


def lire_bulletin(chemin: str, cache: dict) -> dict:
    p = Path(chemin)
    cle = f"{p}|{int(p.stat().st_mtime)}"
    if cle in cache:
        return cache[cle]
    try:
        texte = lire_texte_pdf(chemin)
        montants = analyser_texte(texte)
        resultat = {"montants": montants, "lu": bool(montants.get("brut") or montants.get("net")),
                    "employeur": lire_employeur(texte), "fiche_employeur": lire_bloc_employeur(texte)}
    except ImportError:
        # Module de lecture des PDF absent (installé au démarrage s'il manque) : rien n'est gardé
        # en cache, le bulletin sera relu à la prochaine visite.
        return {"montants": {}, "lu": False, "erreur": MODULE_ABSENT}
    except Exception as e:  # PDF illisible : on le signale sans bloquer le reste
        resultat = {"montants": {}, "lu": False, "erreur": str(e).splitlines()[0][:200]}
    cache[cle] = resultat
    return resultat


def releve(dossier: str) -> list:
    """Un élément par bulletin du dossier : famille, période, montants."""
    if not dossier or not Path(dossier).is_dir():
        return []
    racine = Path(dossier)
    familles = bibliotheque.sous_dossiers_clients(dossier)
    with _verrou:
        cache = _charger_cache()
        lignes = []
        for f in bibliotheque.inventaire(dossier):
            rel = [x for x in Path(f["chemin"]).relative_to(racine).parts[:-1] if not bibliotheque.RE_ANNEE.match(x)]
            famille = rel[0] if rel else next((fam for fam in familles if bibliotheque.mots(fam) & f["mots"]), None) \
                or " ".join(sorted(f["mots"])).title() or "(sans nom de famille)"
            info = lire_bulletin(f["chemin"], cache)
            lignes.append({"famille": famille, "periode": f["periode"], "fichier": f["chemin"], **info})
        # On ne garde que les bulletins encore présents.
        presents = {f"{Path(l['fichier'])}|" for l in lignes}
        for cle in [c for c in cache if c != "version" and not any(c.startswith(p) for p in presents)]:
            del cache[cle]
        FICHIER_CACHE.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
    return lignes


def totaux(lignes: list, annee: str) -> dict:
    """Totaux d'une année : général, par mois, par famille ; et les années disponibles."""
    rubriques = ("brut", "cotisations", "net", "net_imposable", "entretien", "repas", "km", "rupture", "heures",
                 "jours", "encaisse")

    def vide():
        return {r: 0.0 for r in rubriques} | {"bulletins": 0, "illisibles": 0}

    def ajouter(cible, l):
        cible["bulletins"] += 1
        if not l["lu"]:
            cible["illisibles"] += 1
        for r in rubriques:
            cible[r] += l["montants"].get(r) or 0.0
        cible["heures"] += l["montants"].get("heures_comp") or 0.0

    general, mois, familles = vide(), {f"{m:02d}": vide() for m in range(1, 13)}, {}
    for l in lignes:
        if not l["periode"].startswith(annee):
            continue
        ajouter(general, l)
        ajouter(mois[l["periode"][5:7]], l)
        ajouter(familles.setdefault(l["famille"], vide()), l)
    for bloc in [general, *mois.values(), *familles.values()]:
        bloc["indemnites"] = bloc["entretien"] + bloc["repas"] + bloc["km"]
        for r in list(bloc):
            if isinstance(bloc[r], float):
                bloc[r] = round(bloc[r], 2)
    annees = sorted({l["periode"][:4] for l in lignes}, reverse=True)
    return {"annee": annee, "annees": annees, "general": general, "mois": mois,
            "familles": dict(sorted(familles.items(), key=lambda kv: -kv[1]["brut"])),
            "illisibles": [l["fichier"] for l in lignes if l["periode"].startswith(annee) and not l["lu"]],
            "module_absent": any(l.get("erreur") == MODULE_ABSENT for l in lignes)}
