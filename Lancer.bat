@echo off
set "BASE=%LOCALAPPDATA%\assmat-gestion"
set "PLAYWRIGHT_BROWSERS_PATH=%BASE%\navigateurs"
if not exist "%BASE%\python\Scripts\pythonw.exe" (
    powershell.exe -NoProfile -Command "Add-Type -AssemblyName PresentationFramework; [Windows.MessageBox]::Show('L''application n''est pas encore installee sur cette session Windows. Lancez Executables\Installer.bat.', 'Assistante Maternelle') | Out-Null"
    exit /b 1
)
start "" "%BASE%\python\Scripts\pythonw.exe" "%~dp0app\main.py"
