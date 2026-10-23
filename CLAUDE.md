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
  principal.py       dossier principal : passage (déplacement des anciens dossiers, progression), sauvegarde
  photos.py          rubrique Photos : photos/vidéos à trier, enfants présents, rangement, numéros, impression
  ateliers.py        rubrique Activités : modèles d'activités, réalisations datées, documents (donnees\activites.json)
  web/               index.html, app.js, style.css (JS sans framework, sondage de /api/etat toutes les 1,5 s)
scripts/             installer.ps1, verifier.ps1, commun.ps1 (exécutés depuis l'application installée)
distribution/        ce que l'on copie dans le dossier « Programme » de l'utilisatrice
  Executables/       amorce.ps1 (télécharge stable.zip puis lance installer.ps1), Installer.bat,
                     Mettre a jour.bat, Verifier.bat
Lancer.bat           lanceur ciblé par le raccourci « Assistante Maternelle.lnk »
VERSION              numéro de version comparé à celui de la branche stable (bandeau de mise à jour)
tests/               scripts de test autonomes (pas de pytest)
outils/              creer_icone.py (icône du raccourci tirée du logo)
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
- Version publiée lue par `lire_stable` (main.py) : API GitHub d'abord, car raw.githubusercontent.com garde ses fichiers
  5 minutes en cache (une version tout juste publiée n'était pas vue) ; repli sur raw avec un paramètre `?t=`.

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
.venv\Scripts\python tests\test_photos.py          # dossier principal, tri et rangement des photos, activités (fictif)
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

- Ouverture de la page : `main.ouvrir_fenetre` lance Edge en mode application (`msedge --app=…`, profil Edge habituel :
  les sites d'activités gardent leurs connexions), trouvé par `chemin_edge` (registre « App Paths », puis Program Files) ;
  sans Edge, navigateur par défaut. « Quitter » tente `window.close()`.
  Raccourcis (installer.ps1, `Creer-Raccourci`) : dossier Programme + menu Démarrer, cible **`pythonw.exe` + `app\main.py`**
  (`$PythonwVenv`, `$ScriptPrincipal`) et non `Lancer.bat` : Windows ne propose pas d'épingler un raccourci vers un .bat.
  `Lancer.bat` reste utilisé par amorce.ps1 (relance après mise à jour). La fenêtre Edge a son propre bouton dans la barre
  des tâches, à côté de l'icône épinglée.
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
  le menu glisse par-dessus la page (bouton « Menu », clic à côté ou Échap le referment). En-tête : à gauche, miniatures des sites
  d'activités (`#sites-entete`, icônes seules cliquables, rempli par `afficherSites` ; celles qui ne tiennent pas
  sont masquées ; juste avant, `.dossier-entete` ouvre le dossier principal, bulle « Ouvrir le dossier » au survol ; bulles d'aide immédiates : attribut `data-bulle`, un seul `#bulle` placé par `montrerBulle`, jamais `title` dans l'en-tête), mise à jour disponible (pastille abricot), puis « Paramètres » (onglet `fonctionnalites`) et « Mon profil » (initiale du
  prénom) en haut à droite : choix de Yannis, ne pas les déplacer dans le menu.
- Couleurs : douces, « enfance » ; rose poudré et lavande pour l'ensemble, abricot / jaune doux (`--tournesol`)
  réservé à ce qui doit attirer l'œil (à récupérer, mise à jour, pastilles, alertes) et orange `--urgent` pour une date
  proche. Pas de vert ni de couleurs vives. Les noms des variables CSS d'origine sont gardés (`--eucalyptus` = lavande
  soutenue des boutons, `--menthe` = lavande douce des mois rangés).
- Chargements : `api()` passe par `suivreChargement(promesse, message)` : au-delà de 0,4 s, barre `#barre-chargement` tout en
  haut (défile sans fin, ou se remplit si l'avancement est connu) et pastille `#chargement`, texte selon la route (`MESSAGES_CHARGEMENT`) ; les appels réguliers ou qui ouvrent une fenêtre de Windows sont
  dans `SANS_INDICATEUR`. Avancement connu : `debutChargement(message)` → `{avancer(fraction), fin()}` ; envoi de fichiers par
  `envoyerFichiers(chemin, FormData, message)` (progression de l'envoi) ; boucle de requêtes par `unParUn(liste, message, f)`
  (le rangement des photos part par paquets de 4 pour que la barre avance). Zone qui se remplit :
  `attenteHtml(texte)` ; bouton qui travaille : `boutonOccupe(bouton, texte)` (rend la fonction qui le rétablit). Miniatures :
  `onload` ajoute `chargee`, sinon reflet animé. Écran de démarrage `#demarrage` (logo, jauge, étape en cours) présent dès le
  HTML (`body.demarrage-en-cours`) : avancement = requêtes finies ÷ max(lancées, `REQUETES_DEMARRAGE`), retiré par
  `finDemarrage()` quand le tableau de bord est rempli (carte des bulletins comprise), ou au bout de 20 s quoi qu'il arrive.
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
- « À faire » : bloc le plus visible (fond dégradé rose-lavande, lignes en cartes blanches, nombre en pastille
  abricot `#nb-a-faire` ; classe `calme` = fond blanc quand tout est à jour). Chaque ligne = pastille + texte + détail + bouton qui dit l'action ; `data-lancer` lance en plus une
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
  toutes les plages sont finies ; une ligne par plage, l'enfant revient s'il y a une coupure), la carte
  « Bulletins de salaire » (mini-classeur des 6 derniers mois, `tuileBulletins`, bouton Récupérer) et les sites
  d'activités. Sur téléphone, la journée passe en premier. L'application ne connaît pas les dates des vacances
  scolaires : si un enfant a des horaires de vacances, une bascule « Période scolaire / Vacances » apparaît (choix
  gardé pour la journée dans `localStorage`).
- Fiche enfant, avenants : `avenants` = liste datée ({id, date, motif} + toutes les conditions de
  `donnees.MODIFIABLES`, pas seulement celles qui changent). `donnees.en_vigueur(c, jour)` /
  `donnees.contrats(jour)` donnent les conditions applicables à une date : échéances, courriers (date du courrier)
  et impôts (jour par jour) les utilisent ; ne pas lire directement `horaires_*` d'une fiche pour une date donnée.
- Indemnité d'entretien : saisie à l'heure (`entretien_horaire`) ; montant d'une journée = horaire × durée (2,65 € au moins,
  `entretien_par_jour` / `entretienParJour`) ; `entretien_jour` (champ caché, journée moyenne de la période scolaire) sert
  aux estimations par mois et n'est jamais comparé entre versions (`COMPAREES`). Ancienne fiche : horaire = par jour ÷ journée
  la plus longue (`versionsDe`). Résumé et PDF d'un avenant citent aussi les valeurs calculées qui changent (`calculsVersion`,
  `changements`). Plages horaires : outils au-dessus, à droite ; la croix d'une coupure la retire ; toute action d'outil
  émet `input` (`horairesChanges`). Assistant en mode « modification » : `#assistant-enregistrer` dès qu'un champ change.
- Horaires saisis avec des champs `type=time` (arrivée/départ, deuxième plage « coupure »), enregistrés au format
  texte « 8h00-12h00 / 13h30-17h00 » (lu par `impots.duree` et les courriers). Résumé : heures par semaine,
  heures mensualisées (× 52 ÷ 12) en année complète.
- Autocomplétion des fiches : `/api/suggestions` (familles des dossiers de bulletins, `employeur` lu sur chaque
  bulletin par `revenus.lire_employeur` — ligne qui suit « Référence employeur », jamais le premier
  « MADAME » qui est l'assistante maternelle —, employeur et prénoms des enfants de l'état Pajemploi, autres fiches),
  via des `<datalist>`.
- Fiche enfant : `horaires_vacances` vide signifie « mêmes horaires qu'en période scolaire » (case
  « Horaires différents pendant les vacances » décochée) ; les courriers reprennent alors `horaires_scolaire`.
- `profil.json`, `profils\` (photos des enfants), `familles.json`, `contrats.json`, `revenus.json`, `impots.json`, `brouillons.json`, `documents.json`, `sites.json`, `activites.json`, `photos.json`, `photos-analyse.json` (dans `donnees\`) contiennent des données personnelles réelles :
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
  Avant toute vérification sur Pajemploi (état vide à chaque lancement), le classeur vient de `/api/dossier` : son
  champ `fichiers` (`bibliotheque.fichiers_dossier`) donne le chemin de chaque bulletin, pour que le menu marche aussi.
  Même menu sur la carte du tableau de bord (`tuileBulletins` : cases `button.case-mini`). Curseur main sur toute case
  qui ouvre le menu (`[aria-haspopup]`), jamais sur une case vide.
- Sites d'activités (module `activites`) : `donnees.sites()` (`donnees\sites.json`, `SITES_DEFAUT` tant qu'il n'existe
  pas ; `enregistrer_sites(None)` les remet), routes `/api/sites`. Tuiles carrées (`tuileSite`) : icône du site servie par
  `/api/icone-site?url=` (seulement pour une adresse de la liste) : `icones.py` la cherche sur le site (plus grande
  `<link rel=…icon>` de la page, puis `/apple-touch-icon.png`, `/favicon.ico`, SVG en dernier), la garde dans
  `donnees\icones\` (une par nom de domaine ; absence notée, réessayée après 7 jours). ≥ 96 px : remplit la tuile ;
  plus petite : centrée ; dès qu'une icône s'affiche, l'initiale est masquée (`.avec-image`) et le fond (transparence
  comprise) est un blanc teinté de la couleur principale du logo (`couleurPrincipale` sur un canvas, `fondTeinte`) ;
  aucune : initiale sur un pastel. Sur le tableau de bord et dans la rubrique.
- Icône de l'application : le logo du menu (maison au cœur, `svg.logo` d'index.html) est aussi l'icône du raccourci
  (`app\web\icone.ico`, `IconLocation` dans installer.ps1) et de l'onglet (`app\web\icone.svg`). Si le logo change,
  modifier `icone.svg` puis recréer l'.ico avec `outils/creer_icone.py`.
- Sites d'activités = rubrique « Accès rapide » (onglet `acces-rapide`), mais la clé de module reste `activites`
  (paramètres existants). La rubrique « Activités » (ateliers) a l'onglet et la clé de module `ateliers`, les photos `photos`.
- Dossier principal (`parametres.dossier_principal`, `parametres.SOUS_DOSSIERS`, `parametres.dossier(nom)`) : tout y
  est créé (Bulletins de salaire, Courriers, Photos et vidéos, Activités, À trier, Sauvegarde). `dossier_bulletins` et
  `dossier_courriers` en sont **déduits** par `parametres.charger()` ; `parametres.brut()` donne les valeurs
  enregistrées (anciennes installations). Choisir ou changer ce dossier passe par `principal.lancer` (fil à part,
  `/api/principal` suivi par la page) : fichiers déplacés un par un, original supprimé après vérification de la copie,
  chemins de `documents.json` mis à jour (`donnees.renommer_documents`). Jamais par `/api/parametres`, qui ignore ce champ.
- Photos (`photos.py`) : dossiers sources = `dossiers_photos` (iCloud…) + « À trier » du dossier principal (dépôts
  depuis l'Explorateur, copiés). Ranger **déplace** depuis la source (voulu : la photo quitte aussi iCloud et le
  téléphone). Rangement `Photos et vidéos\Famille\Enfant\AAAA\PRÉNOM - Activité - Photo 0012.jpg`, une copie par
  enfant ; sans enfant mais avec une réalisation : `Photos et vidéos\Réalisations\S0012 - Titre du 14 octobre 2026\Titre -
  Photo 0012.jpg` (`photos.REALISATIONS`, `dossier_realisation` ; le dossier commence par l'identifiant, relu par
  `numeroter` pour un dépôt à la main), quittée dès qu'un enfant est associé ; le numéro (`photos.json`, `compteur`) identifie la photo et figure dans le nom (un fichier rangé sans
  numéro en reçoit un). HEIC → JPEG (pillow-heif), original dans `Photos et vidéos\Format source\` (même arborescence, même nom). Numéro et
  activité aussi écrits en XMP dans le JPEG (sans réencodage). Date : EXIF, sinon XMP, sinon date du fichier (`date_fichier` : plus ancienne entre création et
  modification ; seule lue pour un fichier iCloud non téléchargé), `date_du_fichier` le signale ; augmenter
  `VERSION_ANALYSE` quand la lecture change (cache relu). Enfants proposés = présents à l'heure de la photo
  (`donnees.en_vigueur`) ± `marge_photos` minutes ; aucun = « hors horaires », mis de côté. Doublons par empreinte
  SHA-1. Fichiers iCloud non téléchargés (attributs Windows « cloud ») jamais ouverts. Miniatures dans
  `%LOCALAPPDATA%\assmat-gestion\miniatures` ; vidéo : image tirée de la vidéo par ffmpeg (module `imageio-ffmpeg`,
  `_image_video`, vers 1 s, redressée), échec noté par un fichier `.aucune` ; une vidéo iCloud non téléchargée n'est jamais ouverte. Impression : page HTML (1, 4 ou 16 par page A4), aucun PDF enregistré.
  Reconnaissance des visages : reportée, et jamais par une application ou un service extérieur.
  Photo de profil d'un enfant (`photos.definir_profil`, carré de 256 px pris au centre, un peu vers le haut) :
  `donnees\profils\<id>.jpg`, version (date du fichier) dans `photos.enfants()["photo"]` et `photo_profil` de
  `/api/contrats` (jamais enregistrée dans la fiche) ; proposée (barre de sélection `#profil-rangees`, menu de la photo)
  seulement pour une photo rangée d'un seul enfant (`enfantSeul`). Partout, le rond d'un enfant passe par
  `avatarEnfant(prénom, id, version)` (photo, sinon initiale). Pas de lien « Désélectionner » : clic dans le vide.
- Rubrique Photos (interface, demande de Yannis : **peu de texte**, aides en `title` ou repliées) : barre de filtres
  compacte à gauche (`.filtres-photos` : recherche, enfants en groupes dépliables `photos.enfants()` — « derniers » gardés
  le dernier jour de garde, « mois » ces 31 jours, « autres » —, activités), photos rangées à droite. Pendant le tri
  (classes `tri-ouvert` / `glisse` sur `#tri-photos`), les lignes des enfants gardent leur taille (demande de Yannis : on dépose surtout dans la zone des photos ; un enfant survolé reste une cible). « À trier » = bouton fixe en bas à droite (`#bouton-a-trier`, pastille) qui ouvre un grand panneau
  (`ouvrirATrier`, Échap) à trois onglets (`vueTri`, `choisirVueTri`) : « À ranger », « Hors horaires », « Ignorées » (aperçus des
  deux derniers chargés seulement quand leur onglet est ouvert) ; on glisse des photos sur un onglet (`depotOnglet` :
  « Ignorées » ← à ranger ou hors horaires, « À ranger » ← hors horaires, ignorées ou rangées ; `mettreDeCote`) ; seuls la zone
  des photos à ranger (`#vue-tri-ranger`) et le bouton « À trier » reçoivent des photos rangées ou des fichiers de l'Explorateur,
  jamais tout le panneau ; une image glissée depuis la page transporte un « fichier » : ignoré (`glisseDepuisPage`), sinon
  la photo était dupliquée ; la sélection (à trier OU rangées, jamais les deux) s'affiche dans `#barre-photos`, fixée en bas,
  pour ne jamais décaler les photos. Bouton maintenu sur le rond `.coche-vignette` puis glissé = sélection de la photo de départ à la dernière survolée
  (`demarrerSelectionGlissee`, retire si la photo de départ était choisie) ; ce geste ne lance jamais le glisser-déposer. Clic bref sur la photo (hors du rond, sans Maj/Ctrl) : menu
  `menuPhoto` (Voir = visionneuse `voirPhoto`, ←/→/Échap ; Afficher dans le dossier ; Sélectionner ; Supprimer = `photos.supprimer`,
  Corbeille de Windows via `SHFileOperationW`, toutes les copies d'une photo rangée) ; clic maintenu = glisser-déposer. Clic sur le fond (rien de cliquable dessous, `CLIC_UTILE`) = sélection annulée, sauf
  si ce clic ferme un menu. Cibles du glisser : `[data-case-enfant]` (cases et pastilles de la barre) ; une photo
  rangée glissée sur le bouton ou le panneau « À trier » y retourne (`remettreRangees`). Des photos à trier glissées sur
  la zone des photos rangées (`#contenu-photos`) sont rangées avec les filtres choisis (enfant, réalisation :
  `filtresDepot`, bandeau `#depot-filtres`) ; sans filtre, la zone n'accepte rien. Déplacements instantanés : ranger, remettre à trier, rattacher,
  modifier et supprimer changent d'abord `donneesPhotos` et la page (photo `enCours` : blanchie, roue `.roue`), puis les fichiers
  suivent dans une file (`enFile`) ; `finirVignette` colore la vignette (numéro via `par_cle` de `/api/photos/ranger`, clé via
  `/api/photos/remettre`) ; `afficherPhotos` attend la fin de la file puis relit tout ; une relecture partie avant un
  nouveau changement (`changementsPhotos`) ou doublée par une plus récente (`lecturePhotos`) est ignorée. Listes de vignettes (à trier, rangées, mises de côté) affichées par tranches
  (`rendreParTranches`, `TRANCHE_PHOTOS`, repère `.suite-photos` suivi par un IntersectionObserver) ; les listes de données
  (`donneesPhotos`) restent complètes : « Tout sélectionner », Maj + clic et les actions ne dépendent pas de ce qui est affiché.
- Activités (`ateliers.py`) : bien distinguer l'**activité** (modèle : titre, description, `a_preparer`, documents dans
  `Activités\<Titre>`, ajoutables dès la création — gardés dans `documentsEnAttente` puis envoyés après l'enregistrement)
  et la **réalisation** (une activité à une date ; appelée « séance » dans les données et le code : `seances`, `S0001`),
  qui porte `prepare` et apparaît dans les échéances (« Réalisation : … », type `activite`). Rubrique en deux onglets
  (`vueAteliers`) : « Activités » (liste + fiche) et « Réalisations » (grand calendrier du mois, un clic sur un jour montre
  ses réalisations en détail : à préparer, documents, photos rangées avec elles). Partout où une réalisation est proposée
  (filtre « Réalisations » des photos : celles qui ont des photos et toutes les passées ; barre de tri), elle s'appelle
  « [titre] du [date] » (`nomRealisation`).
  Les photos rangées avec une réalisation y sont rattachées (choisie ou créée depuis la barre de tri). Une photo déjà
  rangée se rattache après coup (`photos.rattacher`, enfants inchangés) : en la glissant sur une réalisation du filtre
  (`[data-case-realisation]`, classe `glisse-rangees`), ou depuis le détail d'une réalisation, qui propose les photos du
  même jour sans réalisation (`sans_realisation` de `/api/ateliers`).
- Icônes des activités : `ICONES_ACTIVITES` en tête de app.js ([clé, nom, mots du titre, dessin], ajoutées à `PICTOS` en
  `a-<clé>`), même trait que les autres pictogrammes. Champ `icone` de l'activité ; vide = proposée d'après le titre
  (`iconeProposee`). Affichée dans la liste, le calendrier, les réalisations et le filtre des photos (`iconeActivite`).
