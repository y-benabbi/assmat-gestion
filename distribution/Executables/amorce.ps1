# Télécharge (ou met à jour) l'application depuis GitHub, branche « stable »,
# puis lance l'installation. Utilisé par Installer.bat et « Mettre a jour.bat ».
#
#   -DossierProgramme  dossier où créer le raccourci (par défaut : dossier parent de « Executables »)
#   -Relancer          rouvre l'application à la fin (mise à jour depuis l'application)
#   -Source            (tests) dossier local à installer au lieu de GitHub
param([string]$DossierProgramme, [switch]$Relancer, [string]$Source, [string]$Branche = "stable")

$ErrorActionPreference = "Stop"
$Depot = "y-benabbi/assmat-gestion"
$Base = Join-Path $env:LOCALAPPDATA "assmat-gestion"
$Application = Join-Path $Base "application"
if (-not $DossierProgramme -and (Split-Path -Leaf $PSScriptRoot) -eq "Executables" -and
    -not $PSScriptRoot.StartsWith($Application, [StringComparison]::OrdinalIgnoreCase)) {
    $DossierProgramme = Split-Path -Parent $PSScriptRoot
}

Write-Host "Assistante Maternelle — installation / mise à jour" -ForegroundColor Cyan
try {
    if ($Relancer) { Start-Sleep -Seconds 3 }   # laisser l'application se fermer
    New-Item -ItemType Directory -Force $Base | Out-Null
    $temp = Join-Path $env:TEMP ("assmat-" + [guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Force $temp | Out-Null

    if ($Source) {
        $dossierCode = $Source
    } else {
        Write-Host "Téléchargement de la dernière version stable..."
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $zip = Join-Path $temp "code.zip"
        Invoke-WebRequest "https://github.com/$Depot/archive/refs/heads/$Branche.zip" -OutFile $zip -UseBasicParsing
        Expand-Archive $zip -DestinationPath $temp -Force
        $dossierCode = (Get-ChildItem $temp -Directory | Select-Object -First 1).FullName
    }
    if (-not (Test-Path (Join-Path $dossierCode "app\main.py"))) { throw "Le contenu téléchargé est invalide." }

    # Remplacement du code (les paramètres, l'environnement Python et le navigateur sont à côté et conservés).
    $ancienne = Get-Content (Join-Path $Application "VERSION") -ErrorAction SilentlyContinue
    $nouvelle = Get-Content (Join-Path $dossierCode "VERSION") -ErrorAction SilentlyContinue
    & robocopy.exe $dossierCode $Application /MIR /NFL /NDL /NJH /NJS /NP /XD .git tests _test __pycache__ | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "La copie des fichiers a échoué (code robocopy $LASTEXITCODE)." }
    if ($ancienne -and $ancienne -ne $nouvelle) { Write-Host "Version $ancienne -> $nouvelle" -ForegroundColor Green }
    else { Write-Host "Version $nouvelle" -ForegroundColor Green }
    Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue

    # Mise à jour des exécutables et du mode d'emploi du dossier Programme (seulement s'ils ont changé).
    if ($DossierProgramme) {
        $distribution = Join-Path $Application "distribution"
        Get-ChildItem $distribution -File -Recurse | ForEach-Object {
            $cible = Join-Path $DossierProgramme $_.FullName.Substring($distribution.Length + 1)
            if (-not (Test-Path $cible) -or (Get-FileHash $cible).Hash -ne (Get-FileHash $_.FullName).Hash) {
                New-Item -ItemType Directory -Force (Split-Path $cible) | Out-Null
                Copy-Item $_.FullName $cible -Force
            }
        }
    }

    $args_ = @{ SansPause = $true }
    if ($DossierProgramme) { $args_.DossierProgramme = $DossierProgramme }
    & (Join-Path $Application "scripts\installer.ps1") @args_
    $code = $LASTEXITCODE
    if ($code -eq 0 -and $Relancer) {
        Start-Process (Join-Path $Application "Lancer.bat") -WindowStyle Minimized
    }
} catch {
    Write-Host ""
    Write-Host "  [ERREUR] $($_.Exception.Message)" -ForegroundColor Red
    $code = 1
}
Write-Host ""
Read-Host "Appuyez sur Entrée pour fermer"
exit $code
