"""Teste la lecture des bulletins et le téléchargement par l'API de Pajemploi,
avec un faux serveur local qui imite ses réponses (noms fictifs)."""
import base64
import json
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


def declaration(ident, periode, nom, prenom, enfant):
    return {"cdType": "BS", "libType": "Bulletin de salaire", "idDeclaration": ident, "periode": periode + "-01",
            "employeur": {"nom": nom, "prenoms": prenom}, "mntSalaireNetPaye": 400.0,
            "enfants": [{"nom": nom, "prenoms": enfant, "isGarde": True}]}


DONNEES = {
    2026: [declaration("D1", "2026-03", "DUPONT", "JEAN", "LEA"),
           declaration("D2", "2026-03", "MARTIN", "SOPHIE", "LUCAS"),
           declaration("D3", "2026-03", "MARTIN", "SOPHIE", "EMMA")],
    2025: [declaration("D4", "2025-12", "DUPONT", "JEAN", "LEA")],
}
appels = []


class Serveur(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _repondre(self, statut, corps, type_="application/json"):
        self.send_response(statut)
        self.send_header("Content-Type", type_)
        self.end_headers()
        self.wfile.write(corps)

    def do_GET(self):
        self._repondre(200, b"<html><body>Bulletins</body></html>", "text/html")

    def do_POST(self):
        corps = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        appels.append((self.path, self.headers.get("Authorization"), corps))
        if self.headers.get("Authorization") != "Bearer jeton-test":
            return self._repondre(401, b"{}")
        if self.path.endswith("documents/voletsSociaux/rechercher"):
            assert corps["typeDocuments"] == ["BS"]
            annee = int(corps["periodeDeclarationDebut"][:4])
            return self._repondre(200, json.dumps(DONNEES.get(annee, [])).encode())
        if self.path.endswith("documents/generer"):
            assert corps["codeParamDoc"] == "PAJE_BULLETIN_SALAIRE"
            ref = corps["criteresAggregation"][0]["value"]
            pdf = b"%PDF-1.4 bulletin " + ref.encode()
            return self._repondre(200, json.dumps({"documentData": base64.b64encode(pdf).decode()}).encode())
        self._repondre(404, b"{}")


serveur = ThreadingHTTPServer(("127.0.0.1", 0), Serveur)
threading.Thread(target=serveur.serve_forever, daemon=True).start()
url = f"http://127.0.0.1:{serveur.server_port}/"
pajemploi.URL_API = url + "paje/apaj/v1/"

p = pajemploi.Pajemploi()
with sync_playwright() as pw:
    contexte = pw.chromium.launch_persistent_context(tempfile.mkdtemp(), headless=True)
    p._contexte = contexte
    p._page = contexte.pages[0]
    p._page.goto(url)
    p._entetes_api = {"authorization": "Bearer jeton-test", "content-type": "application/json"}

    bulletins = p._lister_via_api()
    bulletins.sort(key=lambda x: x["idDeclaration"])
    for x in bulletins:
        print(x["idDeclaration"], x["employeur"], x["enfant"], x["periode"])
    assert [(x["employeur"], x["enfant"], x["periode"]) for x in bulletins] == [
        ("DUPONT JEAN", "Lea", "2026-03"), ("MARTIN SOPHIE", "Lucas", "2026-03"),
        ("MARTIN SOPHIE", "Emma", "2026-03"), ("DUPONT JEAN", "Lea", "2025-12")]
    # 2026, 2025, puis trois années vides : arrêt
    annees = [c[2]["periodeDeclarationDebut"][:4] for c in appels if "rechercher" in c[0]]
    assert annees == ["2026", "2025", "2024", "2023", "2022"], annees

    sortie = Path(tempfile.mkdtemp()) / "b.pdf"
    p._telecharger_via_api(bulletins[1], sortie)
    assert sortie.read_bytes() == b"%PDF-1.4 bulletin D2"
    contexte.close()
serveur.shutdown()
print("API OK")
