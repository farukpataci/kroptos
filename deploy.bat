@echo off
REM %~dp0 is this script's own directory, so the repo can live anywhere.
cd /d "%~dp0"
echo ===================================================
echo   KroptOS Otomatik Deploy ve Guncelleme Sistemi
echo ===================================================
echo.

echo [1/5] En guncel kodlar Git'ten cekiliyor...
call git pull origin main
if %errorlevel% neq 0 (
    echo [HATA] Git pull basarisiz oldu! Guncelleme iptal edildi.
    goto :error
)

echo [2/5] Yeni paket bagimliliklari yukleniyor...
call pnpm install --frozen-lockfile
if %errorlevel% neq 0 (
    echo [HATA] pnpm install basarisiz oldu!
    goto :error
)

echo [3/5] Veritabanı semasi guncelleniyor (Migration)...
call pnpm db:push
if %errorlevel% neq 0 (
    echo [HATA] Prisma db:push basarisiz oldu!
    goto :error
)

echo [4/5] Projeler yeniden derleniyor (Build)...
call pnpm build
if %errorlevel% neq 0 (
    echo [HATA] Derleme (pnpm build) basarisiz oldu!
    goto :error
)

echo [5/5] PM2 Servisleri kesintisiz reload ediliyor (Zero-Downtime)...
call pm2 reload ecosystem.config.js
call pm2 save
echo.
echo ===================================================
echo   [BASARILI] Guncellemeler canliya kesintisiz alindi!
echo ===================================================
pause
exit /b 0

:error
echo [HATA] Deploy adimlarinda hata meydana geldi. Eski surum calismaya devam ediyor.
pause
exit /b 1
