"""Profil de l'assistante maternelle et fiches contrats (fichiers JSON dans donnees\\).

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
    "semaines": "52",              # « 52 » ou nombre de semaines programmées (46 ou moins)
    "tarif_horaire": "",
    "entretien_jour": "",
    "accueil": "journee",          # journee ou periscolaire
    # Emploi du temps type : {"lundi": "8h00-17h30", …}, en période scolaire et en vacances
    "horaires_scolaire": {},
    "horaires_vacances": {},
    "notes": "",
}

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


def _nettoyer_horaires(h) -> dict:
    if not isinstance(h, dict):
        return {}
    return {j: str(h[j]).strip() for j in JOURS if str(h.get(j) or "").strip()}


def contrats() -> list:
    with _verrou:
        liste = _lire(FICHIER_CONTRATS, [])
    return [CHAMPS_CONTRAT | c for c in liste if isinstance(c, dict)]


def enregistrer_contrat(c: dict) -> dict:
    propre = {k: (_nettoyer_horaires(c.get(k)) if k.startswith("horaires") else str(c.get(k) or defaut).strip())
              for k, defaut in CHAMPS_CONTRAT.items()}
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
    actifs = [c for c in contrats() if actif(c, jour)]
    for annee in (jour.year, jour.year + 1):
        ajouter(date(annee, 4, 15), "Déclaration de revenus",
                "Période habituelle d'avril à juin : le tableau de bord donne les totaux de l'année.")
        incomplets = sorted({c["famille"] for c in actifs if (c.get("semaines") or "52").strip() not in ("", "52")})
        if incomplets:
            ajouter(date(annee, 6, 1), "Congés payés à verser en juin",
                    "Contrats sur 46 semaines ou moins : " + ", ".join(incomplets) + ".")
    for c in actifs:
        fin = lire(c.get("fin"))
        if fin:
            ajouter(fin, f"Fin du contrat de {c.get('enfant_prenom') or c.get('famille')}",
                    "Penser au solde : congés restants, régularisation, documents de fin de contrat.")
    return sorted(liste, key=lambda e: e["date"])
