# CLAUDE.md — assmat-gestion

Application Windows locale (serveur Flask local, un par session Windows, + page web) pour centraliser les démarches
d'une assistante maternelle. Première fonctionnalité : récupérer et ranger les bulletins de salaire Pajemploi.
Utilisatrice finale non technicienne, sur une **autre session Windows** que celle du développeur.

## Règles impératives

- **Aucune trace d'une personne réelle** dans le dépôt (code, tests, exemples, placeholders, commits) :
  utiliser des noms génériques (Dupont, Martin, Durand, Bernard, Petit…). Le dépôt est **public**.
- Aucun identifiant, mot de passe ou donnée personnelle dans les fichiers : le mot de passe Pajemploi est dans
  le Gestionnaire d'identifiants Windows (`keyring`, service `AssistanteMaternelle-Pajemploi`).
- Interface, messages, commentaires et documentation **en français**, compréhensibles par une non-technicienne.
- Ne jamais écrire dans les dossiers de l'utilisatrice finale pour tester : utiliser un dossier `_test/`
  (ignoré par git) dans ce dépôt.

## Organisation

```
app/                 code Python (lancé par app/main.py)
  main.py            serveur Flask, routes /api/*, ouverture du navigateur
  pajemploi.py       pilotage de Pajemploi avec Playwright (un seul fil dédié + file de commandes)
  bibliotheque.py    analyse du dossier local, détection des bulletins présents, format des noms
  parametres.py      paramètres JSON (dont rubriques affichées « modules ») + mot de passe via keyring
  donnees.py         profil (champs globaux des courriers), familles employeurs, fiches enfants/contrats et
                     avenants, échéances (JSON dans donnees\)
  revenus.py         lecture des montants des bulletins PDF (pypdf, cache donnees\revenus.json), totaux
  impots.py          déclaration de revenus : barèmes SMIC / déduction 10 %, jours de garde proposés puis
                     confirmés (donnees\impots.json), abattement, comparaison régime spécifique / classique
  courriers.py       demande de dérogation : texte proposé, page imprimable, PDF via Chromium sans fenêtre
  contrat_travail.py contrat de travail : remplit le PDF officiel de l'Urssaf (app/modeles/) avec pypdf
  chemins.py         tous les emplacements (dépôt GitHub, branche stable, dossiers de données)
  web/               index.html, app.js, style.css (JS sans framework, sondage de /api/etat toutes les 1,5 s)
scripts/             installer.ps1, verifier.ps1, commun.ps1 (exécutés depuis l'application installée)
distribution/        ce que l'on copie dans le dossier « Programme » de l'utilisatrice
  Executables/       amorce.ps1 (télécharge stable.zip puis lance installer.ps1), Installer.bat,
                     Mettre a jour.bat, Verifier.bat
Lancer.bat           lanceur ciblé par le raccourci « Assistante Maternelle.lnk »
VERSION              numéro de version comparé à celui de la branche stable (bandeau de mise à jour)
tests/               scripts de test autonomes (pas de pytest)
```

Sur le poste de l'utilisatrice, tout est dans `%LOCALAPPDATA%\assmat-gestion\` : `application\` (code,
remplacé à chaque mise à jour par robocopy /MIR), `python\` (venv), `navigateurs\` (Chromium Playwright),
`profil-navigateur\` (cookies : appareil reconnu par Pajemploi), `donnees\parametres.json`, `journaux\`
(dont `diagnostics\`). `ASSMAT_BASE` permet de rediriger ce dossier (tests). Ne pas mettre ces éléments
dans OneDrive : l'installation de Chromium y échoue.

## Branches et publication

- `main` : développement. `stable` : version téléchargée par l'installateur et la mise à jour.
- Publier : augmenter `VERSION`, ajouter en tête de `app/web/notes-versions.json` une entrée (version, date,
  titre, nouveautés rédigées pour l'utilisatrice, sans jargon) — elle s'affiche dans « À propos » et dans
  l'annonce de mise à jour —, committer sur `main`, puis
  `git checkout stable && git merge --ff-only main && git push && git checkout main`.
- Ne pousser sur `stable` que si les tests passent : c'est immédiatement distribué.

## Tests

```bash
py -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m playwright install chromium
.venv\Scripts\python tests\test_bibliotheque.py      # détection des fichiers, formats de nom
.venv\Scripts\python tests\test_api.py               # API Pajemploi imitée : liste + PDF
.venv\Scripts\python tests\test_extraction.py        # repli : lecture de pages imitant Pajemploi
.venv\Scripts\python tests\test_page_connexion.py    # vraie page de connexion Pajemploi, sans se connecter
.venv\Scripts\python tests\test_revenus.py         # montants lus dans des bulletins PDF fictifs, totaux
.venv\Scripts\python tests\test_impots.py          # abattement, jours proposés/confirmés, régimes (fictif)
.venv\Scripts\python tests\test_contrats.py        # avenants : conditions en vigueur à une date
.venv\Scripts\python tests\test_courriers.py       # demande de dérogation (profil et contrats fictifs), PDF
.venv\Scripts\python tests\test_contrat_travail.py # contrat de travail Urssaf rempli (champs du modèle, cas 1 et 2)
.venv\Scripts\python tests\test_icones.py         # icônes des sites d'activités (sites imités en local), cache
.venv\Scripts\python app\main.py                     # lancer l'application
```

Tester l'installateur sans toucher au vrai `%LOCALAPPDATA%` : dans PowerShell, définir
`$env:LOCALAPPDATA` vers `_test\...\localappdata`, puis lancer
`distribution\Executables\amorce.ps1 -Source <racine du dépôt> -DossierProgramme <_test\...\Programme>`.

## Pièges connus

- **Nouveau module Python** : l'ajouter à `requirements.txt` ET à `main.MODULES` (installé au démarrage s'il
  manque, car une mise à jour peut ne pas avoir relancé pip : cas réel de pypdf en 1.4.0) et au contrôle de
  `verifier.ps1`. Une `ImportError` à la lecture d'un bulletin n'est jamais mise en cache (`revenus.MODULE_ABSENT`).
- **Plusieurs sessions Windows sur le même PC** partagent les ports de `127.0.0.1`. Chaque session a donc
  son serveur : port dérivé du nom d'utilisateur (repli sur un port libre) et jeton secret, tous deux dans
  `%LOCALAPPDATA%\assmat-gestion\serveur.json`. Toute requête doit présenter le jeton (cookie posé à
  l'ouverture via `/?jeton=…`, ou en-tête `X-Jeton`). `deja_lance()` vérifie l'identité (`/api/ping` renvoie
  `assistante-maternelle:<utilisateur>`). Ne jamais revenir à un port fixe ni à une API sans jeton.
  Les scripts (amorce.ps1) ne ferment que l'application de la session courante.

- **Pajemploi refuse les navigateurs headless** (`ERR_CONNECTION_RESET`) : toujours `headless=False`,
  fenêtre réduite (`--start-minimized`) et affichée via CDP (`_montrer_fenetre`) quand une action manuelle
  est nécessaire. Ne pas contourner autrement la détection du site.
- Connexion : `https://pajemploi.urssaf.fr/` redirige vers `login.urssaf.fr` (champs `#mail`/`username`,
  `#password`, bouton « Se connecter », bannière cookies `#footer_tc_privacy_button_2` = « Tout refuser »).
- Page des bulletins : `https://pajemploi.urssaf.fr/salarie/documents/bulletins` (tableau paginé par 5,
  filtré sur l'année en cours, téléchargement caché derrière un menu « ⋮ »). On ne lit donc **pas** le tableau :
  on utilise l'API que la page appelle elle-même (relevée dans le code JS public du site, modules
  `bulletins-salaire` / `generateAndDownloadBulletinSalaireDoc`) :
  - `POST https://api.urssaf.fr/paje/apaj/v1/documents/voletsSociaux/rechercher`
    `{"typeDocuments":["BS"],"periodeDeclarationDebut":"AAAA-MM","periodeDeclarationFin":"AAAA-MM"}` →
    liste de déclarations (`idDeclaration`, `periode`, `employeur{nom,prenoms}`, `enfants[{prenoms,isGarde}]`).
    Une déclaration = un enfant : une famille peut avoir plusieurs bulletins le même mois.
  - `POST .../documents/generer` `{"codeParamDoc":"PAJE_BULLETIN_SALAIRE","criteresAggregation":
    [{"key":"refDoc","value":idDeclaration},{"key":"rangVSO","value":"0"}]}` → `{"documentData": base64 PDF}`.
  - Les appels sont faits par `fetch` dans la page connectée, avec les en-têtes (dont `authorization`)
    capturés sur les requêtes de la page (`_noter_requete`). Ces en-têtes restent en mémoire : ne jamais les
    écrire dans un fichier ni dans les diagnostics (les réponses `/token`, `jwks`, `generer` en sont exclues).
  - Repli si l'API échoue : lecture du tableau affiché (`_lister_via_page`, heuristiques).
- En cas d'échec, un diagnostic (capture, HTML, réponses JSON, requêtes sans en-têtes) est enregistré dans
  `journaux\diagnostics` ; ces fichiers contiennent des données personnelles réelles : ne jamais les copier
  dans le dépôt. Reproduire le cas dans `tests/` avec des noms fictifs.
- Playwright exige que toutes ses actions se fassent dans le fil `Pajemploi._boucle` : passer par
  `demander()` / `_cmd_*`, jamais depuis les routes Flask.
- PowerShell 5.1 : les `.ps1` doivent être en **UTF-8 avec BOM** (accents), les `.bat`/`.ps1` en CRLF
  (`.gitattributes`). Dans les scripts, `$ErrorActionPreference = "Continue"` (py/pip écrivent sur stderr) :
  vérifier `$LASTEXITCODE` et mettre `-ErrorAction Stop` sur les cmdlets critiques.
- Détection de Python : utiliser `py -0p` (liste sans installer) ; ne jamais appeler `py -3.x` (le
  gestionnaire Python récent peut proposer une installation et bloquer). Ne pas utiliser de joker + `-Recurse`
  sur `C:\` (parcours du disque entier).
- Fichiers texte écrits par PowerShell 5.1 (`Set-Content -Encoding UTF8`) : BOM en tête. Côté Python, lire en
  `utf-8-sig` ; côté PowerShell, écrire avec `[IO.File]::WriteAllText(..., UTF8Encoding $false)`. Un BOM dans
  `dossier-programme.txt` cassait la mise à jour (« lecteur nommé C » introuvable, installer.ps1 jamais lancé).
- `.bat` : texte ASCII uniquement ; une mise à jour peut réécrire le `.bat` en cours d'exécution, d'où
  `& exit /b` sur la même ligne que l'appel PowerShell.
- Classement (paramètre `organisation`) : `client`, `client_annee`, `annee`, `annee_client`
  (`bibliotheque.ORGANISATIONS`). La détection des fichiers existants est récursive et traverse les
  dossiers d'année (`RE_ANNEE`) : elle doit marcher quel que soit le classement, même mélangé.
- Formats de nom : mots-clés `NOM CLIENT`, `ENFANT`, `YYYY`, `YY`, `MM`, `MOIS`
  (`bibliotheque.appliquer_format`). Plusieurs bulletins d'un même client le même mois : suffixe
  ` - Prénom` de l'enfant ; les fichiers existants qui citent le prénom sont attribués en priorité.
- Interface : `.cadre` = menu latéral blanc à gauche (`#menu`, titres de catégorie `.categorie` précédés d'un point
  de couleur, pied : À propos / version, mise à jour, quitter) + `.zone` (en-tête blanc puis `main`). Boutons du menu
  `data-onglet` ; chaque rubrique optionnelle porte `data-module` (masquée si `parametres.modules[nom]` est faux).
  Pastille abricot `#badge-bulletins` = nombre de bulletins à récupérer (`badgeBulletins()`). Sur téléphone (≤ 820 px)
  le menu glisse par-dessus la page (bouton « Menu », clic à côté ou Échap le referment). En-tête : mise à jour
  disponible (pastille abricot), puis « Paramètres » (onglet `fonctionnalites`) et « Mon profil » (initiale du
  prénom) en haut à droite : choix de Yannis, ne pas les déplacer dans le menu.
- Couleurs : douces, « enfance » ; rose poudré et lavande pour l'ensemble, abricot / jaune doux (`--tournesol`)
  réservé à ce qui doit attirer l'œil (à récupérer, mise à jour, pastilles, alertes) et orange `--urgent` pour une date
  proche. Pas de vert ni de couleurs vives. Les noms des variables CSS d'origine sont gardés (`--eucalyptus` = lavande
  soutenue des boutons, `--menthe` = lavande douce des mois rangés).
- Pictogrammes : `PICTOS` / `picto(nom)` en tête de app.js (trait arrondi, `stroke`, jamais de bibliothèque externe) ;
  dans le HTML, `data-picto="nom"` ajoute le pictogramme au début de l'élément. Pictogrammes par catégorie
  du menu (`pastille(nom, categorie)`, classes `.pic argent|familles|demarches|moi`) : **sans fond coloré** (demande de
  Yannis : un fond seulement s'il porte une information), trait de la couleur de la catégorie : rose framboise = Mon
  argent, lavande = Mes familles, mauve = Mes démarches, prune grisée = Mon profil / Paramètres. Garder ces couleurs
  partout où la rubrique apparaît (tableau de bord, échéances, courriers).
- Étiquettes des champs : « obligatoire » (rose, avec un point) et « facultatif » (lavande), deux couleurs bien
  distinctes ; les deux restent affichées (choix de Yannis).
- Longs formulaires (`form.suivi-modifs` : Mon profil, Paramètres) : dès qu'un champ change, la classe `modifie`
  rend la `.barre-enregistrer` collante en bas de l'écran (Annuler / Enregistrer) ; quitter la rubrique demande
  confirmation. Retirer `modifie` (`sansModifs`) après chargement ou enregistrement.
- Échéances (`donnees.echeances`) : chaque entrée a un `type` (pictogramme, `PICTO_ECHEANCE`) et `aller` (rubrique où
  agir, lien affiché ; vide = aucun lien). Tableau de bord : version compacte (`ligneEcheance(e, true)`).
- « À faire » : chaque ligne = pastille + texte + détail + bouton qui dit l'action ; `data-lancer` lance en plus une
  action Pajemploi (vérifier, récupérer).
- Revenus : le « Total encaissé » est le « Net payé en euros » de chaque bulletin (acompte compris, impôt déduit),
  reconstitué (net + indemnités + rupture + exonération heures complémentaires - impôt) s'il manque.
  Les heures affichées = heures normales + heures complémentaires.
- Familles employeurs (`familles.json`, `donnees.CHAMPS_FAMILLE`) : créées avant les fiches enfants, qui s'y
  rattachent par le **nom** (`contrat["famille"]`, aussi nom du dossier des bulletins). Renommer une famille
  renomme ses fiches enfants ; une famille avec des enfants ne peut pas être supprimée. `donnees.familles()` ajoute
  (id vide) les familles citées par d'anciennes fiches enfants sans fiche famille.
  `donnees.completer_familles` (appelé par `GET /api/familles`) crée la fiche des familles des bulletins et
  remplit les champs **vides** (parent, adresse, n° employeur) d'après `fiche_employeur` du bulletin le plus récent
  (`revenus.lire_bloc_employeur` : nom, adresse jusqu'à la ligne « CP VILLE », « N°Employeur … »).
- Nom d'une famille : affiché = `parent1_nom` (parent qui gère le contrat) ; `nom` enregistré = clé reliant la
  famille au dossier de ses bulletins et aux fiches enfants (`contrat["famille"]`). Une famille saisie à la main
  reçoit `nom` = `parent1_nom` ; celui d'une famille existante ne change plus (le formulaire n'a pas de champ « nom »).
- Semaines d'accueil par an : nombre exact saisi (1 à 52), heures mensualisées = heures/semaine × semaines ÷ 12 ;
  horaires de vacances différents : semaines comptées d'abord à l'école (`SEMAINES_ECOLE` = 36 dans app.js).
  Salaire net indicatif = brut × `revenus.taux_net` (6 derniers bulletins lus, 0,78 sinon), fourni par
  `/api/suggestions`.
- Formulaires : `marquerChamps` ajoute « obligatoire » (attribut `required` ou `data-obligatoire`) ou
  « facultatif » à chaque libellé. Recherche instantanée : un `<input data-filtre="sélecteur">` masque les éléments
  qui ne contiennent pas le texte (`appliquerFiltres()` à rappeler après chaque rendu de liste).
- Tableau de bord : « Bonjour Prénom ! » + 3 chiffres (`statsAccueil`), « À faire » sur toute la largeur (seulement des
  actions possibles tout de suite), puis deux colonnes indépendantes (`.colonnes-accueil` > `.colonne`, chaque carte
  garde sa hauteur) : à gauche Agenda (calendrier du mois, point sous les jours à échéance, `afficherAgenda`) et Mes
  revenus (graphique compact), à droite la journée (`afficherJour` : aujourd'hui, ou le prochain jour d'accueil quand
  toutes les plages sont finies ; une ligne par plage, l'enfant revient s'il y a une coupure) et les sites
  d'activités. Sur téléphone, la journée passe en premier. L'application ne connaît pas les dates des vacances
  scolaires : si un enfant a des horaires de vacances, une bascule « Période scolaire / Vacances » apparaît (choix
  gardé pour la journée dans `localStorage`).
- Fiche enfant, avenants : `avenants` = liste datée ({id, date, motif} + toutes les conditions de
  `donnees.MODIFIABLES`, pas seulement celles qui changent). `donnees.en_vigueur(c, jour)` /
  `donnees.contrats(jour)` donnent les conditions applicables à une date : échéances, courriers (date du courrier)
  et impôts (jour par jour) les utilisent ; ne pas lire directement `horaires_*` d'une fiche pour une date donnée.
- Horaires saisis avec des champs `type=time` (arrivée/départ, deuxième plage « coupure »), enregistrés au format
  texte « 8h00-12h00 / 13h30-17h00 » (lu par `impots.duree` et les courriers). Résumé : heures par semaine,
  heures mensualisées (× 52 ÷ 12) en année complète.
- Autocomplétion des fiches : `/api/suggestions` (familles des dossiers de bulletins, `employeur` lu sur chaque
  bulletin par `revenus.lire_employeur` — ligne qui suit « Référence employeur », jamais le premier
  « MADAME » qui est l'assistante maternelle —, employeur et prénoms des enfants de l'état Pajemploi, autres fiches),
  via des `<datalist>`.
- Fiche enfant : `horaires_vacances` vide signifie « mêmes horaires qu'en période scolaire » (case
  « Horaires différents pendant les vacances » décochée) ; les courriers reprennent alors `horaires_scolaire`.
- `profil.json`, `familles.json`, `contrats.json`, `revenus.json`, `impots.json`, `brouillons.json`, `documents.json`, `sites.json` (dans `donnees\`) contiennent des données personnelles réelles :
  jamais dans le dépôt. Les libellés lus dans les bulletins (vérifiés sur de vrais bulletins
  Pajemploi 2015-2026 ; plusieurs rubriques sur une même ligne, d'où `PREMIER_NOMBRE`) sont dans `revenus.RUBRIQUES` (augmenter
  `VERSION_LECTURE` quand ils changent, pour relire les bulletins).
- Impôts (`impots.py`) : `SMIC_HORAIRE` (daté, SMIC du mois de garde) et `DEDUCTION_10` (minimum/maximum par
  année de revenus, repli sur la dernière connue) sont à **compléter chaque année** ; ils s'affichent dans
  « À propos > Barèmes utilisés » (`/api/bareme`). Abattement par enfant : 3 SMIC par jour ≥ 8 h (4 si
  `abattement_majore` = « oui » dans la fiche), 3 SMIC ÷ 8 × heures pour un jour plus court, + 1 SMIC par garde
  de 24 h ; revenu à déclarer par famille = net imposable + entretien + repas − abattement, jamais négatif.
  Jours proposés : jours d'activité du bulletin si la famille n'a qu'un enfant (plafonnés par l'emploi du
  temps : ils incluent les congés payés en année complète), sinon emploi du temps × semaines ÷ 52.
- « À propos > Comment fonctionne l'application » explique d'où viennent les chiffres, la connexion à Pajemploi
  et chaque calcul : le tenir à jour quand un calcul ou une source change.
- Contrat de travail (`contrat_travail.py`) : on **remplit les champs** du PDF remplissable de l'Urssaf
  (`app/modeles/Contrat-CDI-Pajemploi-Ama.pdf`, modèle « Sept. 2026 »), sans le réécrire ; les champs restent modifiables
  (`NeedAppearances`). Cases à cocher / boutons radio : valeur = nom de l'apparence (`/Choix1`, `/2`, `/Oui`…), voir les
  dictionnaires en tête du module. Quand l'Urssaf change le modèle : remplacer le PDF, vérifier les noms de champs
  (`test_contrat_travail.py` échoue si un nom n'existe plus). Version à remplir = `valeurs_assmat` (profil seul) ;
  version complète = `valeurs_contrat` (conditions en vigueur au début du contrat). PDF dans le dossier des courriers.
- Assistant « Ajouter un enfant » : `#form-contrat` en classe `assistant` (plein écran) ; chaque `[data-etape]`
  (avec `data-titre`) est une étape, dans l'ordre du DOM. Les champs `data-requis` ne sont obligatoires que dans
  l'assistant (les anciennes fiches restent enregistrables). Les champs `f_*` (parent employeur) vont dans la fiche
  famille, créée ou mise à jour avant la fiche enfant. Modifier une fiche existante reste un formulaire en ligne.
- Assistant, suite : brouillons dans `donnees\brouillons.json` (`donnees.brouillons()`, routes `/api/brouillons`), jamais
  comptés comme fiches ; supprimés à l'enregistrement de la fiche. Champs calculés : `<div class="champ-calcule">` avec
  `<output>` (fonction JS `calcule(id, valeur, aide)`). Dans `.grille-champs`, chaque enfant occupe 3 lignes en
  `subgrid` (intitulé / champ / aide) pour que les champs d'une ligne s'alignent : `marquerChamps` regroupe le texte du
  libellé dans `.intitule`. `essai` = « 2 mois », « 6 semaines »… ou « aucune ». Heures complémentaires : %
  (`#taux-complementaire`, non enregistré) ⇄ `tarif_complementaire` ; heures majorées : `taux_majoration` ⇄
  `#tarif-majore` (non enregistré) ; `afficherNetHoraire(source)` recalcule l'autre champ.
- Fiche enfant et avenants : la liste « Familles et contrats » montre chaque famille en `<details>`, repliée par défaut
  (`famillesOuvertes` : ouvertes pendant la session ; la recherche ouvre les familles trouvées) ;
  « Modifier la famille » place `#form-famille` (classe `dans-famille`) dans l'encadré, à la place de `.infos-famille`
  (`fermerFamille()` les rétablit) ; un clic sur un enfant déplie sa carte (`enfantOuvert`, `dossierEnfant`) :
  contrat en vigueur aujourd'hui, historique (contrat puis avenants), documents (`donnees\documents.json`,
  `/api/documents`, ajoutés à chaque PDF créé) et actions. L'assistant a trois modes (`modeSaisie`) : « nouveau »,
  « modification », « avenant » (étapes `ETAPES_AVENANT`, seule la date d'effet est obligatoire). En mode avenant,
  `actualiserRetablir()` affiche ↺ (`data-retablir`) à côté de chaque condition différente de la version précédente.
  PDF de l'avenant : `contrat_travail.html_avenant` (HTML imprimé par Chromium), ne cite que `changements()`.
- Classeur des bulletins : un clic sur une case ouvre `menuContextuel(source, {titre, items})` (Échap, clic ailleurs ou
  défilement le ferment) : case rangée = « Ouvrir » (`/api/ouvrir`) et « Afficher dans le dossier » (`/api/montrer`,
  `explorer /select,`) ; case à récupérer = ce bulletin (`/api/action` avec `cibles` = emplacements prévus, filtre de
  `_cmd_telecharger_manquants`) ou tous. Les deux routes n'ouvrent que des fichiers connus (`fichier_connu`).
- Sites d'activités (module `activites`) : `donnees.sites()` (`donnees\sites.json`, `SITES_DEFAUT` tant qu'il n'existe
  pas ; `enregistrer_sites(None)` les remet), routes `/api/sites`. Tuiles carrées (`tuileSite`) : icône du site servie par
  `/api/icone-site?url=` (seulement pour une adresse de la liste) : `icones.py` la cherche sur le site (plus grande
  `<link rel=…icon>` de la page, puis `/apple-touch-icon.png`, `/favicon.ico`, SVG en dernier), la garde dans
  `donnees\icones\` (une par nom de domaine ; absence notée, réessayée après 7 jours). ≥ 96 px : remplit la tuile ;
  plus petite : centrée ; dès qu'une icône s'affiche, l'initiale est masquée (`.avec-image`) et le fond (transparence
  comprise) est un blanc teinté de la couleur principale du logo (`couleurPrincipale` sur un canvas, `fondTeinte`) ;
  aucune : initiale sur un pastel. Sur le tableau de bord et dans la rubrique.
