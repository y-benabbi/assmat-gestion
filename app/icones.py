"""Icônes des sites d'activités : récupérées sur le site lui-même (la plus grande proposée), puis gardées dans
donnees\\icones\\ pour ne pas les retélécharger. Un site sans icône est noté et réessayé une semaine plus tard."""
import hashlib
import re
import time
import urllib.parse
import urllib.request
from html.parser import HTMLParser

from chemins import DOSSIER_DONNEES

DOSSIER_ICONES = DOSSIER_DONNEES / "icones"
TAILLE_MAX = 1_000_000
REESSAI = 7 * 24 * 3600
ENTETES = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
                         "Chrome/126.0 Safari/537.36", "Accept-Language": "fr-FR,fr;q=0.9"}
TYPES = {b"\x89PNG": "image/png", b"\xff\xd8\xff": "image/jpeg", b"GIF8": "image/gif", b"RIFF": "image/webp",
         b"\x00\x00\x01\x00": "image/x-icon"}


class _Liens(HTMLParser):
    """Relève les <link rel="…icon…" href sizes> de la page d'accueil."""

    def __init__(self):
        super().__init__()
        self.icones = []

    def handle_starttag(self, tag, attrs):
        a = {k.lower(): (v or "") for k, v in attrs}
        rel = a.get("rel", "").lower()
        if tag == "link" and "icon" in rel and a.get("href"):
            tailles = [int(n) for n in re.findall(r"(\d+)x\d+", a.get("sizes", ""))]
            # apple-touch-icon : carrée et grande (faite pour les écrans d'accueil des téléphones).
            score = max(tailles, default=180 if "apple-touch" in rel else 32)
            svg = a.get("type", "").endswith("svg") or a["href"].lower().split("?")[0].endswith(".svg")
            self.icones.append((score, svg, a["href"]))


def _lire(url, limite=TAILLE_MAX, delai=8):
    with urllib.request.urlopen(urllib.request.Request(url, headers=ENTETES), timeout=delai) as r:
        return r.read(limite + 1), r.geturl()


def type_image(contenu: bytes) -> str:
    if contenu.lstrip()[:5].lower() in (b"<?xml", b"<svg ") or b"<svg" in contenu[:300].lower():
        return "image/svg+xml"
    return next((t for debut, t in TYPES.items() if contenu.startswith(debut)), "")


def candidats(url_site: str) -> list:
    """Adresses d'icônes à essayer, de la meilleure à la moins bonne."""
    liste = []
    try:
        page, finale = _lire(url_site, limite=600_000)
        lecteur = _Liens()
        lecteur.feed(page.decode("utf-8", "replace"))
        icones = sorted(lecteur.icones, key=lambda x: -x[0])
    except Exception:  # noqa: BLE001 — site injoignable : on essaie quand même les adresses habituelles
        finale, icones = url_site, []
    liste += [urllib.parse.urljoin(finale, h) for _, svg, h in icones if not svg]
    for chemin in ("/apple-touch-icon.png", "/apple-touch-icon-precomposed.png", "/favicon.ico"):
        liste.append(urllib.parse.urljoin(finale, chemin))
    # SVG en dernier : souvent un logo allongé plutôt qu'une icône carrée.
    liste += [urllib.parse.urljoin(finale, h) for _, svg, h in icones if svg]
    return list(dict.fromkeys(liste))


def _fichier(url_site: str):
    hote = urllib.parse.urlsplit(url_site).hostname or url_site
    return DOSSIER_ICONES / (re.sub(r"[^a-z0-9.-]", "_", hote.lower()) + "-" + hashlib.sha1(hote.encode()).hexdigest()[:8])


def icone(url_site: str):
    """(contenu, type) de l'icône du site, ou None. Résultat gardé en cache (absence comprise)."""
    if not url_site.lower().startswith(("http://", "https://")):
        return None
    base = _fichier(url_site)
    donnees, absent = base.with_suffix(".img"), base.with_suffix(".absent")
    if donnees.exists():
        contenu = donnees.read_bytes()
        return contenu, type_image(contenu)
    if absent.exists() and time.time() - absent.stat().st_mtime < REESSAI:
        return None
    DOSSIER_ICONES.mkdir(parents=True, exist_ok=True)
    for adresse in candidats(url_site):
        try:
            contenu, _ = _lire(adresse)
        except Exception:  # noqa: BLE001
            continue
        genre = type_image(contenu)
        if genre and len(contenu) <= TAILLE_MAX:
            donnees.write_bytes(contenu)
            absent.unlink(missing_ok=True)
            return contenu, genre
    absent.write_text(time.strftime("%Y-%m-%d"), encoding="utf-8")
    return None
