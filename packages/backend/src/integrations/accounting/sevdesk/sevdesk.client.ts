import { BadRequestException } from '@nestjs/common';
import {
  SevdeskBookAmountPayload,
  SevdeskContact,
  SevdeskInvoice,
  SevdeskInvoiceFactoryPayload,
  SevdeskUser,
} from './sevdesk.types';

export const SEVDESK_API_BASE_URL = 'https://my.sevdesk.de/api/v1';

export interface ISevdeskClient {
  /**
   * §4 Verifies token and retrieves token owner user details.
   */
  getCurrentUser(): Promise<SevdeskUser>;

  /**
   * §5.1 & §5.4 Creates invoice via Factory endpoint in Draft (100) status.
   */
  createDraftInvoice(payload: SevdeskInvoiceFactoryPayload): Promise<SevdeskInvoice>;

  /**
   * §5.1 Reads back invoice to inspect server-calculated amounts.
   */
  getInvoice(id: string | number): Promise<SevdeskInvoice>;

  /**
   * §5.8 Records payment and elevates invoice status to Paid (1000).
   */
  bookAmount(invoiceId: string | number, payload: SevdeskBookAmountPayload): Promise<SevdeskInvoice>;

  /**
   * §6 Resets invoice to Draft status.
   */
  resetToDraft(invoiceId: string | number): Promise<SevdeskInvoice>;

  /**
   * §6 Resets invoice to Open status.
   */
  resetToOpen(invoiceId: string | number): Promise<SevdeskInvoice>;

  /**
   * Lists invoices with pagination.
   */
  listInvoices(params?: { limit?: number; offset?: number; status?: number }): Promise<SevdeskInvoice[]>;

  /**
   * Lists contacts with pagination.
   */
  listContacts(params?: { limit?: number; offset?: number }): Promise<SevdeskContact[]>;

  /**
   * Creates or updates a contact.
   */
  createContact(contact: Partial<SevdeskContact>): Promise<SevdeskContact>;
}

/**
 * §2.3 & §8.6sevDesk HTTP Headers Builder
 * CRITICAL: Authorization header contains the raw 32-character token.
 * 'Bearer' prefix MUST NOT be added.
 */
export function buildSevdeskHeaders(apiToken: string): Record<string, string> {
  const cleanToken = (apiToken || '').trim();
  if (!cleanToken) {
    throw new BadRequestException('[sevDesk Client] API token boş veya tanımsız olamaz.');
  }

  // Fail-safe check against inadvertent Bearer prefix insertion
  if (cleanToken.toLowerCase().startsWith('bearer ')) {
    throw new BadRequestException(
      "[sevDesk Client] API token 'Bearer' öneki içeremez. sevDesk Authorization başlığında ham token beklenir.",
    );
  }

  return {
    Authorization: cleanToken,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

/**
 * Validates sevDesk pagination parameters (limit 1-1000, offset >= 0).
 */
export function validatePagination(limit?: number, offset?: number): { limit: number; offset: number } {
  const safeLimit = limit !== undefined ? Math.floor(limit) : 50;
  const safeOffset = offset !== undefined ? Math.floor(offset) : 0;

  if (safeLimit < 1 || safeLimit > 1000) {
    throw new BadRequestException(
      `[sevDesk Client] Geçersiz limit: ${safeLimit}. sevDesk pagination limiti 1 ile 1000 arasında bir tam sayı olmalıdır.`,
    );
  }

  if (safeOffset < 0) {
    throw new BadRequestException(
      `[sevDesk Client] Geçersiz offset: ${safeOffset}. Offset negatif olamaz.`,
    );
  }

  return { limit: safeLimit, offset: safeOffset };
}
