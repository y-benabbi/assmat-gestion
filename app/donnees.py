"""Profil de l'assistante maternelle, familles employeurs et fiches contrats (JSON dans donnees\\).

Le profil regroupe les « champs globaux » réutilisés par les courriers (identité, agrément,
PMI…). Les contrats décrivent chaque enfant accueilli. Ces fichiers contiennent des données
personnelles : ils restent sur le poste, jamais dans le dépôt.
"""
import json
import secrets
import threading
from datetime import date

from chemins import DOSSIER_DONNEES

FICHIER_PROFIL = DOSSIER_DONNEES / "profil.json"
FICHIER_CONTRATS = DOSSIER_DONNEES / "contrats.json"
FICHIER_FAMILLES = DOSSIER_DONNEES / "familles.json"

CHAMPS_PROFIL = {
    "civilite": "Madame",
    "nom": "",
    "prenom": "",
    "adresse": "",
    "code_postal": "",
    "ville": "",
    "telephone": "",
    "email": "",
    "agrement_numero": "",
    "agrement_debut": "",          # AAAA-MM-JJ : date du premier agrément
    "agrement_fin": "",            # AAAA-MM-JJ : date d'échéance de l'agrément en cours
    "agrement_capacite": "4",
    "agrement_ages": "0 à 18 ans",
    "agrement_type": "en journée",
    "pmi_destinataire": "du médecin de la PMI",   # suit « À l'attention »
    "pmi_adresse": "",
    "zone_vacances": "",           # A, B, C ou Corse
    "assurance_rc_echeance": "",
    "assurance_auto_echeance": "",
}

# Famille employeur : les fiches enfants s'y rattachent par le nom (« famille »), qui est aussi celui
# du dossier des bulletins.
CHAMPS_FAMILLE = {
    "nom": "",
    "parent1_civilite": "", "parent1_prenom": "", "parent1_nom": "",
    "parent2_civilite": "", "parent2_prenom": "", "parent2_nom": "",
    "adresse": "", "code_postal": "", "ville": "",
    "telephone": "", "email": "",
    "numero_pajemploi": "",        # « N° employeur » du bulletin
    "notes": "",
}

JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]

CHAMPS_CONTRAT = {
    "famille": "",                 # nom utilisé pour le rangement des bulletins
    "parents": "",
    "enfant_prenom": "",
    "enfant_nom": "",
    "enfant_naissance": "",        # AAAA-MM-JJ
    "enfant_genre": "",            # « fille » ou « garcon » (accords dans les courriers)
    "debut": "",                   # début de l'accueil
    "fin": "",                     # vide : contrat en cours
    "semaines": "52",              # semaines d'accueil par an : « 52 » (année complète) ou moins
    "tarif_horaire": "",
    "entretien_jour": "",
    "abattement_majore": "",       # « oui » : enfant handicapé, malade ou inadapté (impôts : 4 × SMIC)
    "accueil": "journee",          # journee ou periscolaire
    # Emploi du temps type : {"lundi": "8h00-17h30", …}, en période scolaire et en vacances
    "horaires_scolaire": {},
    "horaires_vacances": {},
    "notes": "",
    # Avenants : [{"id", "date" (AAAA-MM-JJ, prise d'effet), "motif", + les champs de MODIFIABLES}], par date.
    # Chaque avenant reprend toutes les conditions modifiables, telles qu'elles s'appliquent à partir de sa date.
    "avenants": [],
}

# Conditions du contrat qu'un avenant peut changer.
MODIFIABLES = ("semaines", "accueil", "tarif_horaire", "entretien_jour", "horaires_scolaire", "horaires_vacances")

_verrou = threading.Lock()


def _lire(fichier, defaut):
    try:
        return json.loads(fichier.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return defaut


def _ecrire(fichier, donnees):
    fichier.write_text(json.dumps(donnees, ensure_ascii=False, indent=2), encoding="utf-8")


def profil() -> dict:
    with _verrou:
        return CHAMPS_PROFIL | {k: v for k, v in _lire(FICHIER_PROFIL, {}).items() if k in CHAMPS_PROFIL}


def enregistrer_profil(nouveau: dict) -> dict:
    actuel = profil()
    actuel.update({k: str(v).strip() for k, v in nouveau.items() if k in CHAMPS_PROFIL})
    with _verrou:
        _ecrire(FICHIER_PROFIL, actuel)
    return actuel


def _cle(nom) -> str:
    return " ".join((nom or "").lower().split())


def familles() -> list:
    """Familles employeurs enregistrées, plus celles citées par une fiche enfant sans fiche famille
    (anciennes fiches) : ces dernières ont un id vide jusqu'à leur premier enregistrement."""
    with _verrou:
        liste = [CHAMPS_FAMILLE | f for f in _lire(FICHIER_FAMILLES, []) if isinstance(f, dict)]
    connues = {_cle(f["nom"]) for f in liste}
    for c in contrats():
        if c.get("famille") and _cle(c["famille"]) not in connues:
            connues.add(_cle(c["famille"]))
            liste.append(CHAMPS_FAMILLE | {"id": "", "nom": c["famille"].strip(), "parent1_nom": c.get("parents", "")})
    return sorted(liste, key=lambda f: _cle(f["nom"]))


def nom_parents(f: dict) -> str:
    """« Mme Claire Dupont et M. Paul Dupont »."""
    noms = [" ".join(x for x in (f.get(f"parent{n}_civilite"), f.get(f"parent{n}_prenom"), f.get(f"parent{n}_nom")) if x)
            for n in (1, 2)]
    return " et ".join(n for n in noms if n)


def enregistrer_famille(f: dict) -> dict:
    propre = {k: str(f.get(k) or "").strip() for k in CHAMPS_FAMILLE}
    if not propre["nom"]:
        raise ValueError("Indiquez le nom de la famille.")
    propre["id"] = f.get("id") or secrets.token_hex(4)
    with _verrou:
        liste = _lire(FICHIER_FAMILLES, [])
        if any(_cle(x.get("nom")) == _cle(propre["nom"]) and x.get("id") != propre["id"] for x in liste):
            raise ValueError(f"Une famille {propre['nom']} existe déjà.")
        ancien = next((x.get("nom") for x in liste if x.get("id") == propre["id"]), f.get("ancien_nom"))
        liste = [x for x in liste if x.get("id") != propre["id"]] + [propre]
        _ecrire(FICHIER_FAMILLES, sorted(liste, key=lambda x: _cle(x.get("nom"))))
        # Nom changé : les fiches enfants suivent.
        if ancien and _cle(ancien) != _cle(propre["nom"]):
            fiches = _lire(FICHIER_CONTRATS, [])
            for c in fiches:
                if _cle(c.get("famille")) == _cle(ancien):
                    c["famille"] = propre["nom"]
            _ecrire(FICHIER_CONTRATS, fiches)
    return propre


def completer_familles(lignes_bulletins: list) -> list:
    """Crée la fiche des familles trouvées dans les bulletins qui n'en ont pas, et complète les champs
    encore vides des fiches existantes (parent, adresse, n° Pajemploi lus sur le bulletin le plus récent).
    Ne remplace jamais ce qui a été saisi. Renvoie les noms des familles créées."""
    recents = {}
    for l in sorted(lignes_bulletins, key=lambda x: x.get("periode", "")):
        if l.get("fiche_employeur") and l.get("famille") and not l["famille"].startswith("("):
            recents[_cle(l["famille"])] = (l["famille"], l["fiche_employeur"])
    if not recents:
        return []
    correspondance = {"civilite": "parent1_civilite", "prenom": "parent1_prenom", "nom": "parent1_nom",
                      "adresse": "adresse", "code_postal": "code_postal", "ville": "ville",
                      "numero_pajemploi": "numero_pajemploi"}
    crees = []
    with _verrou:
        liste = _lire(FICHIER_FAMILLES, [])
        par_cle = {_cle(f.get("nom")): f for f in liste}
        anciens_parents = {_cle(c.get("famille")): c.get("parents", "") for c in _lire(FICHIER_CONTRATS, [])}
        modifie = False
        for cle, (nom, lu) in recents.items():
            f = par_cle.get(cle)
            if f is None:
                f = CHAMPS_FAMILLE | {"id": secrets.token_hex(4), "nom": nom.strip()}
                liste.append(f)
                crees.append(f["nom"])
                modifie = True
                if anciens_parents.get(cle) and not lu.get("nom"):
                    f["parent1_nom"] = anciens_parents[cle]
            # Parent et adresse : seulement s'ils sont entièrement vides (sinon on mélangerait deux saisies).
            vide_parent = not (f.get("parent1_prenom") or f.get("parent1_nom"))
            vide_adresse = not (f.get("adresse") or f.get("code_postal") or f.get("ville"))
            for champ, cible in correspondance.items():
                if (cible.startswith("parent1") and not vide_parent) or \
                        (cible in ("adresse", "code_postal", "ville") and not vide_adresse):
                    continue
                if lu.get(champ) and not f.get(cible):
                    f[cible] = lu[champ]
                    modifie = True
        if modifie:
            _ecrire(FICHIER_FAMILLES, sorted(liste, key=lambda x: _cle(x.get("nom"))))
    return crees


def supprimer_famille(ident: str) -> None:
    with _verrou:
        liste = _lire(FICHIER_FAMILLES, [])
        f = next((x for x in liste if x.get("id") == ident), None)
        if f and any(_cle(c.get("famille")) == _cle(f.get("nom")) for c in _lire(FICHIER_CONTRATS, [])):
            raise ValueError("Supprimez ou rattachez d'abord les fiches enfants de cette famille.")
        _ecrire(FICHIER_FAMILLES, [x for x in liste if x.get("id") != ident])


def _nettoyer_horaires(h) -> dict:
    if not isinstance(h, dict):
        return {}
    return {j: str(h[j]).strip() for j in JOURS if str(h.get(j) or "").strip()}


def contrats(jour: date = None) -> list:
    """Fiches enfants. Avec un jour : conditions en vigueur ce jour-là (dernier avenant déjà commencé)."""
    with _verrou:
        liste = _lire(FICHIER_CONTRATS, [])
    fiches = [CHAMPS_CONTRAT | c for c in liste if isinstance(c, dict)]
    return [en_vigueur(c, jour) for c in fiches] if jour else fiches


def en_vigueur(c: dict, jour: date) -> dict:
    """Le contrat tel qu'il s'applique à ce jour : conditions du dernier avenant dont la date est passée."""
    applicables = [a for a in c.get("avenants") or [] if a.get("date") and a["date"] <= jour.isoformat()]
    if not applicables:
        return c
    dernier = max(applicables, key=lambda a: a["date"])
    return c | {k: dernier[k] for k in MODIFIABLES if k in dernier}


def _nettoyer_avenants(liste) -> list:
    propres = []
    for a in liste if isinstance(liste, list) else []:
        if not isinstance(a, dict) or not str(a.get("date") or "").strip():
            continue
        propre = {"id": str(a.get("id") or secrets.token_hex(4)), "date": str(a["date"]).strip(),
                  "motif": str(a.get("motif") or "").strip()}
        for k in MODIFIABLES:
            propre[k] = _nettoyer_horaires(a.get(k)) if k.startswith("horaires") else str(a.get(k) or CHAMPS_CONTRAT[k]).strip()
        propres.append(propre)
    return sorted(propres, key=lambda a: a["date"])


def enregistrer_contrat(c: dict) -> dict:
    propre = {k: (_nettoyer_horaires(c.get(k)) if k.startswith("horaires") else str(c.get(k) or defaut).strip())
              for k, defaut in CHAMPS_CONTRAT.items() if k != "avenants"}
    propre["avenants"] = _nettoyer_avenants(c.get("avenants"))
    propre["id"] = c.get("id") or secrets.token_hex(4)
    with _verrou:
        liste = [x for x in _lire(FICHIER_CONTRATS, []) if x.get("id") != propre["id"]]
        liste.append(propre)
        liste.sort(key=lambda x: (x.get("famille", "").lower(), x.get("enfant_prenom", "").lower()))
        _ecrire(FICHIER_CONTRATS, liste)
    return propre


def supprimer_contrat(ident: str) -> bool:
    with _verrou:
        liste = _lire(FICHIER_CONTRATS, [])
        reste = [x for x in liste if x.get("id") != ident]
        _ecrire(FICHIER_CONTRATS, reste)
    return len(reste) != len(liste)


def _semaines(c: dict) -> int:
    try:
        return min(52, max(1, int(str(c.get("semaines") or "52").strip())))
    except ValueError:
        return 52


def actif(c: dict, jour: date) -> bool:
    return (not c.get("debut") or c["debut"] <= jour.isoformat()) and (not c.get("fin") or c["fin"] >= jour.isoformat())


def age_texte(naissance: str, jour: date) -> str:
    """« 4 ans », « 2 ans et demi », « 1 an », « 8 mois »."""
    try:
        n = date.fromisoformat(naissance)
    except (TypeError, ValueError):
        return ""
    mois = (jour.year - n.year) * 12 + jour.month - n.month - (jour.day < n.day)
    if mois < 0:
        return ""
    if mois < 12:
        return f"{mois} mois"
    ans, reste = divmod(mois, 12)
    texte = f"{ans} an" + ("s" if ans > 1 else "")
    return texte + " et demi" if 6 <= reste < 12 else texte


def _moins_mois(d: date, n: int) -> date:
    m = d.month - n
    annee, mois = d.year + (m - 1) // 12, (m - 1) % 12 + 1
    return date(annee, mois, min(d.day, 28))


def echeances(jour: date, horizon_jours: int = 400) -> list:
    """Prochaines échéances, triées : [{"date": AAAA-MM-JJ, "titre", "detail", "urgent"}]."""
    p = profil()
    liste = []

    def ajouter(d: date, titre: str, detail: str = ""):
        if jour <= d <= jour.fromordinal(jour.toordinal() + horizon_jours):
            liste.append({"date": d.isoformat(), "titre": titre, "detail": detail,
                          "urgent": (d - jour).days <= 30})

    def lire(iso):
        try:
            return date.fromisoformat(iso)
        except (TypeError, ValueError):
            return None

    # Bulletins du mois écoulé : les familles déclarent en début de mois.
    debut_mois = date(jour.year + (jour.month == 12), jour.month % 12 + 1, 1)
    ajouter(debut_mois, "Bulletins du mois à récupérer",
            "Les familles déclarent le mois écoulé sur Pajemploi en début de mois.")
    fin_agrement = lire(p.get("agrement_fin"))
    if fin_agrement:
        ajouter(_moins_mois(fin_agrement, 6), "Préparer le renouvellement de l'agrément",
                f"L'agrément expire le {fin_agrement.strftime('%d/%m/%Y')}.")
        ajouter(_moins_mois(fin_agrement, 3), "Dernier délai pour demander le renouvellement de l'agrément",
                "La demande (Cerfa 13394) doit parvenir à la PMI au moins 3 mois avant l'échéance.")
        ajouter(fin_agrement, "Fin de l'agrément")
    for cle, nom in (("assurance_rc_echeance", "responsabilité civile professionnelle"),
                     ("assurance_auto_echeance", "automobile (usage professionnel)")):
        d = lire(p.get(cle))
        if d:
            ajouter(d, f"Échéance de l'assurance {nom}")
    actifs = [c for c in contrats(jour) if actif(c, jour)]
    for annee in (jour.year, jour.year + 1):
        ajouter(date(annee, 4, 15), "Déclaration de revenus",
                "Période habituelle d'avril à juin : la rubrique Impôts calcule le montant à déclarer.")
        incomplets = sorted({c["famille"] for c in actifs if _semaines(c) < 52})
        if incomplets:
            ajouter(date(annee, 6, 1), "Congés payés à verser en juin",
                    "Contrats en année incomplète (moins de 52 semaines) : " + ", ".join(incomplets) + ".")
    for c in actifs:
        fin = lire(c.get("fin"))
        if fin:
            ajouter(fin, f"Fin du contrat de {c.get('enfant_prenom') or c.get('famille')}",
                    "Penser au solde : congés restants, régularisation, documents de fin de contrat.")
    return sorted(liste, key=lambda e: e["date"])
