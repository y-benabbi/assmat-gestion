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
  donnees.py         profil (champs globaux des courriers), fiches contrats, échéances (JSON dans donnees\)
  revenus.py         lecture des montants des bulletins PDF (pypdf, cache donnees\revenus.json), totaux
  courriers.py       demande de dérogation : texte proposé, page imprimable, PDF via Chromium sans fenêtre
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
.venv\Scripts\python tests\test_courriers.py       # demande de dérogation (profil et contrats fictifs), PDF
.venv\Scripts\python app\main.py                     # lancer l'application
```

Tester l'installateur sans toucher au vrai `%LOCALAPPDATA%` : dans PowerShell, définir
`$env:LOCALAPPDATA` vers `_test\...\localappdata`, puis lancer
`distribution\Executables\amorce.ps1 -Source <racine du dépôt> -DossierProgramme <_test\...\Programme>`.

## Pièges connus

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
- `.bat` : texte ASCII uniquement ; une mise à jour peut réécrire le `.bat` en cours d'exécution, d'où
  `& exit /b` sur la même ligne que l'appel PowerShell.
- Classement (paramètre `organisation`) : `client`, `client_annee`, `annee`, `annee_client`
  (`bibliotheque.ORGANISATIONS`). La détection des fichiers existants est récursive et traverse les
  dossiers d'année (`RE_ANNEE`) : elle doit marcher quel que soit le classement, même mélangé.
- Formats de nom : mots-clés `NOM CLIENT`, `ENFANT`, `YYYY`, `YY`, `MM`, `MOIS`
  (`bibliotheque.appliquer_format`). Plusieurs bulletins d'un même client le même mois : suffixe
  ` - Prénom` de l'enfant ; les fichiers existants qui citent le prénom sont attribués en priorité.
- Interface : menu latéral par catégories (`data-onglet`), chaque rubrique optionnelle porte `data-module`
  (masquée si `parametres.modules[nom]` est faux). Les anciens Paramètres sont dans « Mes fonctionnalités ».
- `profil.json`, `contrats.json`, `revenus.json` (dans `donnees\`) contiennent des données personnelles réelles :
  jamais dans le dépôt. Les libellés lus dans les bulletins sont dans `revenus.RUBRIQUES` (augmenter
  `VERSION_LECTURE` quand ils changent, pour relire les bulletins).
