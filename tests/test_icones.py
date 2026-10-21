"""Teste la récupération des icônes des sites d'activités sur des sites imités (serveur local) : icône déclarée
dans la page, adresses habituelles, absence notée en cache, rien de retéléchargé ensuite."""
import os
import struct
import sys
import tempfile
import threading
import zlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ICI = Path(__file__).resolve().parent
os.environ["ASSMAT_BASE"] = tempfile.mkdtemp()
sys.path.insert(0, str(ICI.parent / "app"))

import icones  # noqa: E402


def png(taille, couleur):
    """Image PNG unie, sans bibliothèque."""
    ligne = b"\x00" + bytes(couleur) * taille
    brut = zlib.compress(ligne * taille)

    def bloc(genre, donnees):
        return struct.pack(">I", len(donnees)) + genre + donnees + struct.pack(">I", zlib.crc32(genre + donnees))
    return (b"\x89PNG\r\n\x1a\n" + bloc(b"IHDR", struct.pack(">IIBBBBB", taille, taille, 8, 2, 0, 0, 0))
            + bloc(b"IDAT", brut) + bloc(b"IEND", b""))


GRANDE, ICO = png(180, (230, 0, 35)), b"\x00\x00\x01\x00" + b"\x00" * 60
PAGES = {
    # Site 1 : icônes déclarées dans la page (la plus grande est choisie, le SVG en dernier).
    "/site1/": (b'<html><head><link rel="icon" href="/site1/petite.png" sizes="16x16">'
                b'<link rel="icon" type="image/svg+xml" href="/site1/logo.svg">'
                b'<link rel="apple-touch-icon" sizes="180x180" href="/site1/grande.png"></head></html>', "text/html"),
    "/site1/petite.png": (png(16, (0, 0, 0)), "image/png"),
    "/site1/grande.png": (GRANDE, "image/png"),
    # Site 2 : aucune icône déclarée, seulement /favicon.ico (à la racine du serveur).
    "/site2/": (b"<html><head><title>Site</title></head></html>", "text/html"),
    "/favicon.ico": (ICO, "image/x-icon"),
}
demandes = []


class Imitation(BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802
        demandes.append(self.path)
        contenu = PAGES.get(self.path)
        if not contenu or (self.path == "/favicon.ico" and not Imitation.favicon):
            self.send_response(404)
            self.end_headers()
            return
        self.send_response(200)
        self.send_header("Content-Type", contenu[1])
        self.end_headers()
        self.wfile.write(contenu[0])

    def log_message(self, *args):
        pass


Imitation.favicon = False


def main():
    serveur = ThreadingHTTPServer(("127.0.0.1", 0), Imitation)
    threading.Thread(target=serveur.serve_forever, daemon=True).start()
    racine = f"http://127.0.0.1:{serveur.server_port}"

    assert icones.candidats(racine + "/site1/")[:2] == [racine + "/site1/grande.png", racine + "/site1/petite.png"]
    assert icones.candidats(racine + "/site1/")[-1] == racine + "/site1/logo.svg"
    contenu, genre = icones.icone(racine + "/site1/")
    assert contenu == GRANDE and genre == "image/png"
    # Déjà en cache : plus aucune demande au site (même hôte et port que le site 2 : on ne teste le cache qu'ici).
    avant = len(demandes)
    assert icones.icone(racine + "/site1/")[0] == GRANDE and len(demandes) == avant

    # Site 2 (autre hôte : « localhost ») sans favicon : absence notée, pas de nouvel essai avant une semaine.
    autre = f"http://localhost:{serveur.server_port}/site2/"
    assert icones.icone(autre) is None
    Imitation.favicon = True
    assert icones.icone(autre) is None
    for f in icones.DOSSIER_ICONES.glob("localhost*.absent"):
        os.utime(f, (0, 0))                                 # une semaine plus tard…
    assert icones.icone(autre) == (ICO, "image/x-icon")
    assert icones.icone("javascript:alert(1)") is None and icones.type_image(b"<html>") == ""
    serveur.shutdown()
    print("OK : icônes des sites d'activités")


if __name__ == "__main__":
    main()
