"""Point d'entrée : serveur web local + ouverture de la page dans le navigateur."""
import os
import sys
import threading
import urllib.request
import webbrowser
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from chemins import (AMORCE, BRANCHE_STABLE, DEPOT_GITHUB, DIAGNOSTICS, DOSSIER_WEB,  # noqa: E402
                     FICHIER_PROGRAMME, JOURNAUX, PORT, version_locale)

ADRESSE = f"http://127.0.0.1:{PORT}/"


def deja_lance():
    try:
        with urllib.request.urlopen(ADRESSE + "api/ping", timeout=1.5) as r:
            return r.read() == b"assistante-maternelle"
    except Exception:
        return False


def creer_app():
    from flask import Flask, jsonify, request, send_from_directory

    import bibliotheque
    import parametres
    from pajemploi import Pajemploi

    app = Flask(__name__, static_folder=None)
    paje = Pajemploi()
    actions = {"connecter_et_analyser", "telecharger_manquants", "ouvrir_visible",
               "analyser_page_affichee", "diagnostic", "fermer"}

    @app.get("/")
    def accueil():
        return send_from_directory(DOSSIER_WEB, "index.html")

    @app.get("/web/<path:nom>")
    def fichiers(nom):
        return send_from_directory(DOSSIER_WEB, nom)

    @app.get("/api/ping")
    def ping():
        return "assistante-maternelle"

    @app.get("/api/etat")
    def etat():
        return jsonify(paje.lire_etat())

    @app.get("/api/parametres")
    def lire_parametres():
        p = parametres.charger()
        p["mot_de_passe_enregistre"] = parametres.mot_de_passe_enregistre()
        return jsonify(p)

    @app.post("/api/parametres")
    def ecrire_parametres():
        p = parametres.enregistrer(request.get_json(force=True))
        p["mot_de_passe_enregistre"] = parametres.mot_de_passe_enregistre()
        return jsonify(p)

    @app.post("/api/apercu-nom")
    def apercu_nom():
        d = request.get_json(force=True)
        p = {"dossier_bulletins": d.get("dossier_bulletins") or "…",
             "format_fichier": d.get("format_fichier") or "", "format_dossier": d.get("format_dossier") or ""}
        return jsonify({"chemin": str(bibliotheque.chemin_cible(p, "DUPONT", "2025-03"))})

    @app.post("/api/action")
    def action():
        nom = request.get_json(force=True).get("action")
        if nom not in actions:
            return jsonify({"erreur": "action inconnue"}), 400
        if paje.occupe() and nom not in ("fermer", "diagnostic"):
            return jsonify({"erreur": "Une opération est déjà en cours."}), 409
        paje.demander(nom)
        return jsonify({"ok": True})

    @app.post("/api/code")
    def code():
        paje.fournir_code(request.get_json(force=True).get("code", ""))
        return jsonify({"ok": True})

    @app.get("/api/dossier")
    def dossier():
        d = parametres.charger().get("dossier_bulletins", "")
        if not d or not os.path.isdir(d):
            return jsonify({"configure": False, "clients": {}})
        return jsonify({"configure": True, "chemin": d, "clients": bibliotheque.resume_dossier(d)})

    @app.post("/api/choisir-dossier")
    def choisir_dossier():
        import tkinter
        from tkinter import filedialog

        racine = tkinter.Tk()
        racine.withdraw()
        racine.attributes("-topmost", True)
        chemin = filedialog.askdirectory(title="Dossier des bulletins de salaire")
        racine.destroy()
        return jsonify({"chemin": os.path.normpath(chemin) if chemin else ""})

    @app.post("/api/ouvrir")
    def ouvrir():
        quoi = request.get_json(force=True).get("quoi")
        cible = {"bulletins": parametres.charger().get("dossier_bulletins", ""),
                 "diagnostics": str(DIAGNOSTICS), "journaux": str(JOURNAUX)}.get(quoi)
        if not cible:
            # Un fichier précis : uniquement s'il fait partie de la dernière analyse.
            connus = {b.get("fichier_existant") for b in paje.lire_etat()["bulletins"]}
            cible = quoi if quoi in connus else None
        if cible and os.path.exists(cible):
            os.startfile(cible)
            return jsonify({"ok": True})
        return jsonify({"erreur": "Introuvable"}), 404

    @app.get("/api/version")
    def version():
        locale = version_locale()
        distante = None
        try:
            url = f"https://raw.githubusercontent.com/{DEPOT_GITHUB}/{BRANCHE_STABLE}/VERSION"
            with urllib.request.urlopen(url, timeout=5) as r:
                distante = r.read().decode().strip()
        except Exception:
            pass

        def tuple_version(v):
            try:
                return tuple(int(x) for x in v.split("."))
            except (AttributeError, ValueError):
                return None

        a, b = tuple_version(locale), tuple_version(distante)
        return jsonify({"locale": locale, "distante": distante,
                        "mise_a_jour": bool(a and b and b > a and AMORCE.exists())})

    @app.post("/api/mettre-a-jour")
    def mettre_a_jour():
        import subprocess

        if not AMORCE.exists():
            return jsonify({"erreur": "Programme de mise à jour introuvable."}), 404
        args = ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(AMORCE),
                "-Relancer"]
        if FICHIER_PROGRAMME.exists():
            args += ["-DossierProgramme", FICHIER_PROGRAMME.read_text(encoding="utf-8").strip()]
        subprocess.Popen(args, creationflags=subprocess.CREATE_NEW_CONSOLE)
        paje.demander("fermer")
        threading.Timer(1.5, lambda: os._exit(0)).start()
        return jsonify({"ok": True})

    @app.post("/api/quitter")
    def quitter():
        paje.demander("fermer")
        threading.Timer(1.0, lambda: os._exit(0)).start()
        return jsonify({"ok": True})

    return app


def main():
    if deja_lance():
        webbrowser.open(ADRESSE)
        return
    app = creer_app()
    if "--sans-navigateur" not in sys.argv:
        threading.Timer(1.2, lambda: webbrowser.open(ADRESSE)).start()
    app.run(host="127.0.0.1", port=PORT, debug=False, use_reloader=False, threaded=True)


if __name__ == "__main__":
    main()
