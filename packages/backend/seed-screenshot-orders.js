const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding mock orders from screenshot...');

  // 1. Get active store, agency, client
  const store = await prisma.store.findFirst({
    where: { isActive: true, deletedAt: null }
  });

  if (!store) {
    console.error('No active store found to seed orders.');
    return;
  }

  const { id: storeId, agencyId, clientId } = store;
  console.log(`Using Store: ${store.name} (ID: ${storeId})`);

  // 2. Delete existing orders to ensure clean screenshot representation
  console.log('Deleting existing order items and orders...');
  await prisma.orderItem.deleteMany({});
  await prisma.orderTimeline.deleteMany({});
  await prisma.order.deleteMany({});

  // 3. Define products
  const productsData = [
    { name: 'Colgate Max White Charcoal Black Whitening Toothbrush Soft 2 pcs', sku: 'COLGATE-WHITE', price: 8.02, basePrice: 8.02 },
    { name: 'Professional Laundry Detergent 5L Elixir, UNN57-80985', sku: 'UNN57-80985', price: 35.98, basePrice: 35.98 },
    { name: 'Altınbaş Tea 200 gr, 82335', sku: '82335', price: 36.90, basePrice: 36.90 },
    { name: 'Specialty Walnut Vinegar 500 ML * 3 pieces 8690792030860', sku: '8690792030860', price: 126.00, basePrice: 126.00 },
    { name: 'Traditional Turkish Delight - Vegan, Made in Turkiye, 250g - Rose, RTTTD82R2', sku: 'RTTTD82R2', price: 8.71, basePrice: 8.71 },
    { name: 'Toothbrush 360 Deep Clean 1 pcs x 3 pieces, 53462749', sku: '53462749', price: 8.25, basePrice: 8.25 },
    { name: 'Universal Laundry Detergent 5L - Ocean Breeze -', sku: '001', price: 17.29, basePrice: 17.29 },
    { name: 'Men Legend Shower Gel 250 ml x3 PCS, MODEL 5060648120190', sku: '5060648120190', price: 17.25, basePrice: 17.25 },
    { name: 'x3 Turkish Coffee 100g - Finely ground coffee, authentic flavor, 86906271212063', sku: '86906271212063', price: 26.59, basePrice: 26.59 },
    { name: 'Top Bottom Set 3 X Multi-surface disinfectant wipes, Hygienium, 100 pieces, 5949057517533', sku: '5949057517533', price: 45.70, basePrice: 45.70 },
    { name: 'Intensive restructuring and aging cream 45 H3 Evolution, Face cream, 50 ml, 5943000075027', sku: '5943000075027', price: 49.30, basePrice: 49.30 },
    { name: 'Tahini Flavored Pismaniye (sesame paste) 240g - Premium Turkish Cotton Candy 8697425041361', sku: '8697425041361', price: 10.66, basePrice: 10.66 },
  ];

  console.log('Seeding products...');
  const productsMap = {};
  for (const p of productsData) {
    const createdProduct = await prisma.product.upsert({
      where: { id: p.sku }, // We can use sku as dummy ID or upsert by sku if we had unique index. Oh wait, ID is @id and sku is not unique index in schema. Prisma lets us search by ID.
      // Wait, let's search by SKU first.
      create: {
        agencyId,
        clientId,
        storeId,
        sku: p.sku,
        name: p.name,
        price: p.price,
        basePrice: p.basePrice,
        currency: 'USD',
        stockQuantity: 100,
        status: 'active',
      },
      update: {
        price: p.price,
        basePrice: p.basePrice,
      },
      // Since ID is CUID, we just create it. But to prevent duplicates, we can check if it exists by SKU.
    });
    
    // Check if product exists by SKU
    let existing = await prisma.product.findFirst({ where: { sku: p.sku, storeId } });
    if (!existing) {
      existing = await prisma.product.create({
        data: {
          agencyId,
          clientId,
          storeId,
          sku: p.sku,
          name: p.name,
          price: p.price,
          basePrice: p.basePrice,
          currency: 'USD',
          stockQuantity: 100,
          status: 'active',
        }
      });
    }
    productsMap[p.sku] = existing;
  }

  // 4. Seeding orders
  const ordersList = [
    {
      orderNumber: '65530680',
      customerName: 'Balan Maria Camelia',
      customerEmail: 'balan.maria@gmail.com',
      totalAmount: 24.06,
      currency: 'RON',
      status: 'processing',
      paymentStatus: 'paid',
      fulfillmentStatus: 'unfulfilled',
      source: 'trendyol',
      createdAt: new Date('2026-07-20T13:17:00'),
      items: [{ sku: 'COLGATE-WHITE', qty: 3, price: 8.02 }]
    },
    {
      orderNumber: '65447616',
      customerName: 'Zamfir Stoytskova',
      customerEmail: 'zamfir.stoy@gmail.com',
      totalAmount: 35.98,
      currency: 'EUR',
      status: 'processing',
      paymentStatus: 'paid',
      fulfillmentStatus: 'unfulfilled',
      source: 'trendyol',
      createdAt: new Date('2026-07-19T21:51:00'),
      items: [{ sku: 'UNN57-80985', qty: 1, price: 35.98 }]
    },
    {
      orderNumber: '65366396',
      customerName: 'Camelia Tepes',
      customerEmail: 'camelia.tepes@gmail.com',
      totalAmount: 36.90,
      currency: 'RON',
      status: 'shipped',
      paymentStatus: 'paid',
      fulfillmentStatus: 'unfulfilled',
      source: 'trendyol',
      createdAt: new Date('2026-07-19T10:39:00'),
      items: [{ sku: '82335', qty: 1, price: 36.90 }]
    },
    {
      orderNumber: '65340603',
      customerName: 'Azzam Afaneh',
      customerEmail: 'azzam.afaneh@gmail.com',
      totalAmount: 126.00,
      currency: 'RON',
      status: 'pending',
      paymentStatus: 'paid',
      fulfillmentStatus: 'unfulfilled',
      source: 'trendyol',
      createdAt: new Date('2026-07-18T22:12:00'),
      items: [{ sku: '8690792030860', qty: 1, price: 126.00 }]
    },
    {
      orderNumber: '65337415',
      customerName: 'Rafaela Syryou',
      customerEmail: 'rafaela.syryou@gmail.com',
      totalAmount: 8.71,
      currency: 'EUR',
      status: 'shipped',
      paymentStatus: 'paid',
      fulfillmentStatus: 'unfulfilled',
      source: 'trendyol',
      createdAt: new Date('2026-07-18T21:33:00'),
      items: [{ sku: 'RTTTD82R2', qty: 1, price: 8.71 }]
    },
    {
      orderNumber: '65250582',
      customerName: 'ATHANASIOS RIGAS',
      customerEmail: 'ath.rigas@gmail.com',
      totalAmount: 8.25,
      currency: 'EUR',
      status: 'shipped',
      paymentStatus: 'paid',
      fulfillmentStatus: 'unfulfilled',
      source: 'trendyol',
      createdAt: new Date('2026-07-17T22:18:00'),
      items: [{ sku: '53462749', qty: 1, price: 8.25 }]
    },
    {
      orderNumber: '65159096',
      customerName: 'Kalina Dimova',
      customerEmail: 'kalina.dimova@gmail.com',
      totalAmount: 17.29,
      currency: 'EUR',
      status: 'shipped',
      paymentStatus: 'paid',
      fulfillmentStatus: 'unfulfilled',
      source: 'trendyol',
      createdAt: new Date('2026-07-17T08:52:00'),
      items: [{ sku: '001', qty: 1, price: 17.29 }]
    },
    {
      orderNumber: '65139950',
      customerName: 'Saramet Raluca',
      customerEmail: 'saramet.raluca@gmail.com',
      totalAmount: 24.06,
      currency: 'RON',
      status: 'shipped',
      paymentStatus: 'paid',
      fulfillmentStatus: 'unfulfilled',
      source: 'trendyol',
      createdAt: new Date('2026-07-16T23:53:00'),
      items: [{ sku: 'COLGATE-WHITE', qty: 3, price: 8.02 }]
    },
    {
      orderNumber: '65127048',
      customerName: 'Alexandru Taracila',
      customerEmail: 'alex.taracila@gmail.com',
      totalAmount: 36.90,
      currency: 'RON',
      status: 'delivered',
      paymentStatus: 'paid',
      fulfillmentStatus: 'fulfilled',
      source: 'trendyol',
      createdAt: new Date('2026-07-16T22:00:00'),
      items: [{ sku: '82335', qty: 1, price: 36.90 }]
    },
    {
      orderNumber: '65105759',
      customerName: 'dirica georgian',
      customerEmail: 'dirica.geo@gmail.com',
      totalAmount: 34.50,
      currency: 'RON',
      status: 'shipped',
      paymentStatus: 'paid',
      fulfillmentStatus: 'unfulfilled',
      source: 'trendyol',
      createdAt: new Date('2026-07-16T18:40:00'),
      items: [{ sku: '5060648120190', qty: 2, price: 17.25 }]
    },
    {
      orderNumber: '65084747',
      customerName: 'Foli Sarieva',
      customerEmail: 'foli.sarieva@gmail.com',
      totalAmount: 26.59,
      currency: 'EUR',
      status: 'shipped',
      paymentStatus: 'paid',
      fulfillmentStatus: 'unfulfilled',
      source: 'trendyol',
      createdAt: new Date('2026-07-16T15:49:00'),
      items: [{ sku: '86906271212063', qty: 1, price: 26.59 }]
    },
    {
      orderNumber: '65081483',
      customerName: 'Marian Vasile',
      customerEmail: 'marian.vasile@gmail.com',
      totalAmount: 45.70,
      currency: 'RON',
      status: 'shipped',
      paymentStatus: 'paid',
      fulfillmentStatus: 'unfulfilled',
      source: 'trendyol',
      createdAt: new Date('2026-07-16T15:22:00'),
      items: [{ sku: '5949057517533', qty: 1, price: 45.70 }]
    },
    {
      orderNumber: '65080345',
      customerName: 'Mariana Stoica',
      customerEmail: 'mariana.stoica@gmail.com',
      totalAmount: 49.30,
      currency: 'RON',
      status: 'shipped',
      paymentStatus: 'paid',
      fulfillmentStatus: 'unfulfilled',
      source: 'trendyol',
      createdAt: new Date('2026-07-16T15:16:00'),
      items: [{ sku: '5943000075027', qty: 1, price: 49.30 }]
    },
    {
      orderNumber: '65036818',
      customerName: 'Hajar Zarzour',
      customerEmail: 'hajar.zarzour@gmail.com',
      totalAmount: 10.66,
      currency: 'EUR',
      status: 'shipped',
      paymentStatus: 'paid',
      fulfillmentStatus: 'unfulfilled',
      source: 'trendyol',
      createdAt: new Date('2026-07-16T10:36:00'),
      items: [{ sku: '8697425041361', qty: 1, price: 10.66 }]
    }
  ];

  console.log('Seeding orders...');
  for (const o of ordersList) {
    const createdOrder = await prisma.order.create({
      data: {
        agencyId,
        clientId,
        storeId,
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        customerEmail: o.customerEmail,
        totalAmount: o.totalAmount,
        currency: o.currency,
        status: o.status,
        paymentStatus: o.paymentStatus,
        fulfillmentStatus: o.fulfillmentStatus,
        source: o.source,
        createdBy: 'system',
        createdAt: o.createdAt,
        publicId: 'pub-' + o.orderNumber,
      }
    });

    for (const item of o.items) {
      const prod = productsMap[item.sku];
      await prisma.orderItem.create({
        data: {
          orderId: createdOrder.id,
          productId: prod.id,
          sku: item.sku,
          name: prod.name,
          quantity: item.qty,
          unitPrice: item.price,
          totalPrice: item.price * item.qty,
        }
      });
    }

    // Add a timeline entry for order creation
    await prisma.orderTimeline.create({
      data: {
        orderId: createdOrder.id,
        eventType: 'order_created',
        newValue: 'Sipariş oluşturuldu.',
        createdAt: o.createdAt,
      }
    });
  }

  console.log('Successfully seeded screenshot orders!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
