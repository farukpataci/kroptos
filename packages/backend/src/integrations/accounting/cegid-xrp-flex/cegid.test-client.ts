import { IntegrationNotVerifiedError } from '../core/AccountingErrors';
import {
  CegidCustomer,
  CegidPayment,
  CegidSalesInvoice,
} from './cegid.types';
import { ICegidClient } from './cegid.invoice-flow';

export class CegidTestClient implements ICegidClient {
  constructor(private readonly _credentials?: any) {}

  async createInvoice(_dto: CegidSalesInvoice): Promise<CegidSalesInvoice> {
    throw new IntegrationNotVerifiedError('CEGID-XRP-FLEX', 'TEST');
  }

  async getInvoice(_ref: string): Promise<CegidSalesInvoice> {
    throw new IntegrationNotVerifiedError('CEGID-XRP-FLEX', 'TEST');
  }

  async releaseInvoice(_ref: string): Promise<void> {
    throw new IntegrationNotVerifiedError('CEGID-XRP-FLEX', 'TEST');
  }

  async syncContact(_dto: CegidCustomer): Promise<CegidCustomer> {
    throw new IntegrationNotVerifiedError('CEGID-XRP-FLEX', 'TEST');
  }

  async recordPayment(_dto: CegidPayment): Promise<CegidPayment> {
    throw new IntegrationNotVerifiedError('CEGID-XRP-FLEX', 'TEST');
  }
}
