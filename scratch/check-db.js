const prismaClientPath = 'c:/Users/Administrator/Desktop/kroptos/packages/backend/node_modules/@prisma/client';
const { PrismaClient } = require(prismaClientPath);
const prisma = new PrismaClient();

// Load decrypter helper from the project to securely check keys
const { MarketplaceCredentialService } = require('../packages/backend/dist/integrations/marketplaces/core/MarketplaceCredentialService');
const { ConfigService } = require('@nestjs/config');

async function main() {
  console.log('--- INTEGRATIONS ---');
  const integrations = await prisma.integration.findMany({
    where: { deletedAt: null }
  });

  const configService = new ConfigService();
  // Ensure we set the encryption key environment variable if needed
  process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-kms-encryption-key-32-chars!!';
  const credentialService = new MarketplaceCredentialService(configService);

  for (const integration of integrations) {
    console.log(`\nID: ${integration.id}`);
    console.log(`Public ID: ${integration.publicId}`);
    console.log(`Provider: ${integration.provider}`);
    console.log(`Provider Type: ${integration.providerType}`);
    console.log(`Status: ${integration.status}`);
    console.log(`Created At: ${integration.createdAt}`);

    try {
      if (integration.credentialsEncrypted) {
        const decrypted = credentialService.decrypt(integration.credentialsEncrypted);
        console.log('Credentials Keys:', Object.keys(decrypted));
        // Safe printing: Mask sensitive secrets, print only public identifiers
        const safeCreds = { ...decrypted };
        if (safeCreds.apiKey) safeCreds.apiKey = safeCreds.apiKey.substring(0, 4) + '...';
        if (safeCreds.apiSecret) safeCreds.apiSecret = safeCreds.apiSecret.substring(0, 4) + '...';
        console.log('Decrypted Credentials (masked):', safeCreds);
      } else {
        console.log('No encrypted credentials found.');
      }
    } catch (e) {
      console.log('Error decrypting credentials:', e.message);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
