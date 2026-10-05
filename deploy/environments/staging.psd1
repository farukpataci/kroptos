# Staging (stg.alqora.app). Ayrı Postgres örneği ve Redis 6380 kullanır (bkz. yol haritası Faz 2).
@{
    Name             = 'staging'
    Root             = 'C:\kroptos\staging'
    RepoUrl          = 'https://github.com/farukpataci/kroptos.git'
    Branch           = 'staging'
    AppPrefix        = 'kroptos-stg'
    BackendPort      = 3101
    FrontendPort     = 3100
    KeepReleases     = 3
    HealthTimeoutSec = 120
    PgDump           = 'C:\Program Files\PostgreSQL\16\bin\pg_dump.exe'
    ExpectedAppEnv   = 'staging'
}
