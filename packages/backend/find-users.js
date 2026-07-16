const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'faruk.pataci@gmail.com' }
  });

  if (!user) {
    console.log('User faruk.pataci@gmail.com not found.');
    return;
  }

  const isMatch = await bcrypt.compare('12341234', user.passwordHash);
  console.log('Does password \"12341234\" match current hash?', isMatch);

  if (!isMatch) {
    console.log('Generating new hash for \"12341234\"...');
    const newHash = await bcrypt.hash('12341234', 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash }
    });
    console.log('Password hash updated successfully!');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
