import { BadRequestException } from '@nestjs/common';
import {
  FreeAgentBankAccount,
  FreeAgentBankTransactionExplanation,
  FreeAgentCategory,
  FreeAgentCompany,
  FreeAgentContact,
  FreeAgentInvoice,
  FreeAgentInvoiceTransition,
  FreeAgentPaginatedResponse,
  FreeAgentPaginationParams,
  FreeAgentUser,
} from './freeagent.types';

export const DEFAULT_FREEAGENT_USER_AGENT = 'KroptOS-Commerce/1.0 (https://kroptos.com; integrations@kroptos.com)';

export interface IFreeAgentClient {
  getCompany(): Promise<FreeAgentCompany>;
  getCurrentUser(): Promise<FreeAgentUser>;
  listContacts(params?: FreeAgentPaginationParams): Promise<FreeAgentPaginatedResponse<FreeAgentContact>>;
  getContact(idOrUrl: string | number): Promise<FreeAgentContact>;
  createContact(contact: Partial<FreeAgentContact>): Promise<FreeAgentContact>;
  listCategories(): Promise<FreeAgentCategory[]>;
  listBankAccounts(): Promise<FreeAgentBankAccount[]>;
  createDraftInvoice(invoice: Partial<FreeAgentInvoice>): Promise<FreeAgentInvoice>;
  getInvoice(idOrUrl: string | number): Promise<FreeAgentInvoice>;
  listInvoices(params?: FreeAgentPaginationParams): Promise<FreeAgentPaginatedResponse<FreeAgentInvoice>>;
  transitionInvoice(idOrUrl: string | number, transition: FreeAgentInvoiceTransition): Promise<FreeAgentInvoice>;
  deleteInvoice(idOrUrl: string | number): Promise<{ success: boolean }>;
  createBankTransactionExplanation(
    explanation: FreeAgentBankTransactionExplanation,
  ): Promise<FreeAgentBankTransactionExplanation>;
}

/**
 * §5.5 FreeAgent HTTP Headers Builder
 * CRITICAL: User-Agent header ZORUNLUDUR.
 * User-Agent içerisine token, kiracı ID veya kişisel veri KONULAMAZ.
 */
export function buildFreeAgentHeaders(
  accessToken: string,
  userAgent: string = DEFAULT_FREEAGENT_USER_AGENT,
): Record<string, string> {
  const cleanToken = (accessToken || '').trim();
  if (!cleanToken) {
    throw new BadRequestException('[FreeAgent Client] Access token boş veya tanımsız olamaz.');
  }

  const cleanUserAgent = (userAgent || '').trim();
  if (!cleanUserAgent) {
    throw new BadRequestException(
      '[FreeAgent Client] User-Agent başlığı zorunludur (§5.5). Uygulamayı tanımlayan sabit bir User-Agent sağlanmalıdır.',
    );
  }

  // Güvenlik: User-Agent içinde token veya gizli anahtar taşınamaz
  if (cleanUserAgent.includes(cleanToken) || cleanUserAgent.toLowerCase().includes('bearer')) {
    throw new BadRequestException(
      '[FreeAgent Client] Güvenlik ihlali: User-Agent başlığı token veya kimlik bilgisi içeremez (§5.5).',
    );
  }

  const authHeader = cleanToken.toLowerCase().startsWith('bearer ')
    ? cleanToken
    : `Bearer ${cleanToken}`;

  return {
    Authorization: authHeader,
    'User-Agent': cleanUserAgent,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

/**
 * §2.1 FreeAgent Sayfalama Parametreleri Doğrulaması
 * varsayılan 25, EN FAZLA 100
 */
export function validateFreeAgentPagination(params?: FreeAgentPaginationParams): {
  page: number;
  per_page: number;
  view?: string;
  updated_since?: string;
} {
  const page = params?.page !== undefined ? Math.floor(params.page) : 1;
  const per_page = params?.per_page !== undefined ? Math.floor(params.per_page) : 25;

  if (page < 1) {
    throw new BadRequestException(
      `[FreeAgent Client] Sayfa numarası (page) en az 1 olmalıdır. Gelen: ${page}`,
    );
  }

  if (per_page < 1 || per_page > 100) {
    throw new BadRequestException(
      `[FreeAgent Client] Sayfa başına kayıt (per_page) 1 ile 100 arasında olmalıdır (§2.1). Gelen: ${per_page}`,
    );
  }

  return {
    page,
    per_page,
    view: params?.view,
    updated_since: params?.updated_since,
  };
}

/**
 * §2.1 Link header ve X-Total-Count ayrıştırıcı
 * Ör: <https://api.freeagent.com/v2/invoices?page=2&per_page=25>; rel="next"
 */
export function parseFreeAgentLinkHeader(linkHeader?: string | null): {
  nextPage?: number;
  prevPage?: number;
  firstPage?: number;
  lastPage?: number;
} {
  if (!linkHeader) return {};

  const links: { [rel: string]: number } = {};
  const parts = linkHeader.split(',');

  for (const part of parts) {
    const section = part.split(';');
    if (section.length !== 2) continue;

    const urlMatch = section[0].match(/<(.+)>/);
    const relMatch = section[1].match(/rel="?([^"]+)"?/);

    if (urlMatch && relMatch) {
      const urlStr = urlMatch[1];
      const rel = relMatch[1].trim();

      try {
        const url = new URL(urlStr);
        const pageParam = url.searchParams.get('page');
        if (pageParam) {
          links[rel] = parseInt(pageParam, 10);
        }
      } catch {
        // url parsing fallback
      }
    }
  }

  return {
    nextPage: links['next'],
    prevPage: links['prev'],
    firstPage: links['first'],
    lastPage: links['last'],
  };
}
