module.exports = {
  apps: [
    {
      name: 'kroptos-backend',
      // `cwd` zorunlu: app.module.ts icinde `envFilePath: '.env'` process.cwd()'ye
      // gore cozuluyor ve repo kokunde .env yok. cwd verilmezse pm2 kok dizinden
      // baslatir, backend DATABASE_URL / ENCRYPTION_KEY olmadan ayaga kalkar.
      script: './dist/main.js',
      cwd: './packages/backend',
      node_args: '--enable-source-maps',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'kroptos-frontend',
      script: './node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      cwd: './packages/frontend',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
