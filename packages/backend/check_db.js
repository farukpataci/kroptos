const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const agencyId = 'cmqs8k85b000213co7nxm3na8';
  const clientId = 'cmqtebn02000hkkw3tu36mtqb'; // Test Client Corp 2

  console.log('Checking active stores...');
  let activeStore = await prisma.store.findFirst({
    where: { agencyId, clientId, deletedAt: null },
  });

  if (!activeStore) {
    console.log('No active store found. Creating one...');
    activeStore = await prisma.store.create({
      data: {
        agencyId,
        clientId,
        name: 'Main Store',
        slug: 'main-store',
        domain: 'mainstore.com',
        status: 'active',
        isActive: true,
      },
    });
    console.log('Created Store:', activeStore.id);
  } else {
    console.log('Active Store already exists:', activeStore.id);
  }

  console.log('--- INTEGRATION QUEUE ---');
  const queue = await prisma.integrationQueue.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  console.log(queue.map(q => ({
    id: q.id,
    eventType: q.eventType,
    status: q.status,
    error: q.error,
    createdAt: q.createdAt,
    processedAt: q.processedAt,
  })));

  console.log('\n--- API LOGS ---');
  const logs = await prisma.apiLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  console.log(logs.map(l => ({
    id: l.id,
    endpoint: l.endpoint,
    statusCode: l.statusCode,
    durationMs: l.durationMs,
    errorMessage: l.errorMessage,
  })));

  console.log('\n--- PRODUCTS COUNT ---');
  const productCount = await prisma.product.count();
  console.log('Total Products:', productCount);

  console.log('\n--- ORDERS COUNT ---');
  const orderCount = await prisma.order.count();
  console.log('Total Orders:', orderCount);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
