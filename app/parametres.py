"""Lecture / écriture des paramètres.

Le mot de passe Pajemploi n'est jamais écrit dans un fichier : il est rangé
dans le Gestionnaire d'identifiants de Windows (module keyring).
"""
import json
import threading
from pathlib import Path

import keyring

from chemins import FICHIER_PARAMETRES

SERVICE_KEYRING = "AssistanteMaternelle-Pajemploi"

# Sous-dossiers créés par l'application dans le dossier principal.
SOUS_DOSSIERS = {
    "bulletins": "Bulletins de salaire",
    "courriers": "Courriers",
    "photos": "Photos et vidéos",
    "activites": "Activités",
    "a_trier": "À trier",
    "sauvegarde": "Sauvegarde",
}

DEFAUTS = {
    "identifiant": "",
    # Dossier principal choisi par l'utilisatrice : tout y est rangé (SOUS_DOSSIERS). Tant qu'il n'est pas
    # choisi (installations antérieures à la 1.11.0), les anciens réglages ci-dessous restent utilisés.
    "dossier_principal": "",
    "dossier_bulletins": "",
    "format_fichier": "Bulletin de salaire - NOM CLIENT - YYYY-MM",
    # Rangement : "client", "client_annee", "annee" ou "annee_client" (bibliotheque.ORGANISATIONS)
    "organisation": "client",
    "periode_min": "",
    "navigateur_visible": False,
    # Lignes « NOM AFFICHÉ PAR PAJEMPLOI = Nom du dossier »
    "correspondances": "",
    # Rubriques affichées (« Paramètres ») : une rubrique masquée garde ses données.
    # « activites » = rubrique Accès rapide (sites), « ateliers » = rubrique Activités.
    "modules": {"bulletins": True, "revenus": True, "contrats": True, "echeances": True, "courriers": True,
                "impots": True, "activites": True, "photos": True, "ateliers": True},
    "regime_impots": "specifique",          # specifique, classique ou comparer
    "dossier_courriers": "",                # vide : dossier « Courriers » à côté des bulletins
    # Photos : dossiers où arrivent les photos (iCloud…) et marge autour des horaires d'accueil, en minutes.
    "dossiers_photos": [],
    "marge_photos": 30,
    # Académie (calendrier des vacances scolaires, vacances.ACADEMIES) ; vide : vacances inconnues.
    "academie": "",
}

_verrou = threading.Lock()


def brut() -> dict:
    """Réglages tels qu'enregistrés (sans les dossiers déduits du dossier principal)."""
    with _verrou:
        donnees = dict(DEFAUTS)
        if FICHIER_PARAMETRES.exists():
            try:
                donnees.update(json.loads(FICHIER_PARAMETRES.read_text(encoding="utf-8")))
            except (ValueError, OSError):
                pass
        donnees["modules"] = DEFAUTS["modules"] | (donnees.get("modules") or {})
        if not isinstance(donnees.get("dossiers_photos"), list):
            donnees["dossiers_photos"] = []
        return donnees


def charger() -> dict:
    """Réglages ; avec un dossier principal, les dossiers des bulletins et des courriers en découlent."""
    donnees = brut()
    if donnees.get("dossier_principal"):
        donnees["dossier_bulletins"] = str(Path(donnees["dossier_principal"]) / SOUS_DOSSIERS["bulletins"])
        donnees["dossier_courriers"] = str(Path(donnees["dossier_principal"]) / SOUS_DOSSIERS["courriers"])
    return donnees


def dossier(nom: str, params: dict = None):
    """Sous-dossier du dossier principal (SOUS_DOSSIERS), ou None s'il n'est pas encore choisi."""
    principal = (params or brut()).get("dossier_principal")
    return Path(principal) / SOUS_DOSSIERS[nom] if principal else None


def marge_minutes(params: dict = None) -> int:
    try:
        return max(0, min(24 * 60, int(float((params or brut()).get("marge_photos") or 0))))
    except (TypeError, ValueError):
        return 30


def enregistrer(nouveaux: dict) -> dict:
    actuels = brut()
    mot_de_passe = nouveaux.pop("mot_de_passe", None)
    for cle in DEFAUTS:
        if cle in nouveaux:
            if cle == "modules" and isinstance(nouveaux[cle], dict):
                actuels[cle] = DEFAUTS["modules"] | actuels.get("modules", {}) | {
                    k: bool(v) for k, v in nouveaux[cle].items() if k in DEFAUTS["modules"]}
            elif cle == "dossiers_photos":
                liste = nouveaux[cle] if isinstance(nouveaux[cle], list) else str(nouveaux[cle] or "").splitlines()
                actuels[cle] = list(dict.fromkeys(str(d).strip() for d in liste if str(d).strip()))
            elif cle == "marge_photos":
                actuels[cle] = marge_minutes({"marge_photos": nouveaux[cle]})
            else:
                actuels[cle] = nouveaux[cle]
    with _verrou:
        FICHIER_PARAMETRES.write_text(
            json.dumps(actuels, ensure_ascii=False, indent=2), encoding="utf-8"
        )
    if mot_de_passe:
        keyring.set_password(SERVICE_KEYRING, "pajemploi", mot_de_passe)
    return charger()


def mot_de_passe() -> str:
    try:
        return keyring.get_password(SERVICE_KEYRING, "pajemploi") or ""
    except Exception:
        return ""


def mot_de_passe_enregistre() -> bool:
    return bool(mot_de_passe())


def correspondances(params: dict) -> dict:
    """« NOM PAJEMPLOI = Dossier » -> {nom normalisé: dossier}."""
    from bibliotheque import normaliser

    resultat = {}
    for ligne in params.get("correspondances", "").splitlines():
        if "=" in ligne:
            gauche, droite = ligne.split("=", 1)
            if gauche.strip() and droite.strip():
                resultat[normaliser(gauche)] = droite.strip()
    return resultat
