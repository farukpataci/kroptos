import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Req,
  HttpCode,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { PrismaService } from '@common/prisma/prisma.service';
import { runAsSystem, runWithTenant } from '@common/prisma/tenant-context';
import { IntegrationQueueService } from '../integration-queue.service';
import { EcommerceHttpClient } from '../../../integrations/ecommerce/core';
import { IdeasoftTokenResponse } from '../../../integrations/ecommerce/ideasoft/IdeasoftTypes';

@ApiTags('Integrations / IdeaSoft')
@Controller('/api/integrations/ideasoft')
export class IdeasoftController {
  private readonly logger = new Logger(IdeasoftController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: IntegrationQueueService,
    private readonly httpClient: EcommerceHttpClient,
  ) {}

  /**
   * OAuth 2.0 Authorization Callback URL:
   * https://panel.seninprojen.com/api/integrations/ideasoft/callback
   */
  @Get('callback')
  @ApiOperation({ summary: 'IdeaSoft OAuth2 Callback Endpoint' })
  async handleOAuthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Query('error_description') errorDesc: string,
  ) {
    if (error) {
      this.logger.error(`IdeaSoft OAuth error: ${error} - ${errorDesc}`);
      return `
        <html>
          <body style="font-family:sans-serif; text-align:center; padding:50px;">
            <h2 style="color:#e11d48;">İdeaSoft Yetkilendirme Başarısız Oldu</h2>
            <p>${errorDesc || error}</p>
            <button onclick="window.close()" style="padding:10px 20px; background:#4f46e5; color:#fff; border:none; border-radius:6px; cursor:pointer;">Pencereyi Kapat</button>
          </body>
        </html>
      `;
    }

    if (!code) {
      throw new BadRequestException('Yetkilendirme kodu (code) bulunamadı.');
    }

    this.logger.log(`Received IdeaSoft OAuth code: ${code.slice(0, 8)}... (state: ${state})`);

    return `
      <html>
        <body style="font-family:sans-serif; text-align:center; padding:50px;">
          <h2 style="color:#16a34a;">İdeaSoft Yetkilendirme Başarılı!</h2>
          <p>KroptOS panelinize dönerek kurulumu tamamlayabilirsiniz.</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'IDEASOFT_AUTH_SUCCESS', code: '${code}', state: '${state || ''}' }, '*');
              setTimeout(() => window.close(), 1500);
            }
          </script>
        </body>
      </html>
    `;
  }

  /**
   * Webhook Receiver Endpoint
   */
  @Post('webhook/:integrationId')
  @HttpCode(200)
  @ApiOperation({ summary: 'IdeaSoft Webhook Receiver' })
  async handleWebhook(
    @Param('integrationId') integrationId: string,
    @Req() req: Request,
  ) {
    // Public uc: kiraci yalniz integrationId'den cozulur -> tek sorgu ACIK sistem baglaminda,
    // kuyruk yazimi o kiracida (RLS). NOT: bu uc imza dogrulamasi YAPMIYOR (P13 raporu).
    const integration = await runAsSystem('webhook:ideasoft resolve-integration', () =>
      this.prisma.integration.findFirst({
        where: { id: integrationId, provider: 'ideasoft', deletedAt: null },
      }),
    );

    if (!integration) {
      throw new NotFoundException(`IdeaSoft integration '${integrationId}' not found.`);
    }

    const payload = req.body || {};
    const topic = String(payload?.event || payload?.topic || payload?.type || 'order.update');

    this.logger.log(`Received IdeaSoft webhook event '${topic}' for integration: ${integrationId}`);

    await runWithTenant(integration.agencyId, async () => {
      if (topic.includes('order')) {
        await this.queueService.addSyncJob(integration.id, 'sync_orders', {
          source: 'webhook',
          topic,
          orderId: payload?.id || payload?.orderId,
        });
      } else if (topic.includes('product') || topic.includes('stock')) {
        await this.queueService.addSyncJob(integration.id, 'sync_products', {
          source: 'webhook',
          topic,
          productId: payload?.id || payload?.productId,
        });
      }
    });

    return { received: true };
  }
}
