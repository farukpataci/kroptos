const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');
const { IntegrationService } = require('./dist/modules/integration/integration.service');

async function run() {
  console.log('Bootstrapping NestJS context...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const integrationService = app.get(IntegrationService);
  
  const integrationId = 'cmqz6xonh0008m0y33bb150m9';
  const agencyId = 'cmqs8k85b000213co7nxm3na8';

  console.log(`Triggering sync direct for integration ${integrationId}...`);
  const result = await integrationService.triggerSync(integrationId, agencyId);
  console.log('Trigger Sync Result:', result);

  await app.close();
}

run().catch(console.error);
