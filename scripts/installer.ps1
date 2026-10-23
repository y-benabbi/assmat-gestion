# Prépare l'application déjà téléchargée (appelé par amorce.ps1).
# Peut être relancé sans risque : il ne refait que ce qui manque.
param([string]$DossierProgramme, [switch]$SansPause)

. (Join-Path $PSScriptRoot "commun.ps1")
$Journal = Join-Path $Base "journaux\installation.log"
New-Item -ItemType Directory -Force (Split-Path $Journal) | Out-Null
Start-Transcript -Path $Journal -Append | Out-Null

try {
    if ($DossierProgramme) {
        [IO.File]::WriteAllText($FichierProgramme, $DossierProgramme, (New-Object Text.UTF8Encoding $false))   # sans BOM
    } else {
        $DossierProgramme = Dossier-Programme
    }

    Ecrire-Titre "1/5  Python"
    $python = Trouver-Python
    if ($python) {
        Ecrire-Ok "Python trouvé : $python"
    } else {
        Ecrire-Info "Python n'est pas installé : installation de Python 3.12 (quelques minutes)..."
        $installe = $false
        if (Get-Command winget.exe -ErrorAction SilentlyContinue) {
            try {
                & winget.exe install -e --id Python.Python.3.12 --scope user --silent `
                    --accept-package-agreements --accept-source-agreements
                $installe = ($LASTEXITCODE -eq 0)
            } catch { $installe = $false }
        }
        if (-not $installe) {
            Ecrire-Info "Téléchargement de Python depuis python.org..."
            $setup = Join-Path $env:TEMP "python-3.12.10-amd64.exe"
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            Invoke-WebRequest "https://www.python.org/ftp/python/3.12.10/python-3.12.10-amd64.exe" -OutFile $setup -UseBasicParsing -ErrorAction Stop
            $p = Start-Process $setup -ArgumentList "/quiet InstallAllUsers=0 PrependPath=1 Include_launcher=1 Include_tcltk=1 Include_test=0" -Wait -PassThru -ErrorAction Stop
            Remove-Item $setup -ErrorAction SilentlyContinue
            if ($p.ExitCode -ne 0) { throw "L'installation de Python a échoué (code $($p.ExitCode))." }
        }
        $env:Path = [Environment]::GetEnvironmentVariable("Path", "User") + ";" + [Environment]::GetEnvironmentVariable("Path", "Machine")
        $python = Trouver-Python
        if (-not $python) { $python = Get-ChildItem "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName }
        if (-not $python) { throw "Python a été installé mais reste introuvable. Redémarrez l'ordinateur puis relancez l'installateur." }
        Ecrire-Ok "Python installé : $python"
    }

    Ecrire-Titre "2/5  Environnement Python de l'application"
    if (Venv-Fonctionne) {
        Ecrire-Ok "Environnement déjà présent"
    } else {
        if (Test-Path $Venv) {
            Ecrire-Info "Environnement existant inutilisable : il est recréé."
            Remove-Item $Venv -Recurse -Force -ErrorAction Stop
        }
        & $python -m venv $Venv
        if (-not (Venv-Fonctionne)) { throw "Impossible de créer l'environnement Python." }
        Ecrire-Ok "Environnement créé"
    }

    Ecrire-Titre "3/5  Modules Python (Flask, Playwright, Keyring)"
    & $PythonVenv -m pip install --disable-pip-version-check --quiet --upgrade pip
    & $PythonVenv -m pip install --disable-pip-version-check --quiet -r (Join-Path $Racine "requirements.txt")
    if ($LASTEXITCODE -ne 0) { throw "L'installation des modules Python a échoué (connexion Internet ?)." }
    Ecrire-Ok "Modules installés"

    Ecrire-Titre "4/5  Navigateur automatisé (Chromium, environ 200 Mo)"
    & $PythonVenv -m playwright install chromium
    if ($LASTEXITCODE -ne 0) { throw "L'installation du navigateur Chromium a échoué." }
    Ecrire-Ok "Chromium installé"

    Ecrire-Titre "5/5  Raccourcis"
    # Même raccourci dans le dossier Programme et dans le menu Démarrer (où l'on peut l'épingler à la barre des tâches).
    function Creer-Raccourci($chemin) {
        $shell = New-Object -ComObject WScript.Shell
        $lnk = $shell.CreateShortcut($chemin)
        $lnk.TargetPath = $PythonwVenv
        $lnk.Arguments = "`"$ScriptPrincipal`""
        $lnk.WorkingDirectory = $Racine
        $lnk.WindowStyle = 1
        $lnk.IconLocation = "$(Join-Path $Racine "app\web\icone.ico"),0"   # logo du menu (outils\creer_icone.py)
        $lnk.Description = "Ouvrir l'application Assistante Maternelle"
        $lnk.Save()
        Ecrire-Ok "Raccourci : $chemin"
    }
    if ($DossierProgramme -and (Test-Path $DossierProgramme)) {
        Creer-Raccourci (Join-Path $DossierProgramme $NomRaccourci)
    } else {
        Ecrire-Attention "Dossier du raccourci inconnu : raccourci du dossier Programme non créé."
    }
    try {
        Creer-Raccourci (Join-Path ([Environment]::GetFolderPath("Programs")) $NomRaccourci)
    } catch {
        Ecrire-Attention "Raccourci du menu Démarrer non créé : $($_.Exception.Message)"
    }

    Write-Host ""
    Write-Host "Installation terminée." -ForegroundColor Green
    & (Join-Path $PSScriptRoot "verifier.ps1") -SansPause
    $code = 0
} catch {
    Write-Host ""
    Ecrire-Erreur $_.Exception.Message
    Ecrire-Info "Journal complet : $Journal"
    $code = 1
} finally {
    Stop-Transcript | Out-Null
}
if (-not $SansPause) { Write-Host ""; Read-Host "Appuyez sur Entrée pour fermer" }
exit $code
