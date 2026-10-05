# Canlı ortam (alqora.app). Sır içermez: sırlar <Root>\shared\*.env dosyalarında, repoda değil.
@{
    Name             = 'production'
    Root             = 'C:\kroptos\production'
    RepoUrl          = 'https://github.com/farukpataci/kroptos.git'
    Branch           = 'main'
    AppPrefix        = 'kroptos'          # pm2: kroptos-backend, kroptos-frontend (mevcut adlar korunur)
    BackendPort      = 3001
    FrontendPort     = 3000
    KeepReleases     = 5
    HealthTimeoutSec = 120
    # Migration öncesi yedek. Sunucudaki PostgreSQL kurulumunun pg_dump.exe yolu.
    PgDump           = 'C:\Program Files\PostgreSQL\16\bin\pg_dump.exe'
    # Canlıda staging'e özgü korumalar kapalıdır; yanlışlıkla staging .env'i kopyalanırsa deploy durur.
    ExpectedAppEnv   = 'production'
}
