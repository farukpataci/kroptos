import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Req,
  Res,
  Headers,
  HttpCode,
  Logger,
  NotFoundException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { timingSafeEqual } from 'crypto';
import { PrismaService } from '@common/prisma/prisma.service';
import { runAsSystem, runWithTenant } from '@common/prisma/tenant-context';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { actorFromRequest } from '../../rbac/rbac.service';
import { encrypt, decrypt } from '../../../common/utils/encryption.util';
import { IntegrationQueueService } from '../integration-queue.service';
import { EcommerceHttpClient } from '../../../integrations/ecommerce/core';
import { IdeasoftTokenResponse } from '../../../integrations/ecommerce/ideasoft/IdeasoftTypes';
import { IdeasoftOauthStateService } from './ideasoft-oauth-state.service';

/**
 * IdeaSoft OAuth2 + webhook (P14).
 *
 * OAuth: state sunucuda üretilir (IdeasoftOauthStateService: kullanıcı + ajans +
 * entegrasyon + 10 dk), callback'te doğrulanıp TÜKETİLİR; code sunucuda token'a
 * çevrilir, kimlik bilgileri şifreli yazılır, tarayıcı FRONTEND_URL'e redirect edilir.
 * HTML'e hiçbir istek parametresi gömülmez, postMessage yok (eski uç code/state'i
 * script'e kaçışsız gömüyordu → yansıtılmış XSS; state doğrulanmıyordu → CSRF).
 *
 * Webhook: IdeaSoft için belgelenmiş bir imza mekanizması BULUNAMADI (apidocs
 * ulaşılamıyor, üçüncü taraf kopya yasak). Uç açık kalamaz: entegrasyonun
 * credentials.webhookSecret'ı ZORUNLU; istek onu `x-webhook-secret` başlığında ya da
 * `?secret=` sorgusunda taşır (IdeaSoft paneli yalnız URL alıyorsa sorgu). Timing-safe
 * karşılaştırma; eşleşmeyen/eksik → 401 ve kuyruğa GİRMEZ.
 */
@ApiTags('Integrations / IdeaSoft')
@Controller('/api/integrations/ideasoft')
export class IdeasoftController {
  private readonly logger = new Logger(IdeasoftController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: IntegrationQueueService,
    private readonly httpClient: EcommerceHttpClient,
    private readonly oauthState: IdeasoftOauthStateService,
  ) {}

  /** Kimlikli: aktif ajanstaki entegrasyon için yetkilendirme URL'si üretir. */
  @Post(':integrationId/oauth/start')
  @HttpCode(200)
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @RequirePermission('integrations.manage')
  @ApiOperation({ summary: 'IdeaSoft OAuth2 başlat: state üret, authorize URL döndür' })
  async startOauth(@Param('integrationId') integrationId: string, @Req() req: Request) {
    const actor = actorFromRequest(req);
    const integration = await this.prisma.integration.findFirst({
      where: { id: integrationId, provider: 'ideasoft', agencyId: actor.agencyId, deletedAt: null },
    });
    if (!integration) throw new NotFoundException(`IdeaSoft integration '${integrationId}' not found.`);

    const credentials = JSON.parse(decrypt(integration.credentialsEncrypted) || '{}');
    const storeUrl = normalizeStoreUrl(credentials.storeDomain || credentials.url);
    if (!credentials.clientId || !storeUrl) {
      throw new NotFoundException('IdeaSoft clientId / mağaza adresi tanımlı değil.');
    }
    const state = this.oauthState.issue({ userId: actor.userId, agencyId: actor.agencyId, integrationId: integration.id });
    const authorizeUrl =
      `${storeUrl}/oauth/v2/auth?` +
      new URLSearchParams({
        client_id: String(credentials.clientId),
        redirect_uri: this.redirectUri(req),
        response_type: 'code',
        state,
      }).toString();
    return { authorizeUrl, expiresInSec: 600 };
  }

  /**
   * Public (TenantMiddleware.publicRoutes). Hiçbir parametre yanıta yansıtılmaz:
   * geçersiz state → 400 sabit metin; sonuç redirect ile sabit değerlerle iletilir.
   */
  @Get('callback')
  @ApiOperation({ summary: 'IdeaSoft OAuth2 Callback Endpoint' })
  async handleOAuthCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const bound = this.oauthState.consume(state);
    if (!bound) {
      // CSRF/tekrar: eşleşme yoksa hiçbir şey yapılmaz, girdi yansıtılmaz.
      this.logger.warn('IdeaSoft callback: invalid, expired or reused state');
      res.status(400).type('text/plain').send('Invalid or expired OAuth state.');
      return;
    }

    const target = await runWithTenant(bound.agencyId, () =>
      this.prisma.integration.findFirst({
        where: { id: bound.integrationId, provider: 'ideasoft', deletedAt: null },
        include: { store: { select: { publicId: true } }, agency: { select: { publicId: true, id: true } } },
      }),
    );
    if (!target) {
      res.status(400).type('text/plain').send('Integration not found.');
      return;
    }
    const tenantPublicId = target.store?.publicId ?? target.agency.publicId ?? target.agency.id;

    if (error || !code) {
      this.logger.warn(`IdeaSoft OAuth denied for integration ${target.id}: ${error ? 'provider_error' : 'missing_code'}`);
      res.redirect(302, this.resultUrl(tenantPublicId, 'error', error ? 'provider_denied' : 'missing_code'));
      return;
    }

    try {
      const credentials = JSON.parse(decrypt(target.credentialsEncrypted) || '{}');
      const storeUrl = normalizeStoreUrl(credentials.storeDomain || credentials.url);
      const token = await this.httpClient.json<IdeasoftTokenResponse>(`${storeUrl}/oauth/v2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: String(credentials.clientId ?? ''),
          client_secret: String(credentials.clientSecret ?? ''),
          redirect_uri: this.redirectUri(req),
        }).toString(),
      });
      if (!token?.access_token) throw new Error('token response without access_token');

      const merged = {
        ...credentials,
        accessToken: token.access_token,
        ...(token.refresh_token ? { refreshToken: token.refresh_token } : {}),
        ...(token.expires_in ? { expiresAt: Date.now() + token.expires_in * 1000 } : {}),
      };
      await runWithTenant(bound.agencyId, () =>
        this.prisma.integration.update({
          where: { id: target.id },
          data: { credentialsEncrypted: encrypt(JSON.stringify(merged)), status: 'active' },
        }),
      );
      this.logger.log(`IdeaSoft OAuth completed for integration ${target.id} by user ${bound.userId}`);
      res.redirect(302, this.resultUrl(tenantPublicId, 'connected'));
    } catch (e: any) {
      this.logger.error(`IdeaSoft token exchange failed for integration ${target.id}: ${e?.message ?? e}`);
      res.redirect(302, this.resultUrl(tenantPublicId, 'error', 'token_exchange_failed'));
    }
  }

  /** Public. Secret zorunlu (bkz. sınıf yorumu). */
  @Post('webhook/:integrationId')
  @HttpCode(200)
  @ApiOperation({ summary: 'IdeaSoft Webhook Receiver (shared secret required)' })
  async handleWebhook(
    @Param('integrationId') integrationId: string,
    @Headers('x-webhook-secret') headerSecret: string | undefined,
    @Query('secret') querySecret: string | undefined,
    @Req() req: Request,
  ) {
    // Public uc: kiraci yalniz integrationId'den cozulur -> tek sorgu ACIK sistem baglaminda,
    // kuyruk yazimi o kiracida (RLS).
    const integration = await runAsSystem('webhook:ideasoft resolve-integration', () =>
      this.prisma.integration.findFirst({
        where: { id: integrationId, provider: 'ideasoft', deletedAt: null },
      }),
    );
    if (!integration) {
      throw new NotFoundException(`IdeaSoft integration '${integrationId}' not found.`);
    }

    const credentials = JSON.parse(decrypt(integration.credentialsEncrypted) || '{}');
    const expected = String(credentials.webhookSecret ?? '');
    const presented = String(headerSecret ?? querySecret ?? '');
    if (!expected) {
      this.logger.warn(`IdeaSoft webhook refused: integration ${integrationId} has no webhookSecret configured`);
      throw new UnauthorizedException('Webhook secret is not configured for this integration.');
    }
    if (!presented || !safeEqual(presented, expected)) {
      this.logger.warn(`IdeaSoft webhook refused: bad secret for integration ${integrationId}`);
      throw new UnauthorizedException('Geçersiz webhook secret.');
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

  private redirectUri(req: Request): string {
    const base = (process.env.API_PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    return `${base}/api/integrations/ideasoft/callback`;
  }

  /** Sonuç sabit sözcüklerle iletilir; istekten gelen hiçbir değer URL'ye girmez. */
  private resultUrl(tenantPublicId: string, status: 'connected' | 'error', reason?: string): string {
    const base = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    const q = new URLSearchParams({ ideasoft: status, ...(reason ? { reason } : {}) });
    return `${base}/t/${encodeURIComponent(tenantPublicId)}/integrations?${q.toString()}`;
  }
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** IdeasoftConnector.getNormalizedStoreUrl ile aynı kural (magazam → https://magazam.myideasoft.com). */
function normalizeStoreUrl(raw: unknown): string | null {
  let domain = String(raw ?? '').trim();
  if (!domain) return null;
  if (domain.startsWith('http://') || domain.startsWith('https://')) {
    try {
      domain = new URL(domain).hostname;
    } catch {
      /* fallback */
    }
  }
  domain = domain.replace(/\/+$/, '');
  if (!domain.includes('.')) domain = `${domain}.myideasoft.com`;
  return `https://${domain}`;
}
