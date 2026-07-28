@echo off
REM %~dp0 is this script's own directory, so the repo can live anywhere.
cd /d "%~dp0"
echo ===================================================
echo   KroptOS Production Sunucularini Baslatma Araci
echo ===================================================
echo.
echo PM2 servisleri baslatiliyor...
call pm2 start ecosystem.config.js
call pm2 save
echo.
echo [BAŞARILI] KroptOS servisleri production modda baslatildi!
echo Sunucu durumunu kontrol etmek icin: pm2 status
echo Sunucu loglarini izlemek icin: pm2 logs
echo.
pause
