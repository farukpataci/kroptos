import {
  Controller,
  Post,
  Param,
  Headers,
  Req,
  HttpCode,
  UnauthorizedException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { PrismaService } from '@common/prisma/prisma.service';
import { runAsSystem, runWithTenant } from '@common/prisma/tenant-context';
import { MarketplaceCredentialService } from '../../../integrations/marketplaces/core/MarketplaceCredentialService';
import { WooCommerceWebhook } from '../../../integrations/marketplaces/woocommerce/WooCommerceWebhook';
import { IntegrationQueueService } from '../integration-queue.service';

@ApiTags('Integrations / WooCommerce')
@Controller('/api/integrations/woocommerce')
export class WooCommerceWebhookController {
  private readonly logger = new Logger(WooCommerceWebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly credentialService: MarketplaceCredentialService,
    private readonly queueService: IntegrationQueueService,
  ) {}

  @Post('webhook/:integrationId')
  @HttpCode(200)
  @ApiOperation({ summary: 'WooCommerce Webhook Receiver (HMAC-SHA256 verified)' })
  async handleWebhook(
    @Param('integrationId') integrationId: string,
    @Headers('x-wc-webhook-signature') signature: string,
    @Headers('x-wc-webhook-topic') topic: string,
    @Headers('x-wc-webhook-delivery-id') deliveryId: string,
    @Req() req: Request,
  ) {
    // 1. Find integration record. Public uc: istek baglami yok, kiraci yalniz integrationId'den
    // cozulur -> tek sorgu ACIK sistem baglaminda; kalan her sey (kuyruk yazimi) o kiracida.
    const integration = await runAsSystem('webhook:woocommerce resolve-integration', () =>
      this.prisma.integration.findFirst({
        where: { id: integrationId, provider: 'woocommerce', deletedAt: null },
      }),
    );

    if (!integration) {
      throw new NotFoundException(`WooCommerce integration '${integrationId}' not found.`);
    }

    // 2. Extract raw body buffer
    const rawBody: Buffer = (req as any).rawBody || Buffer.from(JSON.stringify(req.body || {}));

    // 3. Decrypt credentials to obtain webhook secret
    const credentials = this.credentialService.decrypt(integration.credentialsEncrypted);
    // WooCommerce webhook'u kendi "Secret" alanıyla imzalar; API ile yaratılan webhook'ta bu
    // varsayılan olarak API kullanıcısının consumerSecret'ıdır. P14-3: secret ZORUNLU — eski
    // `if (secret)` deseni secret yoksa imzasız isteği kabul ediyordu (kontrol fiilen opsiyoneldi).
    const secret = credentials.webhookSecret || credentials.consumerSecret;
    if (!secret) {
      this.logger.warn(`WooCommerce webhook refused: integration ${integrationId} has no webhookSecret/consumerSecret`);
      throw new UnauthorizedException('Webhook secret is not configured for this integration.');
    }
    // verifySignature: HMAC-SHA256 base64, crypto.timingSafeEqual (uzunluk farkı → false)
    if (!WooCommerceWebhook.verifySignature(rawBody, signature, secret)) {
      this.logger.warn(
        `Invalid webhook signature for WooCommerce integration ${integrationId} (topic: ${topic})`,
      );
      throw new UnauthorizedException('Geçersiz WooCommerce webhook imzası.');
    }

    // 4. Deduplicate deliveries
    if (deliveryId && WooCommerceWebhook.isDuplicateDelivery(deliveryId)) {
      this.logger.log(`Duplicate webhook delivery '${deliveryId}' ignored.`);
      return { received: true, duplicate: true };
    }

    // 5. Queue sync according to event topic
    const payload = req.body;
    this.logger.log(`Received WooCommerce webhook topic: '${topic}' for integration: ${integrationId}`);

    await runWithTenant(integration.agencyId, async () => {
      if (topic?.startsWith('order.')) {
        await this.queueService.addSyncJob(integration.id, 'sync_orders', {
          source: 'webhook',
          topic,
          orderId: payload?.id,
        });
      } else if (topic?.startsWith('product.')) {
        await this.queueService.addSyncJob(integration.id, 'sync_products', {
          source: 'webhook',
          topic,
          productId: payload?.id,
        });
      }
    });

    // Always answer 200 immediately
    return { received: true };
  }
}
