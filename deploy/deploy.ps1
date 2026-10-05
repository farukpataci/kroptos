<#
.SYNOPSIS
  KroptOS deploy: bir commit'i ayrı klasörde derler, migration'ı yedekle uygular, sürümü değiştirir,
  sağlığı doğrular; başarısızsa önceki sürüme döner.

.DESCRIPTION
  Sunucudaki düzen (ortam başına):
    <Root>\repo\              git kopyası (yalnız fetch; worktree kaynağı)
    <Root>\releases\<sha>\    her sürüm kendi klasöründe (git worktree)
    <Root>\current            çalışan sürüme junction; pm2 süreçleri buradan çalışır
    <Root>\shared\backend.env  sırlar (repoda yok) -> her sürümün packages\backend\.env'ine kopyalanır
    <Root>\shared\frontend.env NEXT_PUBLIC_* (derleme anında gömülür)
    <Root>\backups\           migration öncesi pg_dump dosyaları
    <Root>\deploy.log

  Akış: kilit -> fetch -> worktree -> install/build -> (bekleyen migration varsa) yedek + migrate + RLS
        -> current'ı çevir -> pm2 reload -> /api/health sha kontrolü -> başarısızsa geri dön -> eski sürüm temizliği.

  Migration geri alınmaz (yalnız ileri). Geri dönüşte yeni şema eski kodla çalışmak zorundadır:
  kolon/tablo silme ve yeniden adlandırma iki ayrı sürümde yapılır (önce kodu bırak, sonra şemayı).

  Yol haritası: docs/plans/surekli-teslim-yol-haritasi.md (adım 9). Kurulum: deploy/README.md.

.PARAMETER Environment
  production | staging -> deploy\environments\<ad>.psd1. -ConfigFile ile başka bir dosya verilebilir.

.PARAMETER Ref
  Deploy edilecek commit (runner github.sha verir). Boşsa origin/<Branch>.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File deploy\deploy.ps1 -Environment production -Ref 930d97a
#>
[CmdletBinding()]
param(
    [ValidateSet('production', 'staging')]
    [string]$Environment,
    [string]$ConfigFile,
    [string]$Ref
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 3.0

# ------------------------------------------------------------------ yapılandırma
if (-not $ConfigFile) {
    if (-not $Environment) { throw '-Environment veya -ConfigFile gerekli.' }
    $ConfigFile = Join-Path $PSScriptRoot "environments\$Environment.psd1"
}
$Cfg = Import-PowerShellDataFile -Path $ConfigFile
foreach ($k in 'Name', 'Root', 'RepoUrl', 'Branch', 'AppPrefix', 'BackendPort', 'FrontendPort', 'KeepReleases', 'HealthTimeoutSec', 'PgDump', 'ExpectedAppEnv') {
    if (-not $Cfg.ContainsKey($k)) { throw "Yapılandırmada '$k' yok: $ConfigFile" }
}

$Root     = $Cfg.Root
$RepoDir  = Join-Path $Root 'repo'
$RelDir   = Join-Path $Root 'releases'
$Current  = Join-Path $Root 'current'
$Shared   = Join-Path $Root 'shared'
$Backups  = Join-Path $Root 'backups'
$Log      = Join-Path $Root 'deploy.log'
$LockFile = Join-Path $Root 'deploy.lock'
$Ecosystem = Join-Path $PSScriptRoot 'ecosystem.config.js'

foreach ($d in $Root, $RelDir, $Shared, $Backups) {
    if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d | Out-Null }
}

# ------------------------------------------------------------------ yardımcılar
# Log'a paylaşımlı erişimle ekler: log'u izleyen bir süreç (tail, editör, antivirüs) dosyayı
# açık tutarken Add-Content "başka işlem kullanıyor" hatası verip deploy'u düşürüyordu (2026-10-05 provası).
function Add-Log([string]$Text) {
    $bytes = [System.Text.UTF8Encoding]::new($false).GetBytes($Text + "`r`n")
    for ($i = 1; ; $i++) {
        try {
            $fs = [System.IO.File]::Open($Log, 'Append', 'Write', 'ReadWrite, Delete')
            try { $fs.Write($bytes, 0, $bytes.Length) } finally { $fs.Dispose() }
            return
        } catch [System.IO.IOException] {
            if ($i -ge 20) { throw }
            Start-Sleep -Milliseconds 250
        }
    }
}

function Write-Step([string]$Message) {
    $line = "[{0}] [{1}] {2}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Cfg.Name, $Message
    Write-Host $line
    Add-Log $line
}

# Eşleşmeler -cmatch: Türkçe yerel ayarda büyük/küçük harfe duyarsız -match 'I'yı [A-Za-z]'ye
# eşlemez (MIGRATION, ENCRYPTION, REDIS anahtarları okunmuyordu; 2026-10-05 provası).

# Dış komutlar cmd üzerinden: PowerShell 5.1 stderr'i hata kaydına sarar ve ikili çıktıyı bozar.
# Çıktı log'a eklenir; çıkış kodu sıfır değilse istisna fırlatılır.
function Invoke-Cmd([string]$CommandLine, [string]$WorkDir = $Root, [string]$Label = $CommandLine) {
    Add-Log "`$ $CommandLine   (cwd: $WorkDir)"
    Push-Location $WorkDir
    try {
        & cmd.exe /d /c "$CommandLine >> `"$Log`" 2>&1"
        $code = $LASTEXITCODE
    } finally {
        Pop-Location
    }
    if ($code -ne 0) { throw "Başarısız (çıkış $code): $Label — ayrıntı: $Log" }
}

# Çıktısı gereken komutlar için (kısa çıktılar).
function Get-CmdOutput([string]$CommandLine, [string]$WorkDir = $Root) {
    $tmp = [System.IO.Path]::GetTempFileName()
    Push-Location $WorkDir
    try {
        & cmd.exe /d /c "$CommandLine > `"$tmp`" 2>&1"
        $code = $LASTEXITCODE
    } finally {
        Pop-Location
    }
    $out = Get-Content -Path $tmp -Raw -Encoding UTF8
    Remove-Item -Path $tmp -Force
    if ($null -eq $out) { $out = '' }
    Add-Log "`$ $CommandLine (çıkış $code)`r`n$out"
    return @{ Code = $code; Output = $out }
}

function Read-EnvFile([string]$Path) {
    $map = @{}
    foreach ($line in Get-Content -Path $Path -Encoding UTF8) {
        if ($line -cmatch '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') {
            $map[$Matches[1]] = $Matches[2].Trim('"').Trim("'")
        }
    }
    return $map
}

function Get-CurrentTarget {
    if (-not (Test-Path $Current)) { return $null }
    $item = Get-Item -Path $Current -Force
    if (-not ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw "$Current bir junction değil; elle müdahale gerekiyor."
    }
    return [string]($item.Target | Select-Object -First 1)
}

# Junction'ı değiştirir. `rmdir` (rd) junction'ı siler, hedefine dokunmaz.
function Set-CurrentTarget([string]$Target) {
    if (Test-Path $Current) { & cmd.exe /d /c "rmdir `"$Current`"" | Out-Null }
    New-Item -ItemType Junction -Path $Current -Target $Target | Out-Null
}

function Invoke-Pm2Reload {
    $env:KROPTOS_ROOT = $Root
    $env:KROPTOS_APP_PREFIX = $Cfg.AppPrefix
    $env:KROPTOS_BACKEND_PORT = [string]$Cfg.BackendPort
    $env:KROPTOS_FRONTEND_PORT = [string]$Cfg.FrontendPort
    Invoke-Cmd "pm2 startOrReload `"$Ecosystem`" --update-env" -Label 'pm2 startOrReload'
    Invoke-Cmd 'pm2 save' -Label 'pm2 save'
}

# Backend /api/health 'sha' alanı beklenen commit'le başlayana ve frontend 200 dönene kadar bekler.
function Wait-Healthy([string]$ExpectedSha) {
    $deadline = (Get-Date).AddSeconds($Cfg.HealthTimeoutSec)
    $last = 'yanıt yok'
    while ((Get-Date) -lt $deadline) {
        try {
            $h = Invoke-RestMethod -Uri "http://127.0.0.1:$($Cfg.BackendPort)/api/health" -TimeoutSec 5
            if ($h.status -eq 'ok' -and $h.sha -and $ExpectedSha.StartsWith([string]$h.sha, [System.StringComparison]::Ordinal)) {
                $fe = Invoke-WebRequest -Uri "http://127.0.0.1:$($Cfg.FrontendPort)/" -UseBasicParsing -TimeoutSec 15
                if ($fe.StatusCode -eq 200) { return $true }
                $last = "frontend HTTP $($fe.StatusCode)"
            } else {
                $last = "backend sha='$($h.sha)' status='$($h.status)'"
            }
        } catch {
            $last = $_.Exception.Message
        }
        Start-Sleep -Seconds 3
    }
    Write-Step "Sağlık kontrolü zaman aşımı: $last"
    return $false
}

function Test-ReleaseName([string]$Name) { return $Name -cmatch '^[0-9a-f]{40}$' }

# Yalnız releases\<40 hex> klasörü, junction değilse silinir. rmdir /s junction'ları izlemez.
function Remove-Release([string]$Path) {
    $item = Get-Item -Path $Path -Force
    if (-not (Test-ReleaseName $item.Name)) { throw "Silinmedi, sürüm klasörü değil: $Path" }
    if ($item.Parent.FullName -ne (Get-Item $RelDir).FullName) { throw "Silinmedi, releases altında değil: $Path" }
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Silinmedi, junction: $Path" }
    & cmd.exe /d /c "rmdir /s /q `"$Path`"" | Out-Null
    if (Test-Path $Path) { throw "Silinemedi: $Path" }
}

# ------------------------------------------------------------------ kilit
try {
    $lock = [System.IO.File]::Open($LockFile, 'CreateNew', 'Write', 'None')
} catch {
    throw "Başka bir deploy sürüyor ya da yarıda kaldı ($LockFile). Çalışan deploy yoksa dosyayı silip tekrar deneyin."
}
$lock.Close()

$exitCode = 0
try {
    Write-Step "==== deploy başlıyor (ref: $(if ($Ref) { $Ref } else { "origin/$($Cfg.Branch)" }))"

    # -------------------------------------------------------------- araçlar
    # Komutlar cmd üzerinden çalışır; PATH'te olmayan araç ortada "not recognized" ile düşer.
    # Get-Command değil `where`: Get-Command pnpm.ps1'i de bulur, cmd ise yalnız .cmd/.exe çalıştırır.
    $missing = @('git', 'node', 'pnpm', 'npx', 'pm2') | Where-Object { & cmd.exe /d /c "where $_ >nul 2>nul"; $LASTEXITCODE -ne 0 }
    if ($missing) { throw "PATH'te bulunamadı: $($missing -join ', '). Deploy'u çalıştıran hesabın PATH'ini kontrol edin." }
    if (-not (Test-Path -LiteralPath $Cfg.PgDump)) { throw "pg_dump bulunamadı: $($Cfg.PgDump) (ortam .psd1 dosyasında PgDump)" }
    # Windows, yolu 260 karakteri aşan .exe'yi LongPathsEnabled açıkken de başlatamaz. En derin yol
    # (prisma schema-engine) kökten ~150 karakter uzakta; uzun kökte migrate ENOENT ile düşer (2026-10-05 provası).
    if ($Root.Length -gt 60) { throw "Kök klasör yolu çok uzun ($($Root.Length) karakter, en çok 60): $Root" }
    $longPaths = (Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -Name LongPathsEnabled -ErrorAction SilentlyContinue).LongPathsEnabled
    if ($longPaths -ne 1) { Write-Step 'UYARI: Windows LongPathsEnabled kapalı; uzun node_modules yollarında araçlar düşebilir (deploy/README.md).' }

    # -------------------------------------------------------------- sırlar ve ortam kontrolü
    $backendEnvPath = Join-Path $Shared 'backend.env'
    $frontendEnvPath = Join-Path $Shared 'frontend.env'
    foreach ($p in $backendEnvPath, $frontendEnvPath) {
        if (-not (Test-Path $p)) { throw "Eksik: $p (kurulum: deploy/README.md)" }
    }
    $backendEnv = Read-EnvFile $backendEnvPath
    foreach ($k in 'DATABASE_URL', 'DATABASE_MIGRATION_URL', 'ENCRYPTION_KEY', 'JWT_SECRET') {
        if (-not $backendEnv[$k]) { throw "shared\backend.env içinde $k yok." }
    }
    if ($backendEnv['APP_ENV'] -ne $Cfg.ExpectedAppEnv) {
        throw "shared\backend.env APP_ENV='$($backendEnv['APP_ENV'])', beklenen '$($Cfg.ExpectedAppEnv)'. Yanlış ortamın sırları olabilir; durduruldu."
    }

    # -------------------------------------------------------------- kod
    if (-not (Test-Path (Join-Path $RepoDir '.git'))) {
        Write-Step "repo yok, klonlanıyor: $($Cfg.RepoUrl)"
        Invoke-Cmd "git clone --no-checkout `"$($Cfg.RepoUrl)`" `"$RepoDir`"" -Label 'git clone'
    }
    # releases\<40 hex>\ + migration yolları Windows'un 260 karakter sınırını aşabiliyor
    # ("Filename too long", 2026-10-05 provası). Repo yapılandırması worktree'lere de geçer.
    Invoke-Cmd 'git config core.longpaths true' -WorkDir $RepoDir
    Invoke-Cmd 'git fetch --prune origin' -WorkDir $RepoDir -Label 'git fetch'
    $target = if ($Ref) { $Ref } else { "origin/$($Cfg.Branch)" }
    $r = Get-CmdOutput "git rev-parse --verify `"$target^{commit}`"" -WorkDir $RepoDir
    if ($r.Code -ne 0) { throw "Commit bulunamadı: $target" }
    $sha = $r.Output.Trim()
    $release = Join-Path $RelDir $sha
    Write-Step "sürüm: $sha"

    $previous = Get-CurrentTarget
    if ($previous -and ((Split-Path $previous -Leaf) -eq $sha)) {
        Write-Step "Bu commit zaten çalışıyor; sağlık doğrulanıyor."
        if (-not (Wait-Healthy $sha)) { throw "Çalışan sürüm sağlıksız: $sha" }
        Write-Step '==== değişiklik yok'
        return
    }

    # -------------------------------------------------------------- derleme (çalışan sürüme dokunmaz)
    # İşaret sürüm klasörünün DIŞINDA: içeride olsa git worktree'yi "dirty" sayar (/api/health dirty:true).
    $builtMarker = Join-Path $RelDir "$sha.built"
    if ((Test-Path $release) -and -not (Test-Path $builtMarker)) {
        Write-Step 'yarım kalmış önceki derleme temizleniyor'
        if ($previous -and ((Split-Path $previous -Leaf) -eq $sha)) { throw "Çalışan sürüm silinemez: $sha" }
        Remove-Release $release
        Invoke-Cmd 'git worktree prune' -WorkDir $RepoDir
    }
    if (-not (Test-Path $release)) {
        Invoke-Cmd "git worktree add --detach `"$release`" $sha" -WorkDir $RepoDir -Label 'git worktree add'
        Copy-Item -Path $backendEnvPath -Destination (Join-Path $release 'packages\backend\.env')

        Write-Step 'bağımlılıklar (pnpm install --frozen-lockfile)'
        Invoke-Cmd 'pnpm install --frozen-lockfile' -WorkDir $release -Label 'pnpm install'
        Invoke-Cmd 'npx prisma generate' -WorkDir (Join-Path $release 'packages\backend') -Label 'prisma generate'

        Write-Step 'derleme: shared, backend, frontend'
        Invoke-Cmd 'pnpm run build' -WorkDir (Join-Path $release 'packages\shared') -Label 'shared build'
        Invoke-Cmd 'pnpm run build' -WorkDir (Join-Path $release 'packages\backend') -Label 'backend build'
        $feEnv = Read-EnvFile $frontendEnvPath
        foreach ($k in $feEnv.Keys) { Set-Item -Path "env:$k" -Value $feEnv[$k] }
        $env:NEXT_TELEMETRY_DISABLED = '1'
        Invoke-Cmd 'pnpm run build' -WorkDir (Join-Path $release 'packages\frontend') -Label 'frontend build'

        Set-Content -Path $builtMarker -Value (Get-Date -Format o) -Encoding UTF8
    } else {
        Write-Step 'sürüm daha önce derlenmiş, yeniden kullanılıyor'
        Copy-Item -Path $backendEnvPath -Destination (Join-Path $release 'packages\backend\.env') -Force
    }

    # -------------------------------------------------------------- veritabanı
    $backendDir = Join-Path $release 'packages\backend'
    $pre = Get-CmdOutput "node prisma\scripts\with-migration-url.js node `"$(Join-Path $PSScriptRoot 'preflight-catchup.js')`"" -WorkDir $backendDir
    if ($pre.Code -eq 3) { throw $pre.Output.Trim() }
    if ($pre.Code -ne 0) { throw "preflight başarısız; ayrıntı: $Log" }
    $status = Get-CmdOutput 'node prisma\scripts\with-migration-url.js npx prisma migrate status' -WorkDir $backendDir
    if ($status.Output -cmatch 'Database schema is up to date') {
        Write-Step 'bekleyen migration yok'
    } elseif ($status.Output -cmatch 'not yet been applied') {
        $dump = Join-Path $Backups ("{0}-{1}.dump" -f (Get-Date -Format 'yyyyMMdd-HHmmss'), $sha.Substring(0, 7))
        Write-Step "bekleyen migration var; yedek: $dump"
        # Bağlantı adresi (parolalı) komut satırına ve log'a yazılmasın: cmd çalışırken %...% açılır.
        $env:KROPTOS_PGURL = $backendEnv['DATABASE_MIGRATION_URL']
        try {
            Invoke-Cmd "`"$($Cfg.PgDump)`" -Fc -f `"$dump`" `"%KROPTOS_PGURL%`"" -Label 'pg_dump'
        } finally {
            Remove-Item -Path env:KROPTOS_PGURL -ErrorAction SilentlyContinue
        }
        if (-not (Test-Path $dump) -or (Get-Item $dump).Length -eq 0) { throw "Yedek dosyası boş: $dump" }
        Write-Step 'migrate deploy'
        Invoke-Cmd 'node prisma\scripts\with-migration-url.js npx prisma migrate deploy' -WorkDir $backendDir -Label 'prisma migrate deploy'
    } else {
        throw "migrate status beklenmeyen çıktı verdi (failed migration olabilir); ayrıntı: $Log"
    }
    Invoke-Cmd 'node prisma\scripts\with-migration-url.js node prisma\scripts\check-rls.js' -WorkDir $backendDir -Label 'RLS kontrolü'

    # -------------------------------------------------------------- geçiş
    Write-Step "geçiş: $(if ($previous) { Split-Path $previous -Leaf } else { '(ilk deploy)' }) -> $sha"
    Set-CurrentTarget $release
    try {
        Invoke-Pm2Reload
        $healthy = Wait-Healthy $sha
    } catch {
        Write-Step "pm2 hatası: $($_.Exception.Message)"
        $healthy = $false
    }

    if (-not $healthy) {
        if (-not $previous) { throw "Yeni sürüm sağlıksız ve dönülecek önceki sürüm yok: $sha" }
        Write-Step "GERİ DÖNÜŞ: $(Split-Path $previous -Leaf)"
        Set-CurrentTarget $previous
        Invoke-Pm2Reload
        if (Wait-Healthy (Split-Path $previous -Leaf)) {
            throw "Yeni sürüm sağlıksızdı; önceki sürüme dönüldü ve o sağlıklı. Migration'lar geri alınmadı."
        }
        $exitCode = 2
        throw 'KRİTİK: yeni sürüm sağlıksız ve geri dönülen sürüm de sağlıksız. Elle müdahale gerekiyor.'
    }
    Write-Step "sağlıklı: $sha"

    # -------------------------------------------------------------- eski sürümler
    $keep = @($sha)
    if ($previous) { $keep += (Split-Path $previous -Leaf) }
    $old = Get-ChildItem -Path $RelDir -Directory | Where-Object { Test-ReleaseName $_.Name } |
        Sort-Object LastWriteTime -Descending | Select-Object -Skip $Cfg.KeepReleases |
        Where-Object { $keep -notcontains $_.Name }
    foreach ($o in $old) {
        Write-Step "eski sürüm siliniyor: $($o.Name)"
        Remove-Release $o.FullName
        Remove-Item -Path (Join-Path $RelDir "$($o.Name).built") -Force -ErrorAction SilentlyContinue
    }
    if ($old) { Invoke-Cmd 'git worktree prune' -WorkDir $RepoDir }

    Write-Step "==== deploy tamam: $sha"
} catch {
    if ($exitCode -eq 0) { $exitCode = 1 }
    Write-Step "==== deploy BAŞARISIZ: $($_.Exception.Message)"
} finally {
    Remove-Item -Path $LockFile -Force -ErrorAction SilentlyContinue
}
exit $exitCode
