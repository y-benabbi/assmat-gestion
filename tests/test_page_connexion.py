"""Vérifie, sans se connecter, que l'application atteint la vraie page de connexion
Pajemploi (fenêtre réduite) et y reconnaît les champs identifiant / mot de passe."""
import os
import re
import sys
import tempfile
from pathlib import Path

os.environ.setdefault("ASSMAT_BASE", tempfile.mkdtemp())
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "app"))

import pajemploi  # noqa: E402

p = pajemploi.Pajemploi()
p._ouvrir_navigateur(False)          # même navigateur que l'application, fenêtre réduite
page = p._page
page.goto(pajemploi.URL_ACCUEIL, wait_until="domcontentloaded", timeout=60000)
p._attendre_stable(page)
print("accueil :", page.url.split("?")[0])
if not p._sur_page_connexion(page):
    assert not p._semble_connecte(page)
    assert p._cliquer_texte(page, r"se connecter|connexion|espace salari|mon espace"), "bouton de connexion introuvable"
    p._attendre_stable(page)
print("connexion :", page.url.split("?")[0])
assert p._sur_page_connexion(page), "page de connexion non atteinte"
p._refuser_cookies(page)
assert page.locator("#mail, input[name=username], input[autocomplete=username]").count() >= 1
assert page.locator("#password, input[type=password]").count() >= 1
assert page.locator("button[type=submit]", has_text=re.compile("connecter", re.I)).count() >= 1
assert not p._champs_code(page), "un champ de code est détecté à tort"
p._fermer_navigateur()
p._pw.stop()
print("page de connexion OK")
