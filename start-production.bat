@echo off
cd /d "c:\Users\Administrator\Desktop\kroptos"
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
