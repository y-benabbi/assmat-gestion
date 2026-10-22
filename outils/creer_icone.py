"""Crée app/web/icone.ico (icône du raccourci « Assistante Maternelle ») à partir de app/web/icone.svg, le logo
affiché en haut du menu. À relancer si le logo change :
    python outils/creer_icone.py
Chaque taille est dessinée par Chromium (Playwright) pour rester nette, puis réunie en un seul .ico (Pillow)."""
import io
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

WEB = Path(__file__).resolve().parent.parent / "app" / "web"
TAILLES = (16, 20, 24, 32, 40, 48, 64, 96, 128, 256)


def main():
    svg = (WEB / "icone.svg").read_text(encoding="utf-8")
    images = []
    with sync_playwright() as p:
        navigateur = p.chromium.launch()
        page = navigateur.new_page()
        for taille in TAILLES:
            page.set_viewport_size({"width": taille, "height": taille})
            page.set_content(f'<html><body style="margin:0;background:transparent">'
                             f'{svg.replace("<svg ", f"<svg width={taille} height={taille} ", 1)}</body></html>')
            images.append(Image.open(io.BytesIO(page.screenshot(omit_background=True))).convert("RGBA"))
        navigateur.close()
    images[-1].save(WEB / "icone.ico", format="ICO", sizes=[(t, t) for t in TAILLES], append_images=images[:-1])
    print(f"Icône créée : {WEB / 'icone.ico'}")


if __name__ == "__main__":
    main()
