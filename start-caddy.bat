@echo off
cd /d "c:\Users\Administrator\Desktop\kroptos"
echo ===================================================
echo   Caddy SSL ve Domain Proxy Yonlendirici Baslatma
echo ===================================================
echo.
echo Caddy Server baslatiliyor...
echo (Let's Encrypt SSL sertifikalari otomatik olarak uretilecektir.)
echo.
call caddy run --config Caddyfile
pause
