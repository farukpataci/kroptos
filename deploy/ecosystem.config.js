// pm2 süreçleri — deploy/deploy.ps1 tarafından ortam değişkenleriyle çağrılır.
// Süreçler her zaman <KROPTOS_ROOT>\current altında çalışır; `current` deploy'da yeni sürüme
// çevrilen bir junction'dır. pm2 reload aynı yolu yeniden açar, böylece yeni sürüm yüklenir.
//
//   KROPTOS_ROOT            ör. C:\kroptos\production
//   KROPTOS_APP_PREFIX      pm2 adlarının öneki (production: kroptos, staging: kroptos-stg)
//   KROPTOS_BACKEND_PORT    ör. 3001
//   KROPTOS_FRONTEND_PORT   ör. 3000
//
// Redis/Caddy bu dosyada değil: onlar sürüm başına değişmez, kök ecosystem.config.js'te kalır.
const path = require('path');

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} tanımlı değil (deploy/deploy.ps1 üzerinden çalıştırın)`);
  return value;
}

const root = required('KROPTOS_ROOT');
const prefix = required('KROPTOS_APP_PREFIX');
const current = path.join(root, 'current');

module.exports = {
  apps: [
    {
      name: `${prefix}-backend`,
      // cwd zorunlu: backend `.env`'i process.cwd()'ye göre okur (app.module.ts envFilePath).
      cwd: path.join(current, 'packages', 'backend'),
      script: './dist/main.js',
      node_args: '--enable-source-maps',
      env: {
        NODE_ENV: 'production',
        API_PORT: required('KROPTOS_BACKEND_PORT'),
      },
      kill_timeout: 10000,
    },
    {
      name: `${prefix}-frontend`,
      cwd: path.join(current, 'packages', 'frontend'),
      script: './node_modules/next/dist/bin/next',
      args: `start -p ${required('KROPTOS_FRONTEND_PORT')}`,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
