# Fonctions partagées par l'installateur et le vérificateur.
#
# Les programmes externes (py, pip, winget...) écrivent des messages ordinaires sur la
# sortie d'erreur : on ne s'arrête donc pas sur ces messages, chaque étape vérifie
# elle-même son code de retour ($LASTEXITCODE) et les cmdlets importantes utilisent
# -ErrorAction Stop.

$ErrorActionPreference = "Continue"
$Base = Join-Path $env:LOCALAPPDATA "assmat-gestion"
$Racine = Split-Path -Parent $PSScriptRoot          # dossier « application » (le code)
$Venv = Join-Path $Base "python"
$PythonVenv = Join-Path $Venv "Scripts\python.exe"
$Lanceur = Join-Path $Racine "Lancer.bat"
# Le raccourci vise directement pythonw.exe (un programme, pas un .bat) : Windows propose alors « Épingler à la
# barre des tâches », et aucune fenêtre noire ne s'ouvre.
$PythonwVenv = Join-Path $Venv "Scripts\pythonw.exe"
$ScriptPrincipal = Join-Path $Racine "app\main.py"
$FichierProgramme = Join-Path $Base "dossier-programme.txt"
$NomRaccourci = "Assistante Maternelle.lnk"
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $Base "navigateurs"
$VersionsAcceptees = @("3.13", "3.12", "3.11", "3.14", "3.15", "3.10")

function Ecrire-Titre($texte) { Write-Host ""; Write-Host "=== $texte ===" -ForegroundColor Cyan }
function Ecrire-Ok($texte) { Write-Host "  [OK]        $texte" -ForegroundColor Green }
function Ecrire-Attention($texte) { Write-Host "  [ATTENTION] $texte" -ForegroundColor Yellow }
function Ecrire-Erreur($texte) { Write-Host "  [ERREUR]    $texte" -ForegroundColor Red }
function Ecrire-Info($texte) { Write-Host "              $texte" }

# Dossier où se trouvent le raccourci et les exécutables (ex. « Programme » dans OneDrive).
function Dossier-Programme {
    if (Test-Path $FichierProgramme) { return (Get-Content $FichierProgramme -Raw -Encoding UTF8).Trim() }
    return $null
}

# Renvoie le chemin d'un python.exe compatible (version préférée en premier), ou $null.
function Trouver-Python {
    $candidats = @()
    # « py -0p » liste les Python installés sans rien installer ni poser de question
    # (on n'appelle jamais « py -3.12 » : le gestionnaire Python récent proposerait de l'installer).
    if (Get-Command py.exe -ErrorAction SilentlyContinue) {
        $liste = & py.exe -0p 2>$null
        foreach ($ligne in $liste) {
            if ("$ligne" -match '([A-Za-z]:\\.*?\\python\.exe)') { $candidats += $Matches[1] }
        }
    }
    foreach ($nom in @("python.exe", "python3.exe")) {
        $c = Get-Command $nom -ErrorAction SilentlyContinue -All
        if ($c) { $candidats += $c | ForEach-Object { $_.Source } }
    }
    # Emplacements d'installation habituels (python.org, winget) : <parent>\Python3xx\python.exe
    foreach ($parent in @("$env:LOCALAPPDATA\Programs\Python", $env:ProgramFiles, "C:\")) {
        Get-ChildItem -Path $parent -Directory -Filter "Python*" -ErrorAction SilentlyContinue | ForEach-Object {
            $exe = Join-Path $_.FullName "python.exe"
            if (Test-Path $exe) { $candidats += $exe }
        }
    }
    $trouves = @{}
    foreach ($exe in $candidats | Select-Object -Unique) {
        if ($exe -like "*WindowsApps*" -or -not (Test-Path $exe)) { continue }   # alias du Microsoft Store
        $v = & $exe -c "import sys; print('%d.%d' % sys.version_info[:2])" 2>$null
        if ($LASTEXITCODE -eq 0 -and $v -and $VersionsAcceptees -contains "$v".Trim() -and -not $trouves["$v".Trim()]) {
            $trouves["$v".Trim()] = $exe
        }
    }
    foreach ($v in $VersionsAcceptees) { if ($trouves[$v]) { return $trouves[$v] } }
    return $null
}

function Venv-Fonctionne {
    if (-not (Test-Path $PythonVenv)) { return $false }
    & $PythonVenv -c "import sys" 2>$null
    return ($LASTEXITCODE -eq 0)
}
