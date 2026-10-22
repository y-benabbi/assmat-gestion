"""Icônes des sites d'activités : récupérées sur le site lui-même (la plus grande proposée), puis gardées dans
donnees\\icones\\ pour ne pas les retélécharger. Un site sans icône est noté et réessayé une semaine plus tard.
Aussi l'icône de l'application (celle du raccourci), affichée dans l'en-tête."""
import hashlib
import os
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


# ------------------------------------------------ icône de l'application
# Même icône que le raccourci « Assistante Maternelle » (scripts\installer.ps1, IconLocation) : à changer aux deux
# endroits. C'est une icône de Windows : lue sur le poste au premier affichage, jamais copiée dans le dépôt.
ICONE_RACCOURCI = ("imageres.dll", 170)
TAILLE_ICONE_APPLI = 128


def _extraire_icone_windows(fichier: str, index: int, taille: int) -> bytes:
    """PNG de l'icône n° index (comptée à partir de 0) d'un fichier .dll/.exe de Windows."""
    import ctypes
    import io
    from ctypes import wintypes

    from PIL import Image

    user32, gdi32 = ctypes.windll.user32, ctypes.windll.gdi32
    user32.PrivateExtractIconsW.argtypes = [wintypes.LPCWSTR, ctypes.c_int, ctypes.c_int, ctypes.c_int,
                                            ctypes.POINTER(wintypes.HICON), ctypes.POINTER(wintypes.UINT),
                                            wintypes.UINT, wintypes.UINT]
    user32.PrivateExtractIconsW.restype = wintypes.UINT

    class ICONINFO(ctypes.Structure):
        _fields_ = [("fIcon", wintypes.BOOL), ("xHotspot", wintypes.DWORD), ("yHotspot", wintypes.DWORD),
                    ("hbmMask", wintypes.HBITMAP), ("hbmColor", wintypes.HBITMAP)]

    class BITMAPINFOHEADER(ctypes.Structure):
        _fields_ = [("biSize", wintypes.DWORD), ("biWidth", wintypes.LONG), ("biHeight", wintypes.LONG),
                    ("biPlanes", wintypes.WORD), ("biBitCount", wintypes.WORD), ("biCompression", wintypes.DWORD),
                    ("biSizeImage", wintypes.DWORD), ("biXPelsPerMeter", wintypes.LONG),
                    ("biYPelsPerMeter", wintypes.LONG), ("biClrUsed", wintypes.DWORD),
                    ("biClrImportant", wintypes.DWORD)]

    user32.GetIconInfo.argtypes = [wintypes.HICON, ctypes.POINTER(ICONINFO)]
    user32.DestroyIcon.argtypes = [wintypes.HICON]
    user32.GetDC.argtypes = [wintypes.HWND]
    user32.GetDC.restype = wintypes.HDC
    user32.ReleaseDC.argtypes = [wintypes.HWND, wintypes.HDC]
    gdi32.GetDIBits.argtypes = [wintypes.HDC, wintypes.HBITMAP, wintypes.UINT, wintypes.UINT, ctypes.c_void_p,
                                ctypes.POINTER(BITMAPINFOHEADER), wintypes.UINT]
    gdi32.DeleteObject.argtypes = [wintypes.HGDIOBJ]

    chemin = os.path.join(os.environ.get("SystemRoot", r"C:\Windows"), "System32", fichier)
    hicon, ident = wintypes.HICON(), wintypes.UINT()
    if user32.PrivateExtractIconsW(chemin, index, taille, taille, ctypes.byref(hicon), ctypes.byref(ident), 1, 0) != 1 \
            or not hicon.value:
        raise OSError(f"Icône {index} introuvable dans {chemin}")
    info = ICONINFO()
    dc = user32.GetDC(None)
    try:
        if not user32.GetIconInfo(hicon, ctypes.byref(info)):
            raise OSError("Icône illisible")

        def pixels(bitmap):
            entete = BITMAPINFOHEADER(biSize=ctypes.sizeof(BITMAPINFOHEADER), biWidth=taille,
                                      biHeight=-taille, biPlanes=1, biBitCount=32, biCompression=0)
            tampon = ctypes.create_string_buffer(taille * taille * 4)
            if gdi32.GetDIBits(dc, bitmap, 0, taille, tampon, ctypes.byref(entete), 0) != taille:
                raise OSError("Icône illisible")
            return tampon.raw

        couleurs = pixels(info.hbmColor)
        image = Image.frombuffer("RGBA", (taille, taille), couleurs, "raw", "BGRA", 0, 1)
        if not any(couleurs[3::4]):
            # Ancienne icône sans transparence progressive : le masque dit quels points sont transparents.
            masque = Image.frombuffer("RGBA", (taille, taille), pixels(info.hbmMask), "raw", "BGRA", 0, 1)
            image.putalpha(masque.convert("L").point(lambda v: 0 if v else 255))
    finally:
        for bitmap in (info.hbmColor, info.hbmMask):
            if bitmap:
                gdi32.DeleteObject(bitmap)
        user32.ReleaseDC(None, dc)
        user32.DestroyIcon(hicon)
    sortie = io.BytesIO()
    image.save(sortie, "PNG")
    return sortie.getvalue()


def icone_application():
    """PNG de l'icône du raccourci, ou None (hors Windows, ou lecture impossible : le logo dessiné reste affiché).
    La lecture se fait dans un programme à part : une erreur de Windows ne peut pas arrêter l'application."""
    fichier, index = ICONE_RACCOURCI
    cache = DOSSIER_ICONES / f"application-{fichier.split('.')[0]}-{index}-{TAILLE_ICONE_APPLI}.png"
    if not cache.exists() and os.name == "nt":
        import subprocess
        import sys
        DOSSIER_ICONES.mkdir(parents=True, exist_ok=True)
        try:
            subprocess.run([sys.executable, __file__, str(cache)], timeout=30, capture_output=True,
                           creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        except (OSError, subprocess.SubprocessError):
            return None
    return cache.read_bytes() if cache.exists() else None


if __name__ == "__main__":
    # Appelé par icone_application() : écrit l'icône du raccourci dans le fichier donné.
    import sys
    from pathlib import Path
    cible = Path(sys.argv[1])
    provisoire = cible.with_suffix(".tmp")
    provisoire.write_bytes(_extraire_icone_windows(ICONE_RACCOURCI[0], ICONE_RACCOURCI[1], TAILLE_ICONE_APPLI))
    provisoire.replace(cible)
