# assmat-gestion

Application locale (page web + serveur sur `http://127.0.0.1:8765`) pour centraliser les démarches
d'une assistante maternelle.

**Première fonctionnalité : bulletins de salaire Pajemploi**
- connexion automatique à Pajemploi avec les identifiants de l'assistante maternelle (mot de passe rangé
  dans le Gestionnaire d'identifiants Windows, jamais dans un fichier) ;
- vérifications supplémentaires prises en charge : un code reçu par e-mail ou SMS se saisit dans
  l'application ; toute autre étape ouvre une fenêtre de navigateur où l'utilisatrice la termine elle-même ;
- comparaison avec le dossier local (y compris les fichiers déjà nommés à la main, par exemple
  `paje_bulletinsalaire Dupont 08 2025.pdf`) et affichage des bulletins manquants ;
- bouton « Récupérer les N bulletins de salaire manquants » : rangement par client et par date, sous un
  nom paramétrable (par défaut `Bulletin de salaire - NOM CLIENT - YYYY-MM`, dans un dossier `NOM CLIENT`).

## Branches

| Branche  | Rôle |
|----------|------|
| `main`   | développement |
| `stable` | version distribuée : l'installateur et la mise à jour téléchargent cette branche |

Publier une nouvelle version : augmenter `VERSION`, puis fusionner `main` dans `stable` :

```bash
git checkout stable && git merge --ff-only main && git push && git checkout main
```

L'application affiche alors un bandeau « Une nouvelle version est disponible » avec un bouton de mise à jour.

## Installation sur l'ordinateur de l'assistante maternelle

1. Copier le contenu de `distribution/` dans un dossier de son choix (ex. `Programme`).
2. Lancer `Executables\Installer.bat`. Il :
   - télécharge la branche `stable` dans `%LOCALAPPDATA%\assmat-gestion\application` ;
   - installe Python 3.12 si aucun Python 3.10 à 3.15 n'est présent (winget, sinon python.org) ;
   - crée l'environnement Python (`%LOCALAPPDATA%\assmat-gestion\python`) et installe Flask, Playwright et Keyring ;
   - télécharge le navigateur Chromium utilisé pour Pajemploi (environ 200 Mo) ;
   - crée le raccourci **Assistante Maternelle** à la racine du dossier choisi ;
   - lance le vérificateur.
3. Ouvrir l'application avec le raccourci, puis remplir l'onglet **Paramètres** (identifiant, mot de passe,
   dossier des bulletins).

| Exécutable | Rôle |
|------------|------|
| `Installer.bat` | première installation (peut être relancé sans risque) |
| `Mettre a jour.bat` | télécharge la dernière version `stable` et met à jour les modules |
| `Verifier.bat` | contrôle Python, modules, navigateur, raccourci, accès Internet et paramètres |

Prérequis : Windows 10/11 64 bits, connexion Internet. Aucun droit administrateur n'est nécessaire.

Données conservées lors des mises à jour (`%LOCALAPPDATA%\assmat-gestion`) : `donnees\parametres.json`,
`profil-navigateur\` (Pajemploi reconnaît l'appareil, moins de codes de vérification), `journaux\`.

## Navigateur

Pajemploi refuse les navigateurs sans fenêtre (« headless ») : l'application ouvre un vrai Chromium
(profil dédié), réduit dans la barre des tâches. Il s'affiche seul si une vérification doit être faite
à la main. Les tests `tests/test_page_connexion.py` (vraie page de connexion, sans se connecter) et
`tests/test_extraction.py` (pages imitant Pajemploi) servent de contrôle.

## Si Pajemploi change son site

La page des bulletins est repérée par des règles générales (liens « bulletin », périodes, nom de
l'employeur). Si la détection échoue, l'application enregistre un diagnostic (capture, HTML, réponses
JSON, sans mot de passe) dans `%LOCALAPPDATA%\assmat-gestion\journaux\diagnostics`, qui permet d'adapter
`app/pajemploi.py`. En attendant, le mode assisté (« Ouvrir Pajemploi dans une fenêtre », puis « Analyser
la page affichée ») permet de continuer.

## Développement

```bash
py -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m playwright install chromium
.venv\Scripts\python app\main.py
.venv\Scripts\python tests\test_bibliotheque.py
.venv\Scripts\python tests\test_api.py
.venv\Scripts\python tests\test_extraction.py
.venv\Scripts\python tests\test_page_connexion.py
```
