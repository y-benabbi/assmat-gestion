@echo off
title Mise a jour - Assistante Maternelle
powershell.exe -NoProfile -Command "try { Invoke-WebRequest http://127.0.0.1:8765/api/quitter -Method Post -UseBasicParsing -TimeoutSec 3 | Out-Null; Start-Sleep 2 } catch {}"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0amorce.ps1" & exit /b
