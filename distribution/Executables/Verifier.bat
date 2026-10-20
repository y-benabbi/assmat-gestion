@echo off
title Verification - Assistante Maternelle
set "VERIF=%LOCALAPPDATA%\assmat-gestion\application\scripts\verifier.ps1"
if not exist "%VERIF%" (
    echo L'application n'est pas installee sur cette session Windows.
    echo Lancez d'abord "Installer.bat".
    pause
    exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%VERIF%"
