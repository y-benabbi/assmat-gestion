# Vérificateur : contrôle que tout est prêt et explique quoi faire sinon.
param([switch]$SansPause)

. (Join-Path $PSScriptRoot "commun.ps1")
$ErrorActionPreference = "Continue"
$erreurs = 0
$alertes = 0
function Err($t, $conseil) { Ecrire-Erreur $t; if ($conseil) { Ecrire-Info "-> $conseil" }; $script:erreurs++ }
function Att($t, $conseil) { Ecrire-Attention $t; if ($conseil) { Ecrire-Info "-> $conseil" }; $script:alertes++ }
$relancer = "Lancez « Executables\Installer.bat » (ou « Mettre a jour.bat »)."

Ecrire-Titre "Système"
$os = Get-CimInstance Win32_OperatingSystem
Ecrire-Ok "$($os.Caption) ($($os.OSArchitecture)) — session $env:USERNAME"

Ecrire-Titre "Application"
$version = Get-Content (Join-Path $Racine "VERSION") -ErrorAction SilentlyContinue
Ecrire-Ok "Version installée : $version ($Racine)"
$manquants = @("app\main.py", "app\pajemploi.py", "app\bibliotheque.py", "app\parametres.py", "app\chemins.py",
               "app\web\index.html", "app\web\app.js", "app\web\style.css", "requirements.txt", "Lancer.bat") |
    Where-Object { -not (Test-Path (Join-Path $Racine $_)) }
if ($manquants) { Err "Fichiers manquants : $($manquants -join ', ')" $relancer }
else { Ecrire-Ok "Tous les fichiers sont présents" }
try {
    $distante = (Invoke-WebRequest "https://raw.githubusercontent.com/y-benabbi/assmat-gestion/stable/VERSION?t=$([DateTime]::Now.Ticks)" -UseBasicParsing -TimeoutSec 10).Content.Trim()
    if ($distante -and $version -and ([version]$distante -gt [version]$version)) {
        Att "Nouvelle version disponible : $distante" "Lancez « Executables\Mettre a jour.bat »."
    } else { Ecrire-Ok "Application à jour" }
} catch { Att "Impossible de vérifier les mises à jour (Internet ?)" }

Ecrire-Titre "Python"
$python = Trouver-Python
if ($python) { Ecrire-Ok "Python compatible : $python" }
else { Err "Aucun Python compatible (3.10 à 3.15) trouvé" $relancer }

if (Venv-Fonctionne) {
    $v = & $PythonVenv -c "import sys; print(sys.version.split()[0])"
    Ecrire-Ok "Environnement de l'application : Python $v"

    $test = & $PythonVenv -c "import flask, playwright, keyring, pypdf, PIL, pillow_heif; print('ok')" 2>&1
    if ("$test" -match "ok$") { Ecrire-Ok "Modules Flask, Playwright, Keyring, pypdf, Pillow et pillow-heif" }
    else { Err "Modules Python manquants" $relancer }

    $test = & $PythonVenv -c "import tkinter; print('ok')" 2>&1
    if ("$test" -match "ok$") { Ecrire-Ok "Fenêtre de choix de dossier (tkinter)" }
    else { Att "tkinter absent : le bouton « Parcourir » ne marchera pas (saisir le chemin à la main)." }

    $script = "from playwright.sync_api import sync_playwright`nwith sync_playwright() as p:`n b = p.chromium.launch(); b.close(); print('ok')"
    $test = & $PythonVenv -c $script 2>&1
    if ("$test" -match "ok$") { Ecrire-Ok "Navigateur Chromium fonctionnel" }
    else { Err "Chromium ne démarre pas" $relancer }
} else {
    Err "Environnement Python de l'application absent ou inutilisable" $relancer
}

Ecrire-Titre "Raccourci"
$prog = Dossier-Programme
$lnkChemin = if ($prog) { Join-Path $prog $NomRaccourci } else { $null }
if ($lnkChemin -and (Test-Path $lnkChemin)) {
    $cible = (New-Object -ComObject WScript.Shell).CreateShortcut($lnkChemin).TargetPath
    if ($cible -eq $Lanceur) { Ecrire-Ok "Raccourci : $lnkChemin" }
    else { Att "Le raccourci pointe vers un autre emplacement ($cible)" $relancer }
} else { Err "Raccourci absent" $relancer }

Ecrire-Titre "Internet"
try {
    Invoke-WebRequest "https://login.urssaf.fr/" -UseBasicParsing -TimeoutSec 15 -Method Head | Out-Null
    Ecrire-Ok "Site Urssaf / Pajemploi joignable"
} catch {
    if ($_.Exception.Response) { Ecrire-Ok "Site Urssaf / Pajemploi joignable" }
    else { Att "Pajemploi injoignable : $($_.Exception.Message)" "Vérifiez la connexion Internet." }
}

Ecrire-Titre "Paramètres de l'application"
$fichier = Join-Path $Base "donnees\parametres.json"
if (Test-Path $fichier) {
    $p = Get-Content $fichier -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($p.identifiant) { Ecrire-Ok "Identifiant Pajemploi renseigné" } else { Att "Identifiant Pajemploi vide" "Onglet Paramètres de l'application." }
    if ($p.dossier_principal -and (Test-Path $p.dossier_principal)) { Ecrire-Ok "Dossier principal : $($p.dossier_principal)" }
    elseif ($p.dossier_principal) { Att "Dossier principal introuvable : $($p.dossier_principal)" "Paramètres de l'application, « Dossier principal »." }
    else { Att "Dossier principal non choisi" "Paramètres de l'application, « Dossier principal »." }
} else {
    Att "Application pas encore paramétrée" "Ouvrez l'application puis l'onglet Paramètres."
}
if (Venv-Fonctionne) {
    $mdp = & $PythonVenv -c "import keyring; print('oui' if keyring.get_password('AssistanteMaternelle-Pajemploi','pajemploi') else 'non')" 2>&1
    if ("$mdp" -match "oui$") { Ecrire-Ok "Mot de passe enregistré dans le Gestionnaire d'identifiants Windows" }
    else { Att "Mot de passe Pajemploi non enregistré pour cette session Windows" "Onglet Paramètres de l'application." }
}

Ecrire-Titre "Bilan"
if ($erreurs) { Write-Host "  $erreurs erreur(s), $alertes point(s) d'attention. Corrigez les erreurs avant d'utiliser l'application." -ForegroundColor Red }
elseif ($alertes) { Write-Host "  Installation correcte, $alertes point(s) d'attention ci-dessus." -ForegroundColor Yellow }
else { Write-Host "  Tout est prêt." -ForegroundColor Green }

if (-not $SansPause) { Write-Host ""; Read-Host "Appuyez sur Entrée pour fermer" }
if ($erreurs) { exit 1 } else { exit 0 }
