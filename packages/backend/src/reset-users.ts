import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Resetting users...');

  // Target user info
  const targetEmail = 'faruk.pataci@gmail.com';
  const targetPassword = '12341234';
  const hashedPassword = await bcrypt.hash(targetPassword, 12);

  // Find or create the target user
  let targetUser = await prisma.user.findUnique({
    where: { email: targetEmail },
  });

  if (targetUser) {
    // Update password just in case
    targetUser = await prisma.user.update({
      where: { email: targetEmail },
      data: { passwordHash: hashedPassword },
    });
    console.log(`Updated password for existing user: ${targetEmail}`);
  } else {
    targetUser = await prisma.user.create({
      data: {
        email: targetEmail,
        passwordHash: hashedPassword,
        firstName: 'Faruk',
        lastName: 'Pataci',
        isActive: true,
      },
    });
    console.log(`Created new user: ${targetEmail}`);
  }

  // Delete all other users
  const deletedUsers = await prisma.user.deleteMany({
    where: {
      email: {
        not: targetEmail,
      },
    },
  });

  console.log(`Deleted ${deletedUsers.count} other users.`);

  // Make sure the target user has a UserRole associated with the first Agency (if one exists)
  const agency = await prisma.agency.findFirst();
  if (agency) {
    const ownerRole = await prisma.role.findFirst({ where: { name: 'owner' } });
    if (ownerRole) {
      // Upsert UserRole
      const existingUserRole = await prisma.userRole.findFirst({
        where: { userId: targetUser.id, agencyId: agency.id }
      });
      if (!existingUserRole) {
        await prisma.userRole.create({
          data: {
            userId: targetUser.id,
            agencyId: agency.id,
            roleId: ownerRole.id,
          }
        });
        console.log(`Assigned owner role to ${targetEmail} for agency ${agency.name}`);
      }
    }
  }

  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
