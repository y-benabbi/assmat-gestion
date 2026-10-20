"""Pilotage du site Pajemploi avec un navigateur automatisé (Playwright).

Toutes les actions sur le navigateur se font dans UN seul fil d'exécution
(Playwright l'exige) ; l'interface web dépose des commandes dans une file et
lit l'état partagé.

Connexion : page login.urssaf.fr (champs « Identifiant » et « Mot de passe »).
Vérifications supplémentaires gérées :
  * code reçu par courriel / SMS : l'application le demande dans sa page web,
    puis le saisit sur Pajemploi ;
  * toute autre étape (question, captcha, choix d'appareil…) : une fenêtre de
    navigateur visible s'ouvre et l'utilisatrice termine elle-même l'étape ;
    l'application reprend la main dès que la connexion est établie.
Le profil du navigateur est conservé, ce qui permet à Pajemploi de reconnaître
l'appareil et limite les vérifications aux connexions suivantes.
"""
import json
import queue
import re
import threading
import time
import traceback
from datetime import datetime
from pathlib import Path
from urllib.parse import urljoin, urlparse

import bibliotheque
import parametres
from chemins import DIAGNOSTICS, PROFIL_NAVIGATEUR, JOURNAUX

URL_ACCUEIL = "https://www.pajemploi.urssaf.fr/"
HOTE_CONNEXION = "login.urssaf.fr"

RE_CODE = re.compile(r"code|otp|verif|securit|totp|pin", re.I)
RE_BULLETIN = re.compile(r"bulletin", re.I)
RE_TELECHARGER = re.compile(r"bulletin|t[ée]l[ée]charg|pdf|visualiser|consulter|voir", re.I)
RE_MONTANT = re.compile(r"\d+[,.]\d{2}\s*€|€\s*\d")
RE_BRUIT = re.compile(
    r"bulletin|t[ée]l[ée]charg|pdf|salaire|net|brut|montant|p[ée]riode|d[ée]claration|"
    r"statut|valid|pay[ée]|heures?|visualiser|consulter|voir|cotisations|€|^\W*$",
    re.I,
)


class Pajemploi:
    def __init__(self):
        self.etat = {
            "phase": "deconnecte",   # deconnecte, connexion, code_requis, verification_manuelle,
                                      # connecte, analyse, telechargement, erreur
            "message": "Non connecté.",
            "detail_code": "",
            "bulletins": [],
            "derniere_analyse": None,
            "progression": None,
            "journal": [],
        }
        self._verrou = threading.Lock()
        self._commandes = queue.Queue()
        self._codes = queue.Queue()
        self._pw = None
        self._contexte = None
        self._page = None
        self._visible = False
        self._url_liste = None
        self._reponses_json = []
        threading.Thread(target=self._boucle, daemon=True, name="pajemploi").start()

    # ------------------------------------------------------------------ état
    def _maj(self, **kw):
        with self._verrou:
            self.etat.update(kw)

    def log(self, texte):
        ligne = f"{datetime.now():%H:%M:%S}  {texte}"
        with self._verrou:
            self.etat["journal"] = (self.etat["journal"] + [ligne])[-200:]
        with open(JOURNAUX / f"{datetime.now():%Y-%m}.log", "a", encoding="utf-8") as f:
            f.write(f"{datetime.now():%Y-%m-%d} {ligne}\n")

    def lire_etat(self):
        with self._verrou:
            return json.loads(json.dumps(self.etat))

    # ----------------------------------------------------- commandes (API)
    def occupe(self):
        return self.etat["phase"] in ("connexion", "analyse", "telechargement", "code_requis",
                                       "verification_manuelle")

    def demander(self, commande, **args):
        self._commandes.put((commande, args))

    def fournir_code(self, code):
        self._codes.put(code.strip())

    # ------------------------------------------------------- fil Playwright
    def _boucle(self):
        while True:
            commande, args = self._commandes.get()
            try:
                getattr(self, "_cmd_" + commande)(**args)
            except Exception as e:  # noqa: BLE001
                self.log("ERREUR : " + str(e).splitlines()[0])
                with open(JOURNAUX / "erreurs.log", "a", encoding="utf-8") as f:
                    f.write(f"--- {datetime.now()}\n{traceback.format_exc()}\n")
                self._maj(phase="erreur", message=f"Erreur : {str(e).splitlines()[0]}",
                          progression=None)
                self._sauver_diagnostic("erreur")

    def _ouvrir_navigateur(self, visible):
        """Ouvre le navigateur (ou réutilise celui déjà ouvert).

        Pajemploi refuse les navigateurs sans fenêtre (« headless ») : on ouvre donc
        toujours une vraie fenêtre, simplement réduite dans la barre des tâches quand
        l'utilisatrice n'a pas besoin de la voir.
        """
        if self._contexte and (not self._page or self._page.is_closed()):
            self._fermer_navigateur()   # fenêtre fermée à la main : on repart de zéro
        if self._contexte:
            if visible:
                self._montrer_fenetre()
            return
        from playwright.sync_api import sync_playwright

        if not self._pw:
            self._pw = sync_playwright().start()
        PROFIL_NAVIGATEUR.mkdir(parents=True, exist_ok=True)
        self._contexte = self._pw.chromium.launch_persistent_context(
            str(PROFIL_NAVIGATEUR),
            headless=False,
            args=[] if visible else ["--start-minimized"],
            accept_downloads=True,
            locale="fr-FR",
            no_viewport=True,
        )
        self._contexte.on("response", self._noter_reponse)
        self._page = self._contexte.pages[0] if self._contexte.pages else self._contexte.new_page()
        self._visible = visible

    def _montrer_fenetre(self):
        """Affiche au premier plan la fenêtre du navigateur (étape à faire à la main)."""
        if not self._page:
            return
        try:
            cdp = self._contexte.new_cdp_session(self._page)
            fenetre = cdp.send("Browser.getWindowForTarget")["windowId"]
            cdp.send("Browser.setWindowBounds", {"windowId": fenetre, "bounds": {"windowState": "normal"}})
            cdp.detach()
        except Exception:
            pass
        self._page.bring_to_front()
        self._visible = True

    def _fermer_navigateur(self):
        if self._contexte:
            try:
                self._contexte.close()
            except Exception:
                pass
        self._contexte = None
        self._page = None

    def _noter_reponse(self, reponse):
        """Garde les réponses JSON de Pajemploi pour le mode diagnostic."""
        try:
            if "json" in (reponse.headers.get("content-type") or "") and "urssaf" in reponse.url:
                self._reponses_json.append({"url": reponse.url, "statut": reponse.status,
                                            "contenu": reponse.text()[:20000]})
                self._reponses_json = self._reponses_json[-60:]
        except Exception:
            pass

    # ------------------------------------------------------------ connexion
    def _cmd_fermer(self):
        self._fermer_navigateur()
        self._maj(phase="deconnecte", message="Navigateur fermé.")

    def _verifier_dossier(self):
        dossier = parametres.charger().get("dossier_bulletins", "").strip()
        if not dossier or not Path(dossier).is_dir():
            raise RuntimeError("Choisissez d'abord le dossier des bulletins de salaire (onglet Paramètres).")

    def _cmd_connecter_et_analyser(self):
        self._verifier_dossier()
        self._connecter()
        self._analyser()

    def _cmd_analyser_page_affichee(self):
        """Mode assisté : l'utilisatrice a ouvert elle-même la page des bulletins."""
        if not self._page:
            raise RuntimeError("Aucun navigateur ouvert. Cliquez d'abord sur « Ouvrir Pajemploi ».")
        self._verifier_dossier()
        self._maj(phase="analyse", message="Lecture de la page affichée…")
        self._lire_liste(self._page)

    def _cmd_ouvrir_visible(self):
        """Ouvre une fenêtre visible, connectée si possible, pour naviguer à la main."""
        self._ouvrir_navigateur(True)
        self._connecter(forcer_visible=True)
        self._maj(phase="connecte",
                  message="Fenêtre Pajemploi ouverte. Allez sur la page des bulletins de salaire, "
                          "puis cliquez sur « Analyser la page affichée ».")

    def _connecter(self, forcer_visible=False):
        params = parametres.charger()
        identifiant = params.get("identifiant", "").strip()
        mdp = parametres.mot_de_passe()
        if not identifiant or not mdp:
            raise RuntimeError("Identifiant ou mot de passe Pajemploi manquant (onglet Paramètres).")

        visible = forcer_visible or bool(params.get("navigateur_visible"))
        self._ouvrir_navigateur(visible)
        self._maj(phase="connexion", message="Connexion à Pajemploi…")
        self.log("Ouverture de Pajemploi")
        page = self._page
        page.goto(URL_ACCUEIL, wait_until="domcontentloaded", timeout=60000)
        self._attendre_stable(page)

        if not self._sur_page_connexion(page):
            if self._semble_connecte(page):
                self.log("Session déjà ouverte")
                self._maj(phase="connecte", message="Connecté à Pajemploi.")
                return
            # Page d'accueil publique : chercher le bouton de connexion.
            self._cliquer_texte(page, r"se connecter|connexion|espace salari|mon espace")
            self._attendre_stable(page)

        self._refuser_cookies(page)
        if self._sur_page_connexion(page):
            self.log("Saisie des identifiants")
            champ_id = page.locator("#mail, input[name=username], input[autocomplete=username]").first
            champ_id.wait_for(timeout=30000)
            champ_id.fill(identifiant)
            page.locator("#password, input[type=password]").first.fill(mdp)
            page.locator("button[type=submit]", has_text=re.compile("connecter", re.I)).first.click()
            self._attendre_stable(page)

        self._suivre_verifications(page)

    def _suivre_verifications(self, page, delai_manuel=600):
        """Après l'envoi des identifiants : erreurs, code de vérification, étape manuelle."""
        debut = time.time()
        etape_manuelle = False
        while True:
            if self._semble_connecte(page):
                self.log("Connexion réussie")
                self._maj(phase="connecte", message="Connecté à Pajemploi.", detail_code="")
                return

            erreur = self._message_erreur(page)
            if erreur and not etape_manuelle:
                raise RuntimeError(f"Pajemploi refuse la connexion : {erreur}")

            champs_code = self._champs_code(page)
            if champs_code and not etape_manuelle:
                self._demander_et_saisir_code(page, champs_code)
                debut = time.time()
                continue

            # Ni connecté, ni erreur, ni code reconnu : étape inconnue.
            if time.time() - debut > 20 and not etape_manuelle:
                self.log("Étape de vérification non reconnue : affichage de la fenêtre du navigateur")
                self._sauver_diagnostic("verification-inconnue")
                self._montrer_fenetre()
                etape_manuelle = True
                debut = time.time()
                self._maj(phase="verification_manuelle",
                          message="Pajemploi demande une vérification supplémentaire. "
                                  "Terminez-la dans la fenêtre du navigateur qui vient de s'afficher ; "
                                  "l'application continuera automatiquement.")
            if etape_manuelle and time.time() - debut > delai_manuel:
                raise RuntimeError("Délai dépassé pour la vérification manuelle.")
            time.sleep(1.5)

    def _demander_et_saisir_code(self, page, champs):
        consigne = self._texte_consigne(page)
        self.log("Code de vérification demandé par Pajemploi")
        while not self._codes.empty():
            self._codes.get_nowait()
        self._maj(phase="code_requis", detail_code=consigne,
                  message="Pajemploi a envoyé un code de vérification. Saisissez-le ci-dessous.")
        try:
            code = self._codes.get(timeout=900)
        except queue.Empty:
            raise RuntimeError("Aucun code saisi dans les 15 minutes.")
        self._maj(phase="connexion", message="Envoi du code…", detail_code="")
        if len(champs) > 1 and len(code) == len(champs):
            for champ, chiffre in zip(champs, code):
                champ.fill(chiffre)
        else:
            champs[0].fill(code)
        # « Faire confiance à cet appareil » : coché pour éviter les codes la prochaine fois.
        for case in page.locator("input[type=checkbox]").all():
            try:
                libelle = (case.evaluate("e => (e.labels && e.labels[0] ? e.labels[0].innerText : '')")
                           or "")
                if re.search(r"confiance|souvenir|m[ée]moriser|appareil|reconna", libelle, re.I):
                    case.check()
            except Exception:
                pass
        bouton = page.locator("button[type=submit], input[type=submit]").filter(
            has_text=re.compile(r"valider|confirmer|continuer|v[ée]rifier|envoyer|suivant", re.I))
        if bouton.count():
            bouton.first.click()
        else:
            champs[-1].press("Enter")
        self._attendre_stable(page)
        erreur = self._message_erreur(page)
        if erreur:
            self.log(f"Code refusé : {erreur}")

    # ------------------------------------------------- détection de l'état
    def _sur_page_connexion(self, page):
        return HOTE_CONNEXION in urlparse(page.url).netloc

    def _semble_connecte(self, page):
        hote = urlparse(page.url).netloc
        if "pajemploi.urssaf.fr" not in hote:
            return False
        try:
            return page.get_by_text(re.compile(r"d[ée]connexion|me d[ée]connecter|se d[ée]connecter",
                                               re.I)).count() > 0 \
                or page.locator("a[href*=logout], button[aria-label*=connexion i]").count() > 0
        except Exception:
            return False

    def _champs_code(self, page):
        """Champs qui ressemblent à une saisie de code (OTP), visibles."""
        candidats = []
        for champ in page.locator("input:visible").all():
            try:
                info = champ.evaluate(
                    "e => [e.type, e.name, e.id, e.autocomplete, e.inputMode, e.maxLength,"
                    " (e.labels && e.labels[0] ? e.labels[0].innerText : ''), e.placeholder || '']")
            except Exception:
                continue
            type_, nom, ident, auto, mode, maxl, libelle, ph = info
            if type_ in ("password", "hidden", "checkbox", "radio", "submit", "button", "email"):
                continue
            if nom == "username" or ident == "mail":
                continue
            texte = " ".join(str(x) for x in (nom, ident, auto, libelle, ph))
            if auto == "one-time-code" or RE_CODE.search(texte) or mode == "numeric" or maxl == 1:
                candidats.append(champ)
        return candidats

    def _message_erreur(self, page):
        for sel in ("[role=alert]:visible", ".error:visible", ".alert-danger:visible",
                    ".fr-error-text:visible", ".fr-alert--error:visible"):
            try:
                el = page.locator(sel).first
                if el.count():
                    texte = el.inner_text().strip()
                    if texte and len(texte) < 400 and not re.search(r"cookie", texte, re.I):
                        return texte
            except Exception:
                pass
        return ""

    def _texte_consigne(self, page):
        try:
            texte = page.locator("main, form, body").first.inner_text()
        except Exception:
            return ""
        lignes = [l.strip() for l in texte.splitlines() if re.search(r"code|envoy|courriel|mail|sms|t[ée]l[ée]phone", l, re.I)]
        return " ".join(lignes)[:400]

    def _refuser_cookies(self, page):
        try:
            bouton = page.locator("#footer_tc_privacy_button_2")
            if bouton.count() and bouton.is_visible():
                bouton.click()
                return
            bouton = page.get_by_role("button", name=re.compile("tout refuser|continuer sans accepter", re.I))
            if bouton.count() and bouton.first.is_visible():
                bouton.first.click()
        except Exception:
            pass

    def _attendre_stable(self, page, delai=15000):
        try:
            page.wait_for_load_state("networkidle", timeout=delai)
        except Exception:
            pass
        time.sleep(0.8)

    def _cliquer_texte(self, page, motif):
        el = page.locator("a:visible, button:visible").filter(has_text=re.compile(motif, re.I))
        if el.count():
            el.first.click()
            return True
        return False

    # -------------------------------------------- liste des bulletins
    def _aller_aux_bulletins(self, page):
        if self._url_liste:
            page.goto(self._url_liste, wait_until="domcontentloaded")
            self._attendre_stable(page)
            if self._semble_connecte(page):
                return
        self._refuser_cookies(page)
        # Plusieurs chemins possibles selon la présentation du site.
        for motif in (r"bulletins? de salaire", r"mes bulletins", r"bulletin"):
            if self._cliquer_texte(page, motif):
                self._attendre_stable(page)
                return
        for menu in (r"mes salaires|mes documents|historique|mes d[ée]clarations|mes employeurs",):
            if self._cliquer_texte(page, menu):
                self._attendre_stable(page)
                if self._cliquer_texte(page, r"bulletin"):
                    self._attendre_stable(page)
                    return
        self._sauver_diagnostic("page-bulletins-introuvable")
        raise RuntimeError("Page des bulletins introuvable automatiquement. Utilisez « Ouvrir Pajemploi "
                           "dans une fenêtre », allez sur la page des bulletins, puis « Analyser la page "
                           "affichée ».")

    def _analyser(self):
        self._maj(phase="analyse", message="Recherche des bulletins sur Pajemploi…")
        page = self._page
        self._aller_aux_bulletins(page)
        self._lire_liste(page)

    def _lire_liste(self, page):
        # Afficher toute la liste si elle est paginée / repliée.
        for _ in range(30):
            if not self._cliquer_texte(page, r"^\s*(afficher|voir|charger) plus|tout afficher"):
                break
            self._attendre_stable(page, 5000)

        bulletins, vus = [], set()
        numero_page = 0
        while True:
            for b in self._extraire_lignes(page):
                cle = (b["employeur"], b["periode"], b["libelle"])
                if cle not in vus:
                    vus.add(cle)
                    b["page"] = numero_page
                    bulletins.append(b)
            suivant = page.locator("a:visible, button:visible").filter(
                has_text=re.compile(r"^\s*(suivant|page suivante|›|»|>)\s*$", re.I))
            if numero_page >= 50 or not suivant.count() or not suivant.first.is_enabled():
                break
            suivant.first.click()
            numero_page += 1
            self._attendre_stable(page, 8000)

        self._url_liste = page.url
        if not bulletins:
            self._sauver_diagnostic("aucun-bulletin-detecte")
            raise RuntimeError("Aucun bulletin reconnu sur cette page. Un diagnostic a été enregistré "
                               "(bouton « Ouvrir le dossier des diagnostics »).")

        params = parametres.charger()
        mini = params.get("periode_min") or ""
        bulletins = [b for b in bulletins if b["periode"] >= mini]
        bulletins.sort(key=lambda b: (b["periode"], b["employeur"]))
        bibliotheque.comparer(bulletins, params, parametres.correspondances(params))
        manquants = sum(1 for b in bulletins if not b["present"])
        self.log(f"{len(bulletins)} bulletins trouvés sur Pajemploi, {manquants} manquants")
        self._maj(phase="connecte", bulletins=bulletins, derniere_analyse=datetime.now().isoformat(),
                  message=f"{len(bulletins)} bulletins sur Pajemploi — {manquants} à récupérer.")

    def _extraire_lignes(self, page):
        """Repère chaque lien/bouton de bulletin et lit la ligne (ou carte) qui l'entoure."""
        script = r"""
        () => {
          const cliquables = [...document.querySelectorAll('a, button, [role=button], [role=link]')];
          const motif = /bulletin|t[ée]l[ée]charg|pdf|visualiser|consulter/i;
          const res = [];
          cliquables.forEach((el, index) => {
            const desc = [el.innerText, el.title, el.getAttribute('aria-label'), el.getAttribute('href'),
                          el.getAttribute('download')].join(' ');
            if (!motif.test(desc)) return;
            if (el.offsetParent === null) return;
            // Remonter jusqu'au conteneur qui donne le contexte de la ligne.
            let c = el, texte = '';
            for (let i = 0; i < 8 && c.parentElement; i++) {
              c = c.parentElement;
              texte = c.innerText || '';
              if (/(janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre)\s+20\d\d|\b(0?[1-9]|1[0-2])\/20\d\d|20\d\d-(0[1-9]|1[0-2])/i.test(texte)) break;
            }
            // Contexte de section (titre au-dessus, ex. nom de l'employeur)
            let titre = '';
            let s = c;
            for (let i = 0; i < 6 && s && !titre; i++) {
              let p = s.previousElementSibling;
              while (p && !titre) {
                if (/^H[1-6]$/.test(p.tagName) || p.querySelector && p.querySelector('h1,h2,h3,h4,h5,h6')) {
                  titre = p.innerText.trim().split('\n')[0];
                }
                p = p.previousElementSibling;
              }
              s = s.parentElement;
            }
            // En-têtes de tableau pour repérer la colonne « employeur ».
            let entetes = [], cellules = [];
            const tr = el.closest('tr');
            if (tr) {
              const table = tr.closest('table');
              entetes = table ? [...table.querySelectorAll('thead th')].map(t => t.innerText.trim()) : [];
              cellules = [...tr.children].map(td => td.innerText.trim());
            }
            res.push({index, texte: texte.trim().slice(0, 1500), titre,
                      lien: (el.innerText || el.title || el.getAttribute('aria-label') || '').trim().slice(0, 80),
                      href: el.getAttribute('href') || '', entetes, cellules});
          });
          return res;
        }
        """
        lignes = page.evaluate(script)
        resultat = []
        for l in lignes:
            periode = bibliotheque.periode_depuis_texte(l["texte"])
            if not periode:
                continue
            employeur = self._deviner_employeur(l)
            if not employeur:
                continue
            resultat.append({
                "employeur": employeur,
                "periode": periode,
                "libelle": l["lien"] or "bulletin",
                "index": l["index"],
                "href": l["href"],
                "texte": l["texte"][:300],
            })
        # Une même ligne peut contenir plusieurs boutons (voir / télécharger) :
        # on garde de préférence celui qui parle de bulletin ou de téléchargement.
        par_ligne = {}
        for b in resultat:
            cle = (b["employeur"], b["periode"], b["texte"])
            score = 2 if RE_BULLETIN.search(b["libelle"] + b["href"]) else (
                1 if re.search(r"t[ée]l[ée]charg|pdf", b["libelle"] + b["href"], re.I) else 0)
            if cle not in par_ligne or score > par_ligne[cle][0]:
                par_ligne[cle] = (score, b)
        return [v[1] for v in par_ligne.values()]

    def _deviner_employeur(self, ligne):
        # 1) Tableau avec une colonne « Employeur ».
        for i, entete in enumerate(ligne.get("entetes") or []):
            if re.search(r"employeur|parent|nom", entete, re.I) and i < len(ligne["cellules"]):
                return ligne["cellules"][i].split("\n")[0].strip()
        # 2) Ligne / carte : première ligne de texte qui ressemble à un nom.
        for morceau in ligne["texte"].split("\n"):
            morceau = morceau.strip()
            if not morceau or len(morceau) > 60:
                continue
            if bibliotheque.periode_depuis_texte(morceau) or RE_MONTANT.search(morceau):
                continue
            if RE_BRUIT.search(morceau) or re.search(r"\d{3,}", morceau):
                continue
            if re.search(r"[A-Za-zÀ-ÿ]{2,}", morceau):
                return re.sub(r"^(employeur|parent)\s*:\s*", "", morceau, flags=re.I)
        # 3) Titre de section au-dessus de la liste.
        titre = (ligne.get("titre") or "").strip()
        if titre and not RE_BRUIT.search(titre):
            return titre
        return ""

    # -------------------------------------------------- téléchargements
    def _cmd_telecharger_manquants(self):
        etat = self.lire_etat()
        a_faire = [b for b in etat["bulletins"] if not b["present"]]
        if not a_faire:
            self._maj(message="Aucun bulletin manquant.")
            return
        self._verifier_dossier()
        if not self._page or not self._semble_connecte(self._page):
            self._connecter()
        page = self._page
        self._maj(phase="telechargement", progression={"fait": 0, "total": len(a_faire)})
        reussis = 0
        page_courante = None
        for n, b in enumerate(a_faire, 1):
            self._maj(message=f"Téléchargement {n}/{len(a_faire)} : {b['client']} — {b['periode']}")
            try:
                if page_courante != b.get("page", 0) or not self._url_liste or page.url != self._url_liste:
                    self._revenir_a_la_page(page, b.get("page", 0))
                    page_courante = b.get("page", 0)
                cible = Path(b["cible"])
                cible.parent.mkdir(parents=True, exist_ok=True)
                self._telecharger(page, b, cible)
                reussis += 1
                self.log(f"Enregistré : {cible}")
                self._marquer_present(b, str(cible))
            except Exception as e:  # noqa: BLE001
                self.log(f"Échec pour {b['client']} {b['periode']} : {str(e).splitlines()[0]}")
                page_courante = None
            self._maj(progression={"fait": n, "total": len(a_faire)})
        self._maj(phase="connecte", progression=None,
                  message=f"{reussis} bulletin(s) récupéré(s) sur {len(a_faire)}.")

    def _revenir_a_la_page(self, page, numero):
        self._aller_aux_bulletins(page)
        for _ in range(30):
            if not self._cliquer_texte(page, r"^\s*(afficher|voir|charger) plus|tout afficher"):
                break
            self._attendre_stable(page, 5000)
        for _ in range(numero):
            page.locator("a:visible, button:visible").filter(
                has_text=re.compile(r"^\s*(suivant|page suivante|›|»|>)\s*$", re.I)).first.click()
            self._attendre_stable(page, 8000)

    def _retrouver_element(self, page, b):
        """Retrouve le lien du bulletin après rechargement (même ligne : employeur + période)."""
        for l in self._extraire_lignes(page):
            if l["employeur"] == b["employeur"] and l["periode"] == b["periode"] and l["texte"] == b["texte"]:
                return page.locator("a, button, [role=button], [role=link]").nth(l["index"])
        return page.locator("a, button, [role=button], [role=link]").nth(b["index"])

    def _telecharger(self, page, b, cible):
        el = self._retrouver_element(page, b)
        el.scroll_into_view_if_needed()
        pages_avant = set(self._contexte.pages)
        try:
            with page.expect_download(timeout=30000) as info:
                el.click()
            info.value.save_as(str(cible))
            return
        except Exception:
            pass
        # Le PDF s'est peut-être ouvert dans un nouvel onglet.
        for p in self._contexte.pages:
            if p not in pages_avant:
                try:
                    p.wait_for_load_state(timeout=15000)
                    if self._enregistrer_url(p.url, cible):
                        return
                finally:
                    p.close()
        href = b.get("href") or ""
        if href and not href.startswith(("javascript", "#")):
            if self._enregistrer_url(urljoin(page.url, href), cible):
                return
        raise RuntimeError("le fichier PDF n'a pas pu être récupéré")

    def _enregistrer_url(self, url, cible):
        reponse = self._contexte.request.get(url)
        corps = reponse.body()
        if reponse.ok and corps[:4] == b"%PDF":
            cible.write_bytes(corps)
            return True
        return False

    def _marquer_present(self, bulletin, chemin):
        with self._verrou:
            for b in self.etat["bulletins"]:
                if b["cible"] == bulletin["cible"]:
                    b["present"] = True
                    b["fichier_existant"] = chemin

    # ------------------------------------------------------ diagnostic
    def _cmd_diagnostic(self):
        if not self._page:
            raise RuntimeError("Aucun navigateur ouvert.")
        dossier = self._sauver_diagnostic("manuel")
        self._maj(message=f"Diagnostic enregistré dans {dossier}")

    def _sauver_diagnostic(self, raison):
        """Enregistre capture, HTML et réponses JSON : utile pour adapter le programme
        si Pajemploi change la présentation de son site. Aucun mot de passe n'y figure."""
        if not self._page:
            return None
        dossier = DIAGNOSTICS / f"{datetime.now():%Y-%m-%d_%H-%M-%S}_{raison}"
        try:
            dossier.mkdir(parents=True, exist_ok=True)
            self._page.screenshot(path=str(dossier / "capture.png"), full_page=True)
            html = self._page.content()
            html = re.sub(r'(type="password"[^>]*value=")[^"]*', r"\1***", html)
            (dossier / "page.html").write_text(html, encoding="utf-8")
            (dossier / "adresse.txt").write_text(self._page.url, encoding="utf-8")
            (dossier / "reponses.json").write_text(
                json.dumps(self._reponses_json, ensure_ascii=False, indent=1), encoding="utf-8")
            self.log(f"Diagnostic enregistré : {dossier.name}")
        except Exception:
            pass
        return dossier
