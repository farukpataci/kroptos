<#
.SYNOPSIS
    Acilista `pm2 resurrect` calistiran Zamanlanmis Gorev'i kurar.

.DESCRIPTION
    Windows'ta `pm2 startup` desteklenmiyor ("Init system not found"), bu yuzden
    kroptos-backend / kroptos-frontend sureclerini acilista geri yuklemek icin
    Task Scheduler kullaniyoruz. Ayrinti ve geri alma: docs/PM2_WINDOWS_BOOT.md

.NOTES
    YUKSELTILMIS PowerShell gerekir ("Yonetici olarak calistir").

    GERI ALMA:
        Unregister-ScheduledTask -TaskName 'kroptos-pm2-resurrect' -Confirm:$false
#>

$ErrorActionPreference = 'Stop'

$TaskName = 'kroptos-pm2-resurrect'
$RepoRoot = 'C:\Users\Administrator\Desktop\kroptos'
$Pm2Cmd   = 'C:\Users\Administrator\AppData\Roaming\npm\pm2.cmd'

# --- On kosullar ---------------------------------------------------------
$isElevated = (New-Object Security.Principal.WindowsPrincipal(
    [Security.Principal.WindowsIdentity]::GetCurrent()
)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isElevated) {
    Write-Error "Bu script yukseltilmis PowerShell gerektiriyor. PowerShell'i 'Yonetici olarak calistir' ile acip tekrar deneyin."
    exit 1
}

if (-not (Test-Path $Pm2Cmd)) {
    Write-Error "pm2.cmd bulunamadi: $Pm2Cmd  (pm2 global kurulu mu?)"
    exit 1
}

if (-not (Test-Path $RepoRoot)) {
    Write-Error "Repo dizini bulunamadi: $RepoRoot"
    exit 1
}

# --- Varsa eskisini kaldir (idempotent) ----------------------------------
if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Write-Host "Mevcut gorev bulundu, kaldiriliyor..."
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# --- Gorevi kur ----------------------------------------------------------
$action = New-ScheduledTaskAction `
    -Execute 'cmd.exe' `
    -Argument "/c `"$Pm2Cmd`" resurrect" `
    -WorkingDirectory $RepoRoot

# 1 dakika gecikme kasitli: acilista DB/ag hazir olmadan backend kalkarsa duser.
$trigger = New-ScheduledTaskTrigger -AtStartup
$trigger.Delay = 'PT1M'

# S4U: kullanici oturum acmasa da calisir, parola saklamaya gerek yok.
$principal = New-ScheduledTaskPrincipal `
    -UserId "$env:COMPUTERNAME\Administrator" `
    -LogonType S4U `
    -RunLevel Highest

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit ([TimeSpan]::Zero)

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    -Description 'Kroptos: acilista pm2 resurrect ile kroptos-backend ve kroptos-frontend sureclerini geri yukler. Kaldirma: Unregister-ScheduledTask -TaskName kroptos-pm2-resurrect -Confirm:$false  |  Belge: docs/PM2_WINDOWS_BOOT.md' | Out-Null

# --- Dogrula -------------------------------------------------------------
$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if (-not $task) {
    Write-Error "Gorev kaydedilemedi."
    exit 1
}

Write-Host ""
Write-Host "Gorev kuruldu: $TaskName  (durum: $($task.State))"
$task.Actions | Select-Object Execute, Arguments, WorkingDirectory | Format-List
Write-Host "Geri alma:  Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false"
Write-Host ""
Write-Host "HATIRLATMA: pm2 surec listesini degistirdiginizde 'pm2 save' calistirin;"
Write-Host "acilista geri yuklenen sey dump.pm2 dosyasidir."
