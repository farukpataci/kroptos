const path = require('path');
// Import Prisma Client from the project's own packages/backend node_modules
const prismaClientPath = 'c:/Users/Administrator/Desktop/kroptos/packages/backend/node_modules/@prisma/client';
const { PrismaClient } = require(prismaClientPath);

const prisma = new PrismaClient();

async function main() {
  const email = 'superadmin@kroptos.com';
  console.log(`Searching for user with email: ${email}`);
  
  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) {
    console.log(`User with email '${email}' was not found in database.`);
    return;
  }

  console.log(`Found user: ID=${user.id}, Email=${user.email}. Deleting relations first...`);

  // Delete UserRoles
  const deletedUserRoles = await prisma.userRole.deleteMany({
    where: { userId: user.id }
  });
  console.log(`Deleted ${deletedUserRoles.count} user role mappings.`);

  // Delete StoreUsers
  const deletedStoreUsers = await prisma.storeUser.deleteMany({
    where: { userId: user.id }
  });
  console.log(`Deleted ${deletedStoreUsers.count} store user mappings.`);

  // Delete AuditLogs
  const deletedAuditLogs = await prisma.auditLog.deleteMany({
    where: { userId: user.id }
  });
  console.log(`Deleted ${deletedAuditLogs.count} audit logs.`);

  // Delete User
  await prisma.user.delete({
    where: { id: user.id }
  });
  console.log(`Successfully deleted user with email: ${email}`);
}

main()
  .catch((e) => {
    console.error('Error during user deletion:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
