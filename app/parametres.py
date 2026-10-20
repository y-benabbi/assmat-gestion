"""Lecture / écriture des paramètres.

Le mot de passe Pajemploi n'est jamais écrit dans un fichier : il est rangé
dans le Gestionnaire d'identifiants de Windows (module keyring).
"""
import json
import threading

import keyring

from chemins import FICHIER_PARAMETRES

SERVICE_KEYRING = "AssistanteMaternelle-Pajemploi"

DEFAUTS = {
    "identifiant": "",
    "dossier_bulletins": "",
    "format_fichier": "Bulletin de salaire - NOM CLIENT - YYYY-MM",
    # Rangement : "client", "client_annee", "annee" ou "annee_client" (bibliotheque.ORGANISATIONS)
    "organisation": "client",
    "periode_min": "",
    "navigateur_visible": False,
    # Lignes « NOM AFFICHÉ PAR PAJEMPLOI = Nom du dossier »
    "correspondances": "",
}

_verrou = threading.Lock()


def charger() -> dict:
    with _verrou:
        donnees = dict(DEFAUTS)
        if FICHIER_PARAMETRES.exists():
            try:
                donnees.update(json.loads(FICHIER_PARAMETRES.read_text(encoding="utf-8")))
            except (ValueError, OSError):
                pass
        return donnees


def enregistrer(nouveaux: dict) -> dict:
    actuels = charger()
    mot_de_passe = nouveaux.pop("mot_de_passe", None)
    for cle in DEFAUTS:
        if cle in nouveaux:
            actuels[cle] = nouveaux[cle]
    with _verrou:
        FICHIER_PARAMETRES.write_text(
            json.dumps(actuels, ensure_ascii=False, indent=2), encoding="utf-8"
        )
    if mot_de_passe:
        keyring.set_password(SERVICE_KEYRING, "pajemploi", mot_de_passe)
    return actuels


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
