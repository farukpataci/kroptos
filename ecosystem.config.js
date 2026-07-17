module.exports = {
  apps: [
    {
      name: 'kroptos-backend',
      script: './packages/backend/dist/main.js',
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
