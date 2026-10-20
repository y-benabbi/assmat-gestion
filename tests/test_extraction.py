"""Teste la lecture d'une liste de bulletins et le téléchargement sur des pages imitant
Pajemploi (tableau et cartes), servies localement. Noms fictifs."""
import os
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ICI = Path(__file__).resolve().parent
os.environ.setdefault("ASSMAT_BASE", tempfile.mkdtemp())
sys.path.insert(0, str(ICI.parent / "app"))

from playwright.sync_api import sync_playwright  # noqa: E402

import pajemploi  # noqa: E402

TABLEAU = """<html><body><h1>Mes bulletins de salaire</h1>
<table><thead><tr><th>Employeur</th><th>Période</th><th>Salaire net</th><th>Document</th></tr></thead><tbody>
<tr><td>M. DUPONT Jean</td><td>Mars 2026</td><td>412,50 €</td><td><a href="/pdf/1">Télécharger le bulletin</a></td></tr>
<tr><td>Mme MARTIN Sophie</td><td>Mars 2026</td><td>380,00 €</td><td><a href="/pdf/2">Télécharger le bulletin</a></td></tr>
<tr><td>M. DUPONT Jean</td><td>Février 2026</td><td>399,10 €</td><td><button onclick="location.href='/pdf/3'">Télécharger</button></td></tr>
</tbody></table><a href="/deconnexion">Se déconnecter</a></body></html>"""

CARTES = """<html><body><h2>Bulletins de salaire</h2>
<div class="carte"><p>DURAND Pierre</p><p>Période : 01/2026</p><p>Montant net : 250,00 €</p>
  <a href="/voir/4" target="_blank">Voir</a> <a href="/pdf/4" aria-label="Télécharger le bulletin de salaire">PDF</a></div>
<div class="carte"><p>DURAND Pierre</p><p>Période : 12/2025</p><p>Montant net : 260,00 €</p>
  <a href="/pdf/5" aria-label="Télécharger le bulletin de salaire">PDF</a></div>
</body></html>"""


class Serveur(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        if self.path.startswith("/pdf/"):
            corps = b"%PDF-1.4 bulletin " + self.path.encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/pdf")
            self.send_header("Content-Disposition", "attachment; filename=paje_bulletinsalaire.pdf")
            self.send_header("Content-Length", str(len(corps)))
            self.end_headers()
            self.wfile.write(corps)
            return
        corps = (TABLEAU if self.path == "/tableau" else CARTES).encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(corps)


serveur = ThreadingHTTPServer(("127.0.0.1", 0), Serveur)
threading.Thread(target=serveur.serve_forever, daemon=True).start()
url = f"http://127.0.0.1:{serveur.server_port}"

p = pajemploi.Pajemploi()
sortie = Path(tempfile.mkdtemp())
with sync_playwright() as pw:
    contexte = pw.chromium.launch_persistent_context(tempfile.mkdtemp(), headless=True, accept_downloads=True)
    p._contexte = contexte
    page = p._page = contexte.pages[0]

    page.goto(url + "/tableau")
    lignes = p._extraire_lignes(page)
    for l in lignes:
        print("tableau:", l["employeur"], l["periode"], "|", l["libelle"])
    assert sorted((l["employeur"], l["periode"]) for l in lignes) == [
        ("M. DUPONT Jean", "2026-02"), ("M. DUPONT Jean", "2026-03"), ("Mme MARTIN Sophie", "2026-03")]
    for i, l in enumerate(lignes):
        cible = sortie / f"t{i}.pdf"
        p._telecharger(page, l, cible)
        assert cible.read_bytes().startswith(b"%PDF"), cible
    print("téléchargements tableau OK")

    page.goto(url + "/cartes")
    lignes = p._extraire_lignes(page)
    for l in lignes:
        print("cartes:", l["employeur"], l["periode"], "|", l["libelle"])
    assert sorted((l["employeur"], l["periode"]) for l in lignes) == [
        ("DURAND Pierre", "2025-12"), ("DURAND Pierre", "2026-01")]
    assert all("charger" in l["libelle"].lower() or l["libelle"] == "PDF" for l in lignes)
    for i, l in enumerate(lignes):
        cible = sortie / f"c{i}.pdf"
        p._telecharger(page, l, cible)
        assert cible.read_bytes().startswith(b"%PDF"), cible
    print("téléchargements cartes OK")
    contexte.close()
serveur.shutdown()
print("extraction OK")
