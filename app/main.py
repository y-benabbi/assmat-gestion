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
import re
import secrets
import socket
import subprocess
import sys
import threading
import time
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


def chemin_edge():
    """msedge.exe s'il est installé (présent sur Windows 10 et 11), sinon None."""
    if os.name != "nt":
        return None
    try:
        import winreg
        for racine in (winreg.HKEY_CURRENT_USER, winreg.HKEY_LOCAL_MACHINE):
            try:
                with winreg.OpenKey(racine, r"Software\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe") as cle:
                    chemin = winreg.QueryValue(cle, None)
                if chemin and os.path.isfile(chemin):
                    return chemin
            except OSError:
                pass
    except ImportError:
        pass
    for variable in ("ProgramFiles(x86)", "ProgramFiles", "LOCALAPPDATA"):
        chemin = os.path.join(os.environ.get(variable, ""), "Microsoft", "Edge", "Application", "msedge.exe")
        if os.environ.get(variable) and os.path.isfile(chemin):
            return chemin
    return None


def ouvrir_fenetre(url):
    """Ouvre la page dans une fenêtre à part, comme une application (Edge en mode application : ni barre d'adresse
    ni onglets, icône à elle dans la barre des tâches). Sans Edge, dans le navigateur habituel."""
    edge = chemin_edge()
    if edge:
        try:
            subprocess.Popen([edge, f"--app={url}", "--window-size=1400,900"], close_fds=True,
                             creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            return
        except OSError:
            pass
    webbrowser.open(url)


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

    import ateliers
    import bibliotheque
    import contrat_travail
    import courriers
    import donnees
    import icones
    import impots
    import parametres
    import photos
    import principal
    import revenus
    import vacances
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
        d = request.get_json(force=True)
        d.pop("dossier_principal", None)        # changé seulement par /api/principal (fichiers déplacés)
        p = parametres.enregistrer(d)
        p["mot_de_passe_enregistre"] = parametres.mot_de_passe_enregistre()
        return jsonify(p)

    @app.get("/api/vacances")
    def lire_vacances():
        """Vacances scolaires de l'académie choisie (calendrier officiel, gardé une semaine sur l'ordinateur)."""
        return jsonify(vacances.etat(forcer=request.args.get("actualiser") == "1"))

    @app.get("/api/academies")
    def academies():
        return jsonify([{"nom": n, "zone": z} for n, z in vacances.ACADEMIES.items()])

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
        # photo_profil : version de la photo de profil de l'enfant (vide sans photo) ; jamais enregistrée dans la fiche.
        profils = photos.profils()
        return jsonify([dict(c, photo_profil=profils.get(c.get("id"), "")) for c in donnees.contrats()])

    @app.post("/api/contrats")
    def ecrire_contrat():
        return jsonify(donnees.enregistrer_contrat(request.get_json(force=True)))

    @app.get("/api/brouillons")
    def lire_brouillons():
        return jsonify(donnees.brouillons())

    @app.post("/api/brouillons")
    def ecrire_brouillon():
        return jsonify(donnees.enregistrer_brouillon(request.get_json(force=True)))

    @app.post("/api/brouillons/supprimer")
    def supprimer_brouillon():
        donnees.supprimer_brouillon(request.get_json(force=True).get("id", ""))
        return jsonify({"ok": True})

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

        lignes = revenus.releve(parametres.charger().get("dossier_bulletins", ""))
        for l in lignes:
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
            "champs": {cle: valeurs(cle) for cle in ("enfant_nom", "tarif_horaire", "entretien_horaire", "repas_jour")},
            "taux_net": revenus.taux_net(lignes),
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

    @app.post("/api/contrat-travail")
    def creer_contrat_travail():
        """Contrat de travail sur le modèle de l'Urssaf : complet pour une fiche enfant, sinon version à
        remplir (rubriques de l'assistante maternelle seulement)."""
        demande = request.get_json(force=True)
        profil = donnees.profil()
        fiche = next((c for c in donnees.contrats() if c.get("id") == demande.get("contrat_id")), None)
        if demande.get("contrat_id") and not fiche:
            return jsonify({"erreur": "Fiche enfant introuvable."}), 404
        if fiche:
            famille = next((f for f in donnees.familles() if f["nom"].lower() == fiche["famille"].lower()), {})
            taux = revenus.taux_net(revenus.releve(parametres.charger().get("dossier_bulletins", "")))["taux"]
            valeurs = contrat_travail.valeurs_contrat(profil, famille, fiche, taux)
            manquants = contrat_travail.manquants(profil, famille, fiche)
        else:
            valeurs, manquants = contrat_travail.valeurs_assmat(profil), contrat_travail.manquants(profil)
        cible = dossier_courriers() / f"{courriers.nom_fichier(contrat_travail.nom_fichier(fiche))}.pdf"
        try:
            contrat_travail.remplir(valeurs, cible)
        except PermissionError:
            return jsonify({"erreur": "Le fichier est ouvert dans un autre programme : fermez-le puis recommencez."}), 409
        except Exception as e:
            return jsonify({"erreur": "Le PDF n'a pas pu être créé : " + str(e).splitlines()[0]}), 500
        courriers_generes.add(str(cible))
        if fiche:
            donnees.ajouter_document(fiche["id"], "contrat", "Contrat de travail", str(cible))
        return jsonify({"chemin": str(cible), "manquants": manquants})

    @app.post("/api/avenant-pdf")
    def creer_avenant_pdf():
        demande = request.get_json(force=True)
        fiche = next((c for c in donnees.contrats() if c.get("id") == demande.get("contrat_id")), None)
        if not fiche:
            return jsonify({"erreur": "Fiche enfant introuvable."}), 404
        famille = next((f for f in donnees.familles() if f["nom"].lower() == fiche["famille"].lower()), {})
        taux = revenus.taux_net(revenus.releve(parametres.charger().get("dossier_bulletins", "")))["taux"]
        numero = contrat_travail.numero_avenant(fiche, demande.get("avenant_id"))
        try:
            page = contrat_travail.html_avenant(donnees.profil(), famille, fiche, demande.get("avenant_id"), taux)
        except ValueError as e:
            return jsonify({"erreur": str(e)}), 404
        enfant = " ".join(x for x in (fiche.get("enfant_prenom"), fiche.get("enfant_nom")) if x)
        cible = dossier_courriers() / f"{courriers.nom_fichier(f'Avenant n° {numero} - {enfant}')}.pdf"
        try:
            courriers.generer_pdf(page, cible)
        except PermissionError:
            return jsonify({"erreur": "Le fichier est ouvert dans un autre programme : fermez-le puis recommencez."}), 409
        except Exception as e:
            return jsonify({"erreur": "Le PDF n'a pas pu être créé : " + str(e).splitlines()[0]}), 500
        courriers_generes.add(str(cible))
        donnees.ajouter_document(fiche["id"], "avenant", f"Avenant n° {numero}", str(cible))
        return jsonify({"chemin": str(cible), "manquants": []})

    @app.get("/api/documents")
    def lire_documents():
        return jsonify(donnees.documents(request.args.get("contrat_id", "")))

    @app.post("/api/action")
    def action():
        nom = request.get_json(force=True).get("action")
        if nom not in actions:
            return jsonify({"erreur": "action inconnue"}), 400
        if paje.occupe() and nom not in ("fermer", "diagnostic"):
            return jsonify({"erreur": "Une opération est déjà en cours."}), 409
        cibles = request.get_json(force=True).get("cibles")
        if nom == "telecharger_manquants" and isinstance(cibles, list):
            paje.demander(nom, cibles=[str(c) for c in cibles])      # un seul bulletin (menu d'une case)
        else:
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
        fichiers = bibliotheque.fichiers_dossier(d)
        return jsonify({"configure": True, "chemin": d, "clients": {k: list(v) for k, v in fichiers.items()},
                        "fichiers": fichiers})

    @app.post("/api/choisir-dossier")
    def choisir_dossier():
        import tkinter
        from tkinter import filedialog

        titre = str((request.get_json(silent=True) or {}).get("titre") or "Choisir un dossier")[:80]
        racine = tkinter.Tk()
        racine.withdraw()
        racine.attributes("-topmost", True)
        chemin = filedialog.askdirectory(title=titre)
        racine.destroy()
        return jsonify({"chemin": os.path.normpath(chemin) if chemin else ""})

    # ------------------------------------------------ dossier principal
    @app.get("/api/principal")
    def lire_principal():
        p = parametres.brut()
        anciens = [str(d) for d, _ in principal.anciens_dossiers(p) if d.is_dir()] if not p.get("dossier_principal") else []
        return jsonify({"principal": p.get("dossier_principal", ""), "proposition": principal.proposition(),
                        "anciens": anciens, "deplacement": principal.etat(),
                        "sous_dossiers": list(parametres.SOUS_DOSSIERS.values())})

    @app.post("/api/principal")
    def choisir_principal():
        try:
            principal.lancer(str(request.get_json(force=True).get("chemin") or ""))
        except ValueError as e:
            return jsonify({"erreur": str(e)}), 400
        return jsonify(principal.etat())

    # ------------------------------------------------ photos
    def envoyer_fichier(chemin, cache=True):
        from flask import send_file
        if not chemin or not Path(chemin).is_file():
            return jsonify({"erreur": "Introuvable"}), 404
        reponse = send_file(chemin, conditional=True)
        if cache:
            reponse.headers["Cache-Control"] = "private, max-age=86400"
        return reponse

    @app.get("/api/photos")
    def lire_photos():
        return jsonify(photos.lister())

    @app.post("/api/photos/ranger")
    def ranger_photos():
        d = request.get_json(force=True)
        try:
            return jsonify(photos.ranger([str(c) for c in d.get("cles") or []], [str(i) for i in d.get("enfants") or []],
                                         str(d.get("seance") or "")))
        except ValueError as e:
            return jsonify({"erreur": str(e)}), 400

    @app.post("/api/photos/rattacher")
    def rattacher_photos():
        d = request.get_json(force=True)
        return jsonify(photos.rattacher([str(n) for n in d.get("numeros") or []], str(d.get("seance") or "")))

    @app.post("/api/photos/modifier")
    def modifier_photo():
        d = request.get_json(force=True)
        try:
            return jsonify(photos.modifier(str(d.get("numero")), [str(i) for i in d.get("enfants") or []],
                                           str(d.get("seance") or "")))
        except (ValueError, photos.ModuleAbsent) as e:
            return jsonify({"erreur": str(e)}), 400
        except OSError as e:
            return jsonify({"erreur": f"Fichier inaccessible : {e}"}), 409

    @app.post("/api/photos/remettre")
    def remettre_photo():
        try:
            return jsonify(photos.remettre_a_trier(str(request.get_json(force=True).get("numero"))))
        except ValueError as e:
            return jsonify({"erreur": str(e)}), 400
        except OSError as e:
            return jsonify({"erreur": f"Fichier inaccessible : {e}"}), 409

    @app.post("/api/photos/ignorer")
    def ignorer_photos():
        d = request.get_json(force=True)
        photos.ignorer([str(c) for c in d.get("cles") or []], bool(d.get("ignorer", True)))
        return jsonify({"ok": True})

    @app.post("/api/photos/deposer")
    def deposer_photos():
        deposes, erreurs = [], []
        dates = request.form.getlist("modifie")
        for i, f in enumerate(request.files.getlist("fichiers")):
            try:
                deposes.append(photos.deposer(f.filename or "photo", f.read(), dates[i] if i < len(dates) else None))
            except ValueError as e:
                erreurs.append(str(e))
        return jsonify({"deposes": len(deposes), "erreurs": erreurs})

    @app.get("/api/photos/miniature")
    def miniature_photo():
        chemin = photos.chemin_a_trier(request.args.get("cle", "")) if request.args.get("cle") \
            else photos.chemin_range(request.args.get("numero", ""), affichable=False)
        return envoyer_fichier(photos.miniature(chemin) if chemin else None)

    @app.get("/api/photos/image")
    def image_photo():
        chemin = photos.chemin_a_trier(request.args.get("cle", "")) if request.args.get("cle") \
            else photos.chemin_range(request.args.get("numero", ""))
        return envoyer_fichier(chemin, cache=False)

    @app.post("/api/enfants/photo")
    def definir_photo_enfant():
        d = request.get_json(force=True)
        try:
            if not d.get("numero"):
                photos.retirer_profil(str(d.get("enfant") or ""))
                return jsonify({"enfant": d.get("enfant"), "photo": ""})
            return jsonify(photos.definir_profil(str(d.get("numero")), str(d.get("enfant") or "")))
        except ValueError as e:
            return jsonify({"erreur": str(e)}), 400
        except OSError as e:
            return jsonify({"erreur": f"Photo illisible : {e}"}), 409

    @app.get("/api/enfants/photo")
    def photo_enfant():
        ident = request.args.get("id", "")
        chemin = photos.PROFILS / f"{ident}.jpg" if re.fullmatch(r"[0-9a-zA-Z_-]{1,40}", ident) else None
        return envoyer_fichier(chemin)

    @app.post("/api/photos/supprimer")
    def supprimer_photos():
        d = request.get_json(force=True)
        return jsonify(photos.supprimer([str(c) for c in d.get("cles") or []], [str(n) for n in d.get("numeros") or []]))

    @app.post("/api/photos/ouvrir")
    def ouvrir_photo():
        d = request.get_json(force=True)
        chemin = photos.chemin_a_trier(str(d.get("cle"))) if d.get("cle") else photos.chemin_range(str(d.get("numero")), False)
        if not chemin or not chemin.is_file():
            return jsonify({"erreur": "Introuvable"}), 404
        if d.get("montrer"):
            subprocess.Popen(["explorer", "/select,", os.path.normpath(chemin)])
        else:
            os.startfile(chemin)
        return jsonify({"ok": True})

    @app.get("/api/photos/imprimer")
    def imprimer_photos():
        numeros = [n for n in request.args.get("numeros", "").split(",") if n.isdigit()]
        try:
            par_page = int(request.args.get("par_page") or 16)
        except ValueError:
            par_page = 16
        return photos.page_impression(numeros, par_page), 200, {"Content-Type": "text/html; charset=utf-8"}

    # ------------------------------------------------ activités (modèles et séances)
    @app.get("/api/ateliers")
    def lire_ateliers():
        index = photos._index()["photos"]
        par_seance, sans_realisation = {}, {}
        for numero, meta in index.items():
            if meta.get("seance"):
                par_seance.setdefault(meta["seance"], []).append(numero)
            elif meta.get("date"):
                sans_realisation.setdefault(meta["date"][:10], []).append(numero)
        liste = ateliers.activites()
        for a in liste:
            a["documents"] = ateliers.documents(a)
            for s in a["seances"]:
                s["photos"] = sorted(par_seance.get(s["id"], []))
        return jsonify({"activites": liste, "configure": bool(parametres.brut().get("dossier_principal")),
                        "sans_realisation": {j: sorted(n) for j, n in sans_realisation.items()}})

    def reponse_atelier(fonction, *args):
        try:
            return jsonify(fonction(*args) or {"ok": True})
        except ValueError as e:
            return jsonify({"erreur": str(e)}), 400

    @app.post("/api/ateliers")
    def ecrire_atelier():
        return reponse_atelier(ateliers.enregistrer, request.get_json(force=True))

    @app.post("/api/ateliers/supprimer")
    def supprimer_atelier():
        return reponse_atelier(ateliers.supprimer, str(request.get_json(force=True).get("id", "")))

    @app.post("/api/ateliers/seance")
    def ajouter_seance():
        d = request.get_json(force=True)
        return reponse_atelier(ateliers.ajouter_seance, str(d.get("activite", "")), str(d.get("date", "")),
                               bool(d.get("nouvelle")))

    @app.post("/api/ateliers/seance/modifier")
    def modifier_seance():
        d = request.get_json(force=True)
        return reponse_atelier(ateliers.modifier_seance, str(d.get("id", "")), d)

    @app.post("/api/ateliers/seance/supprimer")
    def supprimer_seance():
        return reponse_atelier(ateliers.supprimer_seance, str(request.get_json(force=True).get("id", "")))

    @app.post("/api/ateliers/document")
    def ajouter_document_atelier():
        ajoutes, erreurs = [], []
        for f in request.files.getlist("fichiers"):
            try:
                ajoutes.append(ateliers.ajouter_document(request.form.get("activite", ""), f.filename or "document", f.read()))
            except ValueError as e:
                erreurs.append(str(e))
        return jsonify({"ajoutes": ajoutes, "erreurs": erreurs})

    @app.post("/api/ateliers/ouvrir")
    def ouvrir_atelier():
        d = request.get_json(force=True)
        a = ateliers.activite(str(d.get("activite", "")))
        dossier_a = ateliers.dossier(a) if a else None
        if not dossier_a:
            return jsonify({"erreur": "Introuvable"}), 404
        if d.get("nom"):
            cible = next((doc["chemin"] for doc in ateliers.documents(a) if doc["nom"] == d["nom"]), None)
        else:
            dossier_a.mkdir(parents=True, exist_ok=True)
            cible = str(dossier_a)
        if not cible:
            return jsonify({"erreur": "Introuvable"}), 404
        os.startfile(cible)
        return jsonify({"ok": True})

    def fichier_connu(quoi):
        """Un fichier précis n'est ouvert que s'il fait partie de la dernière analyse, des bulletins lus pour
        le tableau de bord, des courriers ou des documents créés."""
        connus = {b.get("fichier_existant") for b in paje.lire_etat()["bulletins"]} | courriers_generes
        connus |= {d["chemin"] for d in donnees.documents()}
        connus |= {l["fichier"] for l in revenus.releve(parametres.charger().get("dossier_bulletins", ""))}
        return quoi if quoi in connus else None

    @app.post("/api/ouvrir")
    def ouvrir():
        quoi = request.get_json(force=True).get("quoi")
        dossiers_principal = {cle: str(parametres.dossier(cle) or "") for cle in ("photos", "activites", "a_trier", "sauvegarde")}
        for d in dossiers_principal.values():
            if d:
                Path(d).mkdir(parents=True, exist_ok=True)
        cible = {"bulletins": parametres.charger().get("dossier_bulletins", ""),
                 "courriers": str(dossier_courriers()) if dossier_courriers().is_dir() else "",
                 "principal": parametres.brut().get("dossier_principal", ""), **dossiers_principal,
                 "diagnostics": str(DIAGNOSTICS), "journaux": str(JOURNAUX)}.get(quoi) or fichier_connu(quoi)
        if cible and os.path.exists(cible):
            os.startfile(cible)
            return jsonify({"ok": True})
        return jsonify({"erreur": "Introuvable"}), 404

    @app.post("/api/montrer")
    def montrer():
        """Ouvre le dossier d'un fichier dans l'Explorateur, le fichier sélectionné."""
        cible = fichier_connu(request.get_json(force=True).get("quoi"))
        if cible and os.path.isfile(cible):
            subprocess.Popen(["explorer", "/select,", os.path.normpath(cible)])
            return jsonify({"ok": True})
        return jsonify({"erreur": "Introuvable"}), 404

    @app.get("/api/sites")
    def lire_sites():
        return jsonify(donnees.sites())

    @app.get("/api/icone-site")
    def icone_site():
        """Icône d'un des sites d'activités (récupérée sur le site puis gardée dans donnees\\icones)."""
        url = request.args.get("url", "")
        if url not in {s["url"] for s in donnees.sites()}:
            return jsonify({"erreur": "Site inconnu"}), 404
        trouve = icones.icone(url)
        if not trouve:
            return jsonify({"erreur": "Pas d'icône"}), 404
        reponse = app.response_class(trouve[0], mimetype=trouve[1])
        reponse.headers["Cache-Control"] = "private, max-age=86400"
        return reponse

    @app.post("/api/sites")
    def enregistrer_sites():
        try:
            return jsonify(donnees.enregistrer_sites(request.get_json(force=True)))
        except ValueError as e:
            return jsonify({"erreur": str(e)}), 400

    def lire_stable(chemin: str) -> bytes:
        """Fichier de la branche stable publiée. raw.githubusercontent.com garde ses fichiers 5 minutes en cache :
        juste après une publication, il donnait encore l'ancienne version. On demande donc d'abord à l'API de GitHub
        (à jour à la minute près), puis raw avec un paramètre qui change à chaque fois."""
        essais = [urllib.request.Request(
            f"https://api.github.com/repos/{DEPOT_GITHUB}/contents/{chemin}?ref={BRANCHE_STABLE}",
            headers={"Accept": "application/vnd.github.raw", "User-Agent": "assmat-gestion"}),
            urllib.request.Request(f"https://raw.githubusercontent.com/{DEPOT_GITHUB}/{BRANCHE_STABLE}/{chemin}"
                                   f"?t={int(time.time())}", headers={"Cache-Control": "no-cache"})]
        for requete in essais:
            try:
                with urllib.request.urlopen(requete, timeout=5) as r:
                    return r.read()
            except Exception:
                continue
        raise OSError("Version publiée inaccessible.")

    @app.get("/api/version")
    def version():
        locale = version_locale()
        distante = None
        try:
            distante = lire_stable("VERSION").decode().strip()
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
        try:
            return app.response_class(lire_stable("app/web/notes-versions.json"), mimetype="application/json")
        except Exception:
            return jsonify([])

    @app.post("/api/mettre-a-jour")
    def mettre_a_jour():
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
MODULES = ("flask", "playwright", "keyring", "pypdf", "PIL", "pillow_heif", "imageio_ffmpeg")


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
        ouvrir_fenetre(existante)
        return
    threading.Thread(target=installer_modules_manquants, daemon=True).start()
    port, jeton = preparer_serveur()
    app = creer_app(port, jeton)
    import principal
    threading.Thread(target=principal.sauvegarder, daemon=True).start()     # copie des fiches, une fois par jour
    ouvrir = lambda: ouvrir_fenetre(adresse(port, jeton))  # noqa: E731
    if "--apres-mise-a-jour" in sys.argv:
        # La page restée ouverte se recharge seule ; on n'ouvre un onglet que si elle a été fermée.
        threading.Timer(15, lambda: PAGE_OUVERTE.is_set() or ouvrir()).start()
    elif "--sans-navigateur" not in sys.argv:
        threading.Timer(1.2, ouvrir).start()
    app.run(host="127.0.0.1", port=port, debug=False, use_reloader=False, threaded=True)


if __name__ == "__main__":
    main()
