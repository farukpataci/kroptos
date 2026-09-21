const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, 'order-settings-init.sql'), 'utf8');
  // Split statements by semicolon
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const stmt of statements) {
    console.log('Executing:', stmt.slice(0, 50) + '...');
    await prisma.$executeRawUnsafe(stmt);
  }
  console.log('RLS and permissions successfully applied for Order Settings!');
}

main()
  .catch(err => {
    console.error('Failed to apply SQL:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
