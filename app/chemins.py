"""Emplacements utilisés par l'application.

Le code (dossier « application ») est remplacé à chaque mise à jour ; tout ce
qui doit être conservé est à côté, dans %LOCALAPPDATA%\\assmat-gestion :
  application\\         code téléchargé depuis la branche « stable »
  python\\              environnement Python du projet
  navigateurs\\         navigateur automatisé (Chromium)
  profil-navigateur\\   cookies Pajemploi (appareil reconnu)
  donnees\\             paramètres (sans le mot de passe)
  journaux\\            historique et diagnostics
Le dossier des bulletins de salaire est choisi dans les Paramètres.
"""
import os
from pathlib import Path

DEPOT_GITHUB = "y-benabbi/assmat-gestion"
BRANCHE_STABLE = "stable"

RACINE_CODE = Path(__file__).resolve().parent.parent
DOSSIER_WEB = RACINE_CODE / "app" / "web"
FICHIER_VERSION = RACINE_CODE / "VERSION"

BASE = Path(os.environ.get("ASSMAT_BASE") or
            Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local")) / "assmat-gestion")
DOSSIER_DONNEES = BASE / "donnees"
FICHIER_PARAMETRES = DOSSIER_DONNEES / "parametres.json"
PROFIL_NAVIGATEUR = BASE / "profil-navigateur"
NAVIGATEURS_PLAYWRIGHT = BASE / "navigateurs"
JOURNAUX = BASE / "journaux"
DIAGNOSTICS = JOURNAUX / "diagnostics"
AMORCE = RACINE_CODE / "distribution" / "Executables" / "amorce.ps1"
FICHIER_PROGRAMME = BASE / "dossier-programme.txt"

# Serveur local : port et clé secrète propres à la session Windows (voir main.py).
# Plusieurs sessions d'un même PC partagent les ports de 127.0.0.1 : sans cela, une session
# ouvrirait l'application (et les paramètres) d'une autre.
FICHIER_SERVEUR = BASE / "serveur.json"
PORT_FORCE = int(os.environ.get("ASSMAT_PORT") or 0)   # tests

for d in (DOSSIER_DONNEES, JOURNAUX, DIAGNOSTICS):
    d.mkdir(parents=True, exist_ok=True)

os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", str(NAVIGATEURS_PLAYWRIGHT))


def version_locale() -> str:
    try:
        return FICHIER_VERSION.read_text(encoding="utf-8").strip()
    except OSError:
        return "dev"
