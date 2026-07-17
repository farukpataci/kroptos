import { PrismaClient } from '@prisma/client';
import { generatePublicId } from './common/utils/id-generator';

const prisma = new PrismaClient();

async function main() {
  console.log('Populating missing publicId values for all tables...');

  // 1. Agency (Tenant) -> Prefix: tn_
  const agencies = await prisma.agency.findMany({ where: { publicId: null } });
  console.log(`Found ${agencies.length} agencies to update...`);
  for (const agency of agencies) {
    await prisma.agency.update({
      where: { id: agency.id },
      data: { publicId: generatePublicId('tn', 12) },
    });
  }

  // 2. Store -> Prefix: st_
  const stores = await prisma.store.findMany({ where: { publicId: null } });
  console.log(`Found ${stores.length} stores to update...`);
  for (const store of stores) {
    await prisma.store.update({
      where: { id: store.id },
      data: { publicId: generatePublicId('st', 12) },
    });
  }

  // 3. Order -> Prefix: ord_
  const orders = await prisma.order.findMany({ where: { publicId: null } });
  console.log(`Found ${orders.length} orders to update...`);
  for (const order of orders) {
    await prisma.order.update({
      where: { id: order.id },
      data: { publicId: generatePublicId('ord', 12) },
    });
  }

  // 4. Product -> Prefix: prd_
  const products = await prisma.product.findMany({ where: { publicId: null } });
  console.log(`Found ${products.length} products to update...`);
  for (const product of products) {
    await prisma.product.update({
      where: { id: product.id },
      data: { publicId: generatePublicId('prd', 12) },
    });
  }

  // 5. Integration -> Prefix: int_
  const integrations = await prisma.integration.findMany({ where: { publicId: null } });
  console.log(`Found ${integrations.length} integrations to update...`);
  for (const integration of integrations) {
    await prisma.integration.update({
      where: { id: integration.id },
      data: { publicId: generatePublicId('int', 12) },
    });
  }

  // 6. Warehouse -> Prefix: wh_
  const warehouses = await prisma.warehouse.findMany({ where: { publicId: null } });
  console.log(`Found ${warehouses.length} warehouses to update...`);
  for (const warehouse of warehouses) {
    await prisma.warehouse.update({
      where: { id: warehouse.id },
      data: { publicId: generatePublicId('wh', 12) },
    });
  }

  // 7. WmsShippingLabel -> Prefix: lbl_
  const labels = await prisma.wmsShippingLabel.findMany({ where: { publicId: null } });
  console.log(`Found ${labels.length} shipping labels to update...`);
  for (const label of labels) {
    await prisma.wmsShippingLabel.update({
      where: { id: label.id },
      data: { publicId: generatePublicId('lbl', 12) },
    });
  }

  console.log('Public ID population complete!');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
