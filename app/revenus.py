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
VERSION_LECTURE = 1       # à augmenter quand les règles changent : les bulletins sont relus

RE_MONTANT = re.compile(r"-?\d{1,3}(?:[ \u202f\xa0.]\d{3})*,\d{1,2}|-?\d+(?:[.,]\d{1,2})?")

# Rubrique -> libellés possibles (texte normalisé : minuscules, sans accents).
# L'ordre compte : le premier libellé trouvé l'emporte.
RUBRIQUES = {
    "brut": [r"salaire brut", r"remuneration brute", r"total brut"],
    "cotisations": [r"total (des )?cotisations( et contributions)? salariales", r"cotisations salariales",
                    r"total (des )?retenues"],
    "net": [r"salaire net\b(?! a payer)(?! imposable)", r"remuneration nette", r"net avant impot"],
    "net_a_payer": [r"net a payer", r"montant net (verse|paye)", r"salaire net paye"],
    "net_imposable": [r"net imposable", r"montant net imposable", r"salaire imposable"],
    "impot": [r"^(montant (de l.)?)?impot sur le revenu", r"prelevement a la source"],
    "entretien": [r"indemnites? d.?entretien", r"frais d.?entretien"],
    "repas": [r"indemnites? de repas", r"frais de repas", r"indemnites? de nourriture"],
    "km": [r"indemnites? kilometriques?", r"frais kilometriques"],
    "heures": [r"nombre d.?heures( normales)?", r"heures (normales|travaillees|d.?accueil)"],
    "jours": [r"nombre de jours( d.?activite| d.?accueil| travailles)?", r"jours d.?(activite|accueil)"],
}

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
    lignes = [bibliotheque.normaliser(l) for l in texte.splitlines() if l.strip()]
    trouve = {}
    for rubrique, motifs in RUBRIQUES.items():
        for motif in motifs:
            for i, ligne in enumerate(lignes):
                m = re.search(motif, ligne)
                if not m:
                    continue
                reste = ligne[m.end():]
                montants = RE_MONTANT.findall(reste)
                if not montants and i + 1 < len(lignes) and not re.search(r"[a-z]", lignes[i + 1]):
                    # Montant parfois renvoyé seul à la ligne suivante.
                    montants = RE_MONTANT.findall(lignes[i + 1])[:1]
                valeurs = [v for v in (nombre(x) for x in montants) if v is not None]
                if valeurs:
                    trouve[rubrique] = abs(valeurs[-1])
                    break
            if rubrique in trouve:
                break
    # Cohérence : si le net manque, on le déduit du brut et des cotisations.
    if "net" not in trouve and "brut" in trouve and "cotisations" in trouve:
        trouve["net"] = round(trouve["brut"] - trouve["cotisations"], 2)
    if "cotisations" not in trouve and "brut" in trouve and "net" in trouve:
        trouve["cotisations"] = round(trouve["brut"] - trouve["net"], 2)
    return trouve


def _charger_cache() -> dict:
    try:
        cache = json.loads(FICHIER_CACHE.read_text(encoding="utf-8"))
        return cache if cache.get("version") == VERSION_LECTURE else {"version": VERSION_LECTURE}
    except (OSError, ValueError):
        return {"version": VERSION_LECTURE}


def lire_bulletin(chemin: str, cache: dict) -> dict:
    p = Path(chemin)
    cle = f"{p}|{int(p.stat().st_mtime)}"
    if cle in cache:
        return cache[cle]
    try:
        montants = analyser_texte(lire_texte_pdf(chemin))
        resultat = {"montants": montants, "lu": bool(montants.get("brut") or montants.get("net"))}
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
    rubriques = ("brut", "cotisations", "net", "net_imposable", "entretien", "repas", "km", "heures", "jours")

    def vide():
        return {r: 0.0 for r in rubriques} | {"bulletins": 0, "illisibles": 0}

    def ajouter(cible, l):
        cible["bulletins"] += 1
        if not l["lu"]:
            cible["illisibles"] += 1
        for r in rubriques:
            cible[r] += l["montants"].get(r) or 0.0

    general, mois, familles = vide(), {f"{m:02d}": vide() for m in range(1, 13)}, {}
    for l in lignes:
        if not l["periode"].startswith(annee):
            continue
        ajouter(general, l)
        ajouter(mois[l["periode"][5:7]], l)
        ajouter(familles.setdefault(l["famille"], vide()), l)
    for bloc in [general, *mois.values(), *familles.values()]:
        bloc["indemnites"] = bloc["entretien"] + bloc["repas"] + bloc["km"]
        bloc["encaisse"] = bloc["net"] + bloc["indemnites"]
        for r in list(bloc):
            if isinstance(bloc[r], float):
                bloc[r] = round(bloc[r], 2)
    annees = sorted({l["periode"][:4] for l in lignes}, reverse=True)
    return {"annee": annee, "annees": annees, "general": general, "mois": mois,
            "familles": dict(sorted(familles.items(), key=lambda kv: -kv[1]["brut"])),
            "illisibles": [l["fichier"] for l in lignes if l["periode"].startswith(annee) and not l["lu"]]}
