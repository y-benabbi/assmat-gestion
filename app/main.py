"""Point d'entrée : serveur web local + ouverture de la page dans le navigateur.

Chaque session Windows a son propre serveur : port propre à la session et clé secrète
(« jeton ») rangée dans %LOCALAPPDATA%\\assmat-gestion\\serveur.json, lisible par cette session
seulement. Le navigateur reçoit le jeton à l'ouverture (cookie) ; toute requête sans jeton est
refusée. Ainsi une autre session du même PC ne peut ni ouvrir ni piloter cette application.
"""
import getpass
import hmac
import json
import os
import secrets
import socket
import sys
import threading
import urllib.request
import webbrowser
import zlib
from datetime import date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from chemins import (AMORCE, BRANCHE_STABLE, DEPOT_GITHUB, DIAGNOSTICS, DOSSIER_WEB,  # noqa: E402
                     FICHIER_PROGRAMME, FICHIER_SERVEUR, JOURNAUX, PORT_FORCE, RACINE_CODE, version_locale)

# Passe à vrai dès qu'une page de l'application interroge le serveur.
PAGE_OUVERTE = threading.Event()
IDENTITE = f"assistante-maternelle:{getpass.getuser().lower()}"


def lire_serveur():
    try:
        return json.loads(FICHIER_SERVEUR.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def port_libre(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(("127.0.0.1", port))
            return True
        except OSError:
            return False


def preparer_serveur():
    """Port et jeton de cette session (réutilisés d'un lancement à l'autre)."""
    info = lire_serveur()
    jeton = info.get("jeton") or secrets.token_urlsafe(32)
    if PORT_FORCE:
        port = PORT_FORCE
    else:
        # Port de départ propre à l'utilisateur, puis le premier port libre.
        prefere = info.get("port") or 8700 + zlib.crc32(getpass.getuser().lower().encode()) % 800
        port = next((p for p in [prefere] + list(range(8700, 9500)) if port_libre(p)), prefere)
    FICHIER_SERVEUR.write_text(json.dumps({"port": port, "jeton": jeton}), encoding="utf-8")
    return port, jeton


def adresse(port, jeton=None):
    return f"http://127.0.0.1:{port}/" + (f"?jeton={jeton}" if jeton else "")


def deja_lance():
    """Adresse de l'application de CETTE session si elle tourne déjà, sinon None."""
    info = lire_serveur()
    if not info.get("port") or not info.get("jeton") or PORT_FORCE:
        return None
    try:
        requete = urllib.request.Request(adresse(info["port"]) + "api/ping",
                                         headers={"X-Jeton": info["jeton"]})
        with urllib.request.urlopen(requete, timeout=1.5) as r:
            if r.read().decode() == IDENTITE:
                return adresse(info["port"], info["jeton"])
    except Exception:
        pass
    return None


PAGE_REFUSEE = """<!doctype html><html lang="fr"><meta charset="utf-8"><title>Assistante Maternelle</title>
<body style="font-family:sans-serif;max-width:560px;margin:80px auto;padding:0 16px;color:#3a3552">
<h1>Accès refusé</h1><p>Ouvrez l'application avec son raccourci « Assistante Maternelle ».</p>
<p style="color:#6f6a86">Cette page appartient peut-être à une autre session Windows de cet ordinateur.</p>
</body></html>"""


def creer_app(port, jeton):
    from flask import Flask, jsonify, make_response, redirect, request, send_from_directory

    import bibliotheque
    import courriers
    import donnees
    import impots
    import parametres
    import revenus
    from pajemploi import Pajemploi

    app = Flask(__name__, static_folder=None)
    paje = Pajemploi()
    actions = {"connecter_et_analyser", "telecharger_manquants", "ouvrir_visible",
               "analyser_page_affichee", "diagnostic", "fermer"}
    cookie = f"assmat_jeton_{port}"

    def jeton_valide(valeur):
        return bool(valeur) and hmac.compare_digest(valeur, jeton)

    @app.before_request
    def verifier_jeton():
        # Ouverture par le raccourci : le jeton arrive dans l'adresse, on le garde en cookie.
        if request.path == "/" and jeton_valide(request.args.get("jeton")):
            reponse = make_response(redirect("/"))
            reponse.set_cookie(cookie, jeton, httponly=True, samesite="Strict")
            return reponse
        if not (jeton_valide(request.cookies.get(cookie)) or jeton_valide(request.headers.get("X-Jeton"))):
            return PAGE_REFUSEE, 403
        return None

    @app.get("/")
    def accueil():
        return send_from_directory(DOSSIER_WEB, "index.html")

    @app.get("/web/<path:nom>")
    def fichiers(nom):
        return send_from_directory(DOSSIER_WEB, nom)

    @app.get("/api/ping")
    def ping():
        return IDENTITE

    @app.get("/api/etat")
    def etat():
        PAGE_OUVERTE.set()
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
        """Exemple de rangement avec des familles fictives, pour l'aperçu des paramètres."""
        d = request.get_json(force=True)
        racine = d.get("dossier_bulletins") or "Bulletins de salaire"
        p = {"dossier_bulletins": racine, "format_fichier": d.get("format_fichier") or "",
             "organisation": d.get("organisation") or "client"}
        exemples = [("Dupont", "2025-12"), ("Dupont", "2026-01"), ("Martin", "2026-01")]
        chemins = [bibliotheque.chemin_cible(p, client, periode) for client, periode in exemples]
        return jsonify({
            "chemin": str(chemins[0]),
            "racine": Path(racine).name or racine,
            "fichiers": [list(c.relative_to(racine).parts) for c in chemins],
        })

    # ------------------------------------------------ profil, contrats, échéances
    @app.get("/api/profil")
    def lire_profil():
        return jsonify(donnees.profil())

    @app.post("/api/profil")
    def ecrire_profil():
        return jsonify(donnees.enregistrer_profil(request.get_json(force=True)))

    @app.get("/api/familles")
    def lire_familles():
        # Les familles des bulletins ont leur fiche, créée ou complétée d'après le bulletin le plus récent.
        donnees.completer_familles(revenus.releve(parametres.charger().get("dossier_bulletins", "")))
        return jsonify(donnees.familles())

    @app.post("/api/familles")
    def ecrire_famille():
        try:
            return jsonify(donnees.enregistrer_famille(request.get_json(force=True)))
        except ValueError as e:
            return jsonify({"erreur": str(e)}), 400

    @app.post("/api/familles/supprimer")
    def supprimer_famille():
        try:
            donnees.supprimer_famille(request.get_json(force=True).get("id", ""))
        except ValueError as e:
            return jsonify({"erreur": str(e)}), 400
        return jsonify({"ok": True})

    @app.get("/api/contrats")
    def lire_contrats():
        return jsonify(donnees.contrats())

    @app.post("/api/contrats")
    def ecrire_contrat():
        return jsonify(donnees.enregistrer_contrat(request.get_json(force=True)))

    @app.post("/api/contrats/supprimer")
    def supprimer_contrat():
        donnees.supprimer_contrat(request.get_json(force=True).get("id", ""))
        return jsonify({"ok": True})

    @app.get("/api/suggestions")
    def lire_suggestions():
        """Valeurs déjà connues, proposées pendant la saisie des fiches : familles des bulletins
        (dossiers, Pajemploi), parents et enfants qui y figurent, et valeurs des autres fiches.
        Un parent : {"civilite", "prenom", "nom"}."""
        familles = {}

        def famille(nom):
            nom = (nom or "").strip()
            if not nom or nom.startswith("("):
                return None
            return familles.setdefault(nom.lower(), {"nom": nom, "parents": {}, "enfants": set(), "fiche": False})

        def parent(f, civilite, prenom, nom):
            p = {"civilite": civilite, "prenom": prenom.strip().title(), "nom": nom.strip().title()}
            if p["nom"] or p["prenom"]:
                f["parents"].setdefault((p["prenom"].lower(), p["nom"].lower()), p)

        for l in revenus.releve(parametres.charger().get("dossier_bulletins", "")):
            f = famille(l["famille"])
            if f and l.get("employeur"):
                # « Mme Claire Dupont » : civilité, prénom, puis nom.
                mots = l["employeur"].split()
                civ = mots.pop(0) if mots and mots[0] in ("Mme", "M.") else ""
                parent(f, civ, mots[0] if len(mots) > 1 else "", " ".join(mots[1:] if len(mots) > 1 else mots))
        for b in paje.lire_etat()["bulletins"]:
            f = famille(b.get("client"))
            if f:
                if b.get("employeur_nom"):
                    parent(f, "", b.get("employeur_prenom", ""), b["employeur_nom"])
                for prenom in (b.get("enfant") or "").split(", "):
                    if prenom:
                        f["enfants"].add(prenom)
        for fiche in donnees.familles():
            f = famille(fiche["nom"])
            if f:
                f["fiche"] = bool(fiche.get("id"))
        contrats = donnees.contrats()
        for c in contrats:
            f = famille(c.get("famille"))
            if f and c.get("enfant_prenom"):
                f["enfants"].add(c["enfant_prenom"])
        valeurs = lambda cle: sorted({str(c.get(cle)).strip() for c in contrats if str(c.get(cle) or "").strip()})
        return jsonify({
            "familles": [{"nom": f["nom"], "parents": list(f["parents"].values()), "enfants": sorted(f["enfants"]),
                          "fiche": f["fiche"]} for _, f in sorted(familles.items())],
            "champs": {cle: valeurs(cle) for cle in ("enfant_nom", "tarif_horaire", "entretien_jour")},
        })

    @app.get("/api/echeances")
    def lire_echeances():
        return jsonify(donnees.echeances(date.today()))

    @app.get("/api/revenus")
    def lire_revenus():
        lignes = revenus.releve(parametres.charger().get("dossier_bulletins", ""))
        annee = request.args.get("annee") or (max(l["periode"][:4] for l in lignes) if lignes else str(date.today().year))
        return jsonify(revenus.totaux(lignes, annee))

    # ------------------------------------------------ impôts
    @app.get("/api/impots")
    def lire_impots():
        lignes = revenus.releve(parametres.charger().get("dossier_bulletins", ""))
        annees = sorted({l["periode"][:4] for l in lignes}, reverse=True)
        # Par défaut : l'année dernière (celle que l'on déclare au printemps), sinon la plus récente.
        defaut = str(date.today().year - 1)
        annee = request.args.get("annee") or (defaut if defaut in annees else (annees[0] if annees else defaut))
        return jsonify(impots.calculer(annee, lignes) | {"annees": annees or [annee]})

    @app.post("/api/impots/jours")
    def confirmer_jours():
        d = request.get_json(force=True)
        try:
            impots.confirmer(str(d["annee"]), str(d["contrat_id"]), str(d["mois"]), d.get("valeurs"))
        except (KeyError, ValueError) as e:
            return jsonify({"erreur": f"Données incomplètes : {e}"}), 400
        return jsonify({"ok": True})

    @app.get("/api/bareme")
    def lire_bareme():
        return jsonify(impots.bareme())

    # ------------------------------------------------ courriers
    courriers_generes = set()

    def dossier_courriers():
        p = parametres.charger()
        if p.get("dossier_courriers"):
            return Path(p["dossier_courriers"])
        if p.get("dossier_bulletins"):
            return Path(p["dossier_bulletins"]).parent / "Courriers"
        return Path.home() / "Documents" / "Courriers"

    @app.post("/api/courriers/derogation")
    def proposer_derogation():
        return jsonify(courriers.proposer_derogation(request.get_json(force=True)))

    @app.post("/api/courriers/apercu")
    def apercu_courrier():
        return courriers.html_derogation(request.get_json(force=True)), 200, {"Content-Type": "text/html; charset=utf-8"}

    @app.post("/api/courriers/pdf")
    def pdf_courrier():
        texte = request.get_json(force=True)
        nom = courriers.nom_fichier(f"{date.today().isoformat()} - {texte.get('objet') or 'Courrier'}"
                                    + (f" - {texte['enfant']}" if texte.get("enfant") else ""))
        cible = dossier_courriers() / f"{nom}.pdf"
        try:
            courriers.generer_pdf(courriers.html_derogation(texte), cible)
        except Exception as e:
            return jsonify({"erreur": "Le PDF n'a pas pu être créé : " + str(e).splitlines()[0]}), 500
        courriers_generes.add(str(cible))
        return jsonify({"chemin": str(cible)})

    @app.post("/api/action")
    def action():
        nom = request.get_json(force=True).get("action")
        if nom not in actions:
            return jsonify({"erreur": "action inconnue"}), 400
        if paje.occupe() and nom not in ("fermer", "diagnostic"):
            return jsonify({"erreur": "Une opération est déjà en cours."}), 409
        paje.demander(nom)
        return jsonify({"ok": True})

    @app.post("/api/interrompre")
    def interrompre():
        if not paje.interrompre():
            return jsonify({"erreur": "Aucun téléchargement en cours."}), 409
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
                 "courriers": str(dossier_courriers()) if dossier_courriers().is_dir() else "",
                 "diagnostics": str(DIAGNOSTICS), "journaux": str(JOURNAUX)}.get(quoi)
        if not cible:
            # Un fichier précis : uniquement s'il fait partie de la dernière analyse, des bulletins
            # lus pour le tableau de bord ou des courriers créés.
            connus = {b.get("fichier_existant") for b in paje.lire_etat()["bulletins"]} | courriers_generes
            connus |= {l["fichier"] for l in revenus.releve(parametres.charger().get("dossier_bulletins", ""))}
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

    @app.get("/api/notes-distantes")
    def notes_distantes():
        """Notes de la version stable publiée (pour présenter une mise à jour disponible)."""
        url = f"https://raw.githubusercontent.com/{DEPOT_GITHUB}/{BRANCHE_STABLE}/app/web/notes-versions.json"
        try:
            with urllib.request.urlopen(url, timeout=5) as r:
                return app.response_class(r.read(), mimetype="application/json")
        except Exception:
            return jsonify([])

    @app.post("/api/mettre-a-jour")
    def mettre_a_jour():
        import subprocess

        if not AMORCE.exists():
            return jsonify({"erreur": "Programme de mise à jour introuvable."}), 404
        if paje.occupe():
            return jsonify({"erreur": "Une opération Pajemploi est en cours : attendez qu'elle se termine."}), 409
        args =["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(AMORCE),
                "-Relancer"]
        if FICHIER_PROGRAMME.exists():
            args += ["-DossierProgramme", FICHIER_PROGRAMME.read_text(encoding="utf-8-sig").strip()]
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


# Modules Python nécessaires (requirements.txt) : nom à importer.
MODULES = ("flask", "playwright", "keyring", "pypdf")


def installer_modules_manquants():
    """Une nouvelle version peut demander un module de plus (pypdf depuis la 1.4.0). Si la mise à jour
    ne l'a pas installé, on l'installe ici, en arrière-plan : la rubrique Revenus le signale en attendant."""
    import importlib.util
    import subprocess

    manquants = [m for m in MODULES if importlib.util.find_spec(m) is None]
    if not manquants:
        return
    commande = [sys.executable, "-m", "pip", "install", "--disable-pip-version-check", "--quiet",
                "-r", str(RACINE_CODE / "requirements.txt")]
    try:
        r = subprocess.run(commande, capture_output=True, text=True, timeout=600,
                           creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        bilan = "installés" if r.returncode == 0 else f"échec (code {r.returncode}) : {r.stderr.strip()[-500:]}"
    except Exception as e:
        bilan = f"échec : {e}"
    importlib.invalidate_caches()
    with open(JOURNAUX / f"{datetime.now():%Y-%m}.log", "a", encoding="utf-8") as f:
        f.write(f"{datetime.now():%Y-%m-%d %H:%M:%S} Modules manquants ({', '.join(manquants)}) : {bilan}\n")


def main():
    existante = deja_lance()
    if existante:
        webbrowser.open(existante)
        return
    threading.Thread(target=installer_modules_manquants, daemon=True).start()
    port, jeton = preparer_serveur()
    app = creer_app(port, jeton)
    ouvrir = lambda: webbrowser.open(adresse(port, jeton))  # noqa: E731
    if "--apres-mise-a-jour" in sys.argv:
        # La page restée ouverte se recharge seule ; on n'ouvre un onglet que si elle a été fermée.
        threading.Timer(15, lambda: PAGE_OUVERTE.is_set() or ouvrir()).start()
    elif "--sans-navigateur" not in sys.argv:
        threading.Timer(1.2, ouvrir).start()
    app.run(host="127.0.0.1", port=port, debug=False, use_reloader=False, threaded=True)


if __name__ == "__main__":
    main()
