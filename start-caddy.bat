@echo off
REM %~dp0 is this script's own directory, so the repo can live anywhere.
cd /d "%~dp0"
echo ===================================================
echo   Caddy SSL ve Domain Proxy Yonlendirici Baslatma
echo ===================================================
echo.
REM caddy.exe is no longer kept in the repo. Use a local copy if one is here,
REM otherwise fall back to whatever `caddy` is on PATH.
set "CADDY=caddy"
if exist "%~dp0caddy.exe" set "CADDY=%~dp0caddy.exe"

where %CADDY% >nul 2>&1
if errorlevel 1 if not exist "%~dp0caddy.exe" (
    echo [HATA] Caddy bulunamadi.
    echo         https://caddyserver.com/download adresinden indirip bu klasore
    echo         caddy.exe olarak koyun ya da PATH'e ekleyin.
    pause
    exit /b 1
)

echo Caddy Server baslatiliyor...
echo (Let's Encrypt SSL sertifikalari otomatik olarak uretilecektir.)
echo.
call "%CADDY%" run --config Caddyfile
pause
