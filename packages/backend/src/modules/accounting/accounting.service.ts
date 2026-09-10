import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '@common/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { generatePublicId } from '../../common/utils/id-generator';
import { AuditLogService } from '../audit/audit.service';
import { AccountingConnectorFactory } from '../../integrations/accounting/core/AccountingConnectorFactory';
import { AccountingCredentialService } from '../../integrations/accounting/core/AccountingCredentialService';
import { AccountingEnvironment, AccountingReadiness } from '../../integrations/accounting/core/AccountingTypes';
import {
  CreateAccountingCompanyDto,
  CreateAccountingIntegrationDto,
  UpdateAccountingCompanyDto,
  UpdateAccountingIntegrationDto,
} from './dto/accounting.dto';

export interface AccountingScope {
  agencyId: string;
  clientId?: string;
  storeId?: string;
}

@Injectable()
export class AccountingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credentialsService: AccountingCredentialService,
    private readonly connectorFactory: AccountingConnectorFactory,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Generates deterministic scopeKey: ${agencyId}:${clientId ?? '-'}:${storeId ?? '-'}
   */
  calculateScopeKey(scope: AccountingScope): string {
    return `${scope.agencyId}:${scope.clientId ?? '-'}:${scope.storeId ?? '-'}`;
  }

  private scopeWhere(scope: AccountingScope): Prisma.AccountingIntegrationWhereInput {
    const where: Prisma.AccountingIntegrationWhereInput = {
      agencyId: scope.agencyId,
      deletedAt: null,
    };

    if (scope.storeId) {
      where.OR = [
        { storeId: scope.storeId },
        { storeId: null, clientId: scope.clientId },
        { storeId: null, clientId: null },
      ];
    } else if (scope.clientId) {
      where.OR = [{ clientId: scope.clientId }, { clientId: null }];
    }

    return where;
  }

  async createIntegration(
    dto: CreateAccountingIntegrationDto,
    userContext?: { id?: string; email?: string; name?: string; ip?: string },
  ) {
    this.credentialsService.validate(dto.provider, dto.credentials);

    const scopeKey = this.calculateScopeKey({
      agencyId: dto.agencyId,
      clientId: dto.clientId,
      storeId: dto.storeId,
    });

    // Check unique provider + scopeKey
    const existing = await this.prisma.accountingIntegration.findUnique({
      where: {
        provider_scopeKey: {
          provider: dto.provider.toUpperCase(),
          scopeKey,
        },
      },
    });

    if (existing && !existing.deletedAt) {
      throw new BadRequestException(
        `Bu mağaza/müşteri kapsamında zaten aktif bir ${dto.provider} muhasebe entegrasyonu mevcuttur.`,
      );
    }

    const encryptedCreds = this.credentialsService.encrypt(dto.credentials);
    const publicId = generatePublicId('acc_int');

    const created = await this.prisma.accountingIntegration.create({
      data: {
        publicId,
        agencyId: dto.agencyId,
        clientId: dto.clientId,
        storeId: dto.storeId,
        provider: dto.provider.toUpperCase(),
        name: dto.name,
        environment: dto.environment || 'MOCK',
        status: 'disconnected',
        readiness: 'MOCK_READY' as AccountingReadiness,
        credentials: encryptedCreds,
        scopeKey,
      },
    });

    // Auto-create default company if companyId provided in credentials
    if (dto.credentials.companyId) {
      await this.prisma.accountingCompany.create({
        data: {
          integrationId: created.id,
          agencyId: dto.agencyId,
          externalCompanyId: String(dto.credentials.companyId),
          name: dto.name,
          currency: 'TRY',
          isDefault: true,
        },
      });
    }

    await this.auditLogService.createLog({
      tenantId: dto.agencyId,
      userId: userContext?.id,
      userEmail: userContext?.email,
      userName: userContext?.name,
      action: 'CREATE_ACCOUNTING_INTEGRATION',
      module: 'accounting',
      entityType: 'AccountingIntegration',
      entityId: created.id,
      entityDisplayName: created.name,
      description: `Muhasebe entegrasyonu oluşturuldu (${created.provider}, ${created.environment})`,
      ipAddress: userContext?.ip,
      severity: 'info',
    });

    return this.toMaskedResponse(created);
  }

  async updateIntegration(
    id: string,
    dto: UpdateAccountingIntegrationDto,
    scope: AccountingScope,
    userContext?: { id?: string; email?: string; name?: string; ip?: string },
  ) {
    const integration = await this.findIntegrationById(id, scope);

    const data: Prisma.AccountingIntegrationUpdateInput = {};
    if (dto.name) data.name = dto.name;
    if (dto.status) data.status = dto.status;
    if (dto.environment) data.environment = dto.environment;

    if (dto.credentials) {
      let currentCreds: Record<string, any> = {};
      if (integration.credentials) {
        try {
          currentCreds = this.credentialsService.decrypt(integration.credentials);
        } catch {
          currentCreds = {};
        }
      }
      const merged = { ...currentCreds, ...dto.credentials };
      this.credentialsService.validate(integration.provider, merged);
      data.credentials = this.credentialsService.encrypt(merged);
    }

    const updated = await this.prisma.accountingIntegration.update({
      where: { id: integration.id },
      data,
    });

    await this.auditLogService.createLog({
      tenantId: scope.agencyId,
      userId: userContext?.id,
      userEmail: userContext?.email,
      userName: userContext?.name,
      action: 'UPDATE_ACCOUNTING_INTEGRATION',
      module: 'accounting',
      entityType: 'AccountingIntegration',
      entityId: updated.id,
      entityDisplayName: updated.name,
      description: `Muhasebe entegrasyonu güncellendi`,
      ipAddress: userContext?.ip,
      severity: 'info',
    });

    return this.toMaskedResponse(updated);
  }

  async deleteIntegration(
    id: string,
    scope: AccountingScope,
    userContext?: { id?: string; email?: string; name?: string; ip?: string },
  ) {
    const integration = await this.findIntegrationById(id, scope);

    await this.prisma.accountingIntegration.update({
      where: { id: integration.id },
      data: { deletedAt: new Date(), status: 'disconnected' },
    });

    await this.auditLogService.createLog({
      tenantId: scope.agencyId,
      userId: userContext?.id,
      userEmail: userContext?.email,
      userName: userContext?.name,
      action: 'DELETE_ACCOUNTING_INTEGRATION',
      module: 'accounting',
      entityType: 'AccountingIntegration',
      entityId: integration.id,
      entityDisplayName: integration.name,
      description: `Muhasebe entegrasyonu silindi`,
      ipAddress: userContext?.ip,
      severity: 'warning',
    });

    return { success: true };
  }

  async findIntegrations(scope: AccountingScope) {
    const integrations = await this.prisma.accountingIntegration.findMany({
      where: this.scopeWhere(scope),
      include: {
        companies: {
          where: { deletedAt: null },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return integrations.map((i) => this.toMaskedResponse(i));
  }

  async findIntegrationById(idOrPublicId: string, scope: AccountingScope) {
    const integration = await this.prisma.accountingIntegration.findFirst({
      where: {
        OR: [{ id: idOrPublicId }, { publicId: idOrPublicId }],
        agencyId: scope.agencyId,
        deletedAt: null,
      },
      include: {
        companies: {
          where: { deletedAt: null },
        },
      },
    });

    if (!integration) {
      throw new NotFoundException('Muhasebe entegrasyonu bulunamadı.');
    }

    return integration;
  }

  async testConnection(id: string, scope: AccountingScope) {
    const integration = await this.findIntegrationById(id, scope);
    const credentials = integration.credentials
      ? this.credentialsService.decrypt(integration.credentials)
      : {};

    const connector = this.connectorFactory.create(
      integration.provider,
      credentials,
      integration.environment as AccountingEnvironment,
    );

    try {
      const result = await connector.testConnection();

      await this.prisma.accountingIntegration.update({
        where: { id: integration.id },
        data: {
          status: result.success ? 'connected' : 'error',
          lastVerifiedAt: new Date(),
          lastErrorMessage: result.success ? null : result.message,
        },
      });

      return result;
    } catch (err: any) {
      await this.prisma.accountingIntegration.update({
        where: { id: integration.id },
        data: {
          status: 'error',
          lastErrorMessage: err.message,
        },
      });
      throw err;
    }
  }

  // --- Company management ---

  async createCompany(dto: CreateAccountingCompanyDto, scope: AccountingScope) {
    const integration = await this.findIntegrationById(dto.integrationId, scope);

    if (dto.isDefault) {
      await this.prisma.accountingCompany.updateMany({
        where: { integrationId: integration.id },
        data: { isDefault: false },
      });
    }

    return this.prisma.accountingCompany.create({
      data: {
        integrationId: integration.id,
        agencyId: scope.agencyId,
        externalCompanyId: dto.externalCompanyId,
        name: dto.name,
        currency: dto.currency || 'TRY',
        isDefault: dto.isDefault ?? false,
        invoiceSeries: dto.invoiceSeries,
        defaultRetailContactId: dto.defaultRetailContactId,
        defaultAccountCodes: dto.defaultAccountCodes,
      },
    });
  }

  async listCompanies(integrationId: string, scope: AccountingScope) {
    const integration = await this.findIntegrationById(integrationId, scope);
    return this.prisma.accountingCompany.findMany({
      where: {
        integrationId: integration.id,
        agencyId: scope.agencyId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateCompany(
    companyId: string,
    dto: UpdateAccountingCompanyDto,
    scope: AccountingScope,
  ) {
    const company = await this.prisma.accountingCompany.findFirst({
      where: { id: companyId, agencyId: scope.agencyId, deletedAt: null },
    });
    if (!company) throw new NotFoundException('Firma bulunamadı.');

    if (dto.isDefault) {
      await this.prisma.accountingCompany.updateMany({
        where: { integrationId: company.integrationId },
        data: { isDefault: false },
      });
    }

    return this.prisma.accountingCompany.update({
      where: { id: companyId },
      data: {
        name: dto.name,
        currency: dto.currency,
        isDefault: dto.isDefault,
        invoiceSeries: dto.invoiceSeries,
        defaultRetailContactId: dto.defaultRetailContactId,
        defaultAccountCodes: dto.defaultAccountCodes,
      },
    });
  }

  async deleteCompany(companyId: string, scope: AccountingScope) {
    const company = await this.prisma.accountingCompany.findFirst({
      where: { id: companyId, agencyId: scope.agencyId, deletedAt: null },
    });
    if (!company) throw new NotFoundException('Firma bulunamadı.');

    await this.prisma.accountingCompany.update({
      where: { id: companyId },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }

  // --- OAuth2 flow (§5) ---
  private readonly oauthNonceStore: Map<
    string,
    {
      nonce: string;
      integrationId: string;
      agencyId: string;
      clientId?: string;
      storeId?: string;
      userId?: string;
      provider: string;
      redirectUri: string;
      expiresAt: number;
    }
  > = new Map();

  async startOAuth(
    id: string,
    scope: AccountingScope,
    redirectUri?: string,
    userContext?: { id?: string },
  ): Promise<{ authorizationUrl: string }> {
    const integration = await this.findIntegrationById(id, scope);
    const credentials = integration.credentials
      ? this.credentialsService.decrypt(integration.credentials)
      : {};

    const effectiveRedirectUri =
      redirectUri ||
      process.env.SAGE_REDIRECT_URI ||
      'http://localhost:3000/api/accounting/oauth/callback';

    // Generate random 32-byte cryptographically secure nonce (§5.2)
    const nonce = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes TTL

    this.oauthNonceStore.set(nonce, {
      nonce,
      integrationId: integration.id,
      agencyId: integration.agencyId,
      clientId: integration.clientId || undefined,
      storeId: integration.storeId || undefined,
      userId: userContext?.id,
      provider: integration.provider,
      redirectUri: effectiveRedirectUri,
      expiresAt,
    });

    const connector = this.connectorFactory.create(
      integration.provider,
      credentials,
      integration.environment as AccountingEnvironment,
    );

    if (typeof connector.buildAuthorizationUrl !== 'function') {
      throw new BadRequestException(
        `${integration.provider} sağlayıcısı OAuth tarayıcı yetkilendirmesini desteklemiyor.`,
      );
    }

    const authorizationUrl = connector.buildAuthorizationUrl({
      state: nonce,
      redirectUri: effectiveRedirectUri,
    });

    return { authorizationUrl };
  }

  async handleOAuthCallback(code: string, state: string) {
    if (!state || !code) {
      return {
        success: false,
        message: 'Yetkilendirme kodu veya durum anahtarı eksik.',
      };
    }

    const nonceRecord = this.oauthNonceStore.get(state);
    // Nonce is strictly single-use (§5.2): delete immediately
    this.oauthNonceStore.delete(state);

    if (!nonceRecord || Date.now() > nonceRecord.expiresAt) {
      // Neutral response to avoid leaking integration existence (§5.2 rule 5)
      return {
        success: false,
        message: 'Yetkilendirme oturumu geçersiz veya süresi dolmuş.',
      };
    }

    // Resolve tenant strictly from nonce record (§5.2 rule 4)
    const integration = await this.prisma.accountingIntegration.findUnique({
      where: { id: nonceRecord.integrationId },
    });

    if (!integration || integration.deletedAt) {
      return {
        success: false,
        message: 'Yetkilendirme oturumu geçersiz veya süresi dolmuş.',
      };
    }

    const credentials = integration.credentials
      ? this.credentialsService.decrypt(integration.credentials)
      : {};

    const connector = this.connectorFactory.create(
      integration.provider,
      credentials,
      integration.environment as AccountingEnvironment,
    );

    if (typeof connector.exchangeAuthorizationCode !== 'function') {
      return {
        success: false,
        message: 'Yetkilendirme kod değişimi bu sağlayıcıda desteklenmiyor.',
      };
    }

    try {
      const tokenResult = await connector.exchangeAuthorizationCode({
        code,
        redirectUri: nonceRecord.redirectUri,
      });

      const updatedCreds = {
        ...credentials,
        accessToken: tokenResult.accessToken,
        refreshToken: tokenResult.refreshToken,
        expiresAt: Date.now() + (tokenResult.expiresIn || 300) * 1000,
      };

      const encrypted = this.credentialsService.encrypt(updatedCreds);

      await this.prisma.accountingIntegration.update({
        where: { id: integration.id },
        data: {
          status: 'connected',
          credentials: encrypted,
          lastVerifiedAt: new Date(),
          lastErrorMessage: null,
        },
      });

      // Audit log WITHOUT leaking tokens, codes, or secrets (§5.2 rule 7)
      await this.auditLogService.createLog({
        tenantId: integration.agencyId,
        userId: nonceRecord.userId,
        action: 'OAUTH_AUTHORIZE_SUCCESS',
        module: 'accounting',
        entityType: 'AccountingIntegration',
        entityId: integration.id,
        entityDisplayName: integration.name,
        description: `OAuth2 yetkilendirmesi başarıyla tamamlandı (${integration.provider})`,
        severity: 'info',
      });

      return {
        success: true,
        message: 'Muhasebe entegrasyonu başarıyla bağlandı.',
        integrationId: integration.id,
      };
    } catch (err: any) {
      await this.prisma.accountingIntegration.update({
        where: { id: integration.id },
        data: {
          status: 'error',
          lastErrorMessage: err.message,
        },
      });

      return {
        success: false,
        message: `Yetkilendirme hatası: ${err.message}`,
      };
    }
  }

  // --- Configuration Discovery (§6) ---

  async listDiscoveryBusinesses(id: string, scope: AccountingScope) {
    const integration = await this.findIntegrationById(id, scope);
    const credentials = integration.credentials
      ? this.credentialsService.decrypt(integration.credentials)
      : {};
    const connector: any = this.connectorFactory.create(
      integration.provider,
      credentials,
      integration.environment as AccountingEnvironment,
    );
    if (typeof connector.listBusinesses === 'function') {
      return connector.listBusinesses();
    }
    return [];
  }

  async listDiscoveryLedgerAccounts(id: string, scope: AccountingScope) {
    const integration = await this.findIntegrationById(id, scope);
    const credentials = integration.credentials
      ? this.credentialsService.decrypt(integration.credentials)
      : {};
    const connector: any = this.connectorFactory.create(
      integration.provider,
      credentials,
      integration.environment as AccountingEnvironment,
    );
    if (typeof connector.listLedgerAccounts === 'function') {
      return connector.listLedgerAccounts();
    }
    return [];
  }

  async listDiscoveryTaxRates(id: string, scope: AccountingScope) {
    const integration = await this.findIntegrationById(id, scope);
    const credentials = integration.credentials
      ? this.credentialsService.decrypt(integration.credentials)
      : {};
    const connector: any = this.connectorFactory.create(
      integration.provider,
      credentials,
      integration.environment as AccountingEnvironment,
    );
    if (typeof connector.listTaxRates === 'function') {
      return connector.listTaxRates();
    }
    return [];
  }

  // --- §4.2 Keep-alive weekly job ---

  async runKeepAliveJob(): Promise<{ checked: number; refreshed: number; failed: number }> {
    const activeIntegrations = await this.prisma.accountingIntegration.findMany({
      where: {
        provider: { in: ['SAGE-ACCOUNTING', 'SAGE_ACCOUNTING'] },
        status: 'connected',
        deletedAt: null,
      },
    });

    let refreshed = 0;
    let failed = 0;

    for (const integration of activeIntegrations) {
      // Mock environment does NOT make real network calls (§4.2)
      if (integration.environment === 'MOCK') {
        continue;
      }

      const credentials = integration.credentials
        ? this.credentialsService.decrypt(integration.credentials)
        : {};

      try {
        const connector: any = this.connectorFactory.create(
          integration.provider,
          credentials,
          integration.environment as AccountingEnvironment,
        );
        // Uses the same locked single-flight path
        await connector.testConnection();
        refreshed++;
      } catch (err: any) {
        failed++;
        await this.prisma.accountingIntegration.update({
          where: { id: integration.id },
          data: {
            status: 'failed',
            lastErrorMessage: `REAUTHORIZATION_REQUIRED: Canlı tutma yenilemesi başarısız: ${err.message}`,
          },
        });
      }
    }

    return { checked: activeIntegrations.length, refreshed, failed };
  }

  private toMaskedResponse(integration: any) {
    const { credentials, ...rest } = integration;
    let maskedCredentials: Record<string, any> = {};
    if (credentials) {
      try {
        const decrypted = this.credentialsService.decrypt(credentials);
        maskedCredentials = this.credentialsService.maskCredentials(
          integration.provider,
          decrypted,
        );
      } catch {
        maskedCredentials = {};
      }
    }
    return {
      ...rest,
      credentials: maskedCredentials,
    };
  }
}
