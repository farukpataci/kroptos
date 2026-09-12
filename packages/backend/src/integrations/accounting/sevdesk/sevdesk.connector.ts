import { BadRequestException } from '@nestjs/common';
import { AccountingConnector } from '../core/AccountingConnector';
import {
  AccountingContactRequest,
  AccountingContactResult,
  AccountingEnvironment,
  AccountingInvoiceRequest,
  AccountingInvoiceResult,
  AccountingPaymentRequest,
  AccountingPaymentResult,
  AccountingProductRequest,
  AccountingProductResult,
  AccountingTestConnectionResult,
} from '../core/AccountingTypes';
import { IntegrationNotVerifiedError } from '../core/AccountingErrors';
import { ISevdeskClient } from './sevdesk.client';
import { SevdeskMockClient } from './sevdesk.mock-client';
import { SevdeskTestClient } from './sevdesk.test-client';
import { SevdeskProductionClient } from './sevdesk.production-client';
import { SEVDESK_CAPABILITIES } from './sevdesk.capabilities';
import { SEVDESK_DESCRIPTOR } from './sevdesk.descriptor';
import { SevdeskInvoiceFlow } from './sevdesk.invoice-flow';
import { SevdeskHealthCheckResult, SevdeskHealthService } from './sevdesk.health';
import { createSevdeskRef } from './sevdesk.ref';
import { SevdeskStatusMapper } from './sevdesk.status-mapper';

export class SevdeskConnector extends AccountingConnector {
  readonly provider = 'SEVDESK';
  readonly capabilities = SEVDESK_CAPABILITIES;
  readonly descriptor = SEVDESK_DESCRIPTOR;
  readonly environment: AccountingEnvironment;

  private client: ISevdeskClient;
  private readonly apiToken: string;

  constructor(
    credentials: Record<string, any>,
    environment: AccountingEnvironment = 'MOCK',
    customClient?: ISevdeskClient,
  ) {
    super();
    this.environment = environment;
    this.apiToken = (credentials?.apiToken || '').trim();

    if (customClient) {
      this.client = customClient;
    } else if (this.environment === 'MOCK') {
      this.client = new SevdeskMockClient();
    } else if (this.environment === 'TEST') {
      this.client = new SevdeskTestClient();
    } else {
      this.client = new SevdeskProductionClient();
    }
  }

  /**
   * §4 Test connection and verify token owner user.
   */
  async testConnection(): Promise<AccountingTestConnectionResult> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError('sevdesk', this.environment);
    }

    try {
      const user = await this.client.getCurrentUser();
      return {
        success: true,
        message: `sevDesk bağlantısı başarılı. Token Sahibi: ${user.fullname || user.username} (${user.email || 'eposta yok'})`,
        companyId: String(user.id),
        companyName: user.fullname || user.username,
        environment: this.environment,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `sevDesk bağlantı hatası: ${err?.message || 'Bilinmeyen hata'}`,
        environment: this.environment,
      };
    }
  }

  /**
   * §5.1 & §5.2 Draft-first invoice creation with server total reconciliation.
   */
  async createInvoice(request: AccountingInvoiceRequest): Promise<AccountingInvoiceResult> {
    return SevdeskInvoiceFlow.executeCreateInvoice(this.client, request);
  }

  /**
   * §5.8 Record Payment:
   * Uses bookAmount to register payment in sevDesk and read back the updated invoice status.
   */
  async recordPayment(request: AccountingPaymentRequest): Promise<AccountingPaymentResult> {
    const invoiceId = request.invoiceExternalId;
    if (!invoiceId) {
      throw new BadRequestException('[sevDesk Payment] invoiceExternalId zorunludur.');
    }

    const checkAccountId = request.accountId || '1'; // Default check account if not configured
    const checkAccountRef = createSevdeskRef('CheckAccount', checkAccountId);

    const paymentDate = request.paymentDate
      ? new Date(request.paymentDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    const updatedInvoice = await this.client.bookAmount(invoiceId, {
      amount: request.amount,
      date: paymentDate,
      type: 'N',
      checkAccount: checkAccountRef,
    });

    const isFullyPaid = updatedInvoice.status === 1000;
    const documentStatus = SevdeskStatusMapper.toKroptosStatus(updatedInvoice.status);

    return {
      externalId: `PAY-${invoiceId}-${Date.now()}`,
      rawResponse: {
        success: true,
        status: isFullyPaid ? 'completed' : 'pending',
        amount: request.amount,
        currency: request.currency || updatedInvoice.currency || 'EUR',
        paidAt: paymentDate,
        updatedInvoice,
        documentStatus,
        paidAmount: updatedInvoice.paidAmount,
      },
    };
  }

  /**
   * §6 Cancel Invoice:
   * Based on current invoice status, invokes resetToDraft or throws if already paid.
   */
  async cancelInvoice(invoiceId: string): Promise<{ success: boolean; rawResponse?: any }> {
    if (!invoiceId) {
      throw new BadRequestException('[sevDesk Cancel] invoiceId zorunludur.');
    }

    const invoice = await this.client.getInvoice(invoiceId);
    const resetAction = SevdeskStatusMapper.getResetAction(invoice.status);

    if (resetAction === 'notAllowed') {
      throw new BadRequestException(
        'Ödenmiş (Paid/1000) sevDesk faturaları API üzerinden taslağa alınamaz. Resmi iptal için ters kayıt / iade faturası (Credit Note) düzenlenmelidir.',
      );
    }

    const resetInvoice = await this.client.resetToDraft(invoiceId);
    return {
      success: true,
      rawResponse: {
        status: 'cancelled',
        resetInvoice,
      },
    };
  }

  /**
   * §5.6 Reference search is DOCUMENTATION_REQUIRED and not enabled for automatic claim.
   */
  async findInvoiceByReference(_referenceCode: string): Promise<AccountingInvoiceResult | null> {
    return null;
  }

  /**
   * Contacts sync
   */
  async syncContact(request: AccountingContactRequest): Promise<AccountingContactResult> {
    const created = await this.client.createContact({
      name: request.name,
      customerNumber: request.kroptosKey,
    });
    return {
      externalId: String(created.id),
      rawResponse: created as any,
    };
  }

  /**
   * Product mapping
   */
  async mapProduct(request: AccountingProductRequest): Promise<AccountingProductResult> {
    return {
      externalId: request.sku,
      code: request.sku,
      rawResponse: { sku: request.sku, name: request.name },
    };
  }

  /**
   * §4 Periodic token health check.
   */
  async checkHealth(): Promise<SevdeskHealthCheckResult> {
    return SevdeskHealthService.checkHealth(this.client);
  }

  /**
   * Returns masked credentials for display.
   */
  getMaskedCredentials(): Record<string, string> {
    if (!this.apiToken) return {};
    const visible = this.apiToken.substring(0, 4);
    return {
      apiToken: `${visible}${'•'.repeat(Math.max(4, this.apiToken.length - 4))}`,
    };
  }
}
