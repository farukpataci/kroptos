import {
  ExactAccount,
  ExactCountry,
  ExactDivision,
  ExactItem,
  ExactMeResponse,
  ExactODataResponse,
  ExactSalesInvoice,
  ExactVATCode,
  EXACT_REGIONAL_CONFIGS,
} from './exact.types';

export interface ExactPaginationParams {
  top?: number;
  skip?: number;
  select?: string;
  filter?: string;
  nextUrl?: string;
}

export interface IExactClient {
  getMe(): Promise<ExactMeResponse>;
  listDivisions(): Promise<ExactDivision[]>;
  getDivision(code: number | string): Promise<ExactDivision>;
  listAccounts(division: number | string, params?: ExactPaginationParams): Promise<ExactODataResponse<ExactAccount>>;
  getAccount(division: number | string, id: string): Promise<ExactAccount>;
  createAccount(division: number | string, account: Partial<ExactAccount>): Promise<ExactAccount>;
  listItems(division: number | string, params?: ExactPaginationParams): Promise<ExactODataResponse<ExactItem>>;
  listVATCodes(division: number | string): Promise<ExactVATCode[]>;
  createSalesInvoice(division: number | string, invoice: Partial<ExactSalesInvoice>): Promise<ExactSalesInvoice>;
  getSalesInvoice(division: number | string, id: string): Promise<ExactSalesInvoice>;
  findSalesInvoiceByReference(division: number | string, reference: string): Promise<ExactSalesInvoice | null>;
  cancelSalesInvoice(division: number | string, id: string): Promise<ExactSalesInvoice>;
  getSyncDeleted(division: number | string, entityType: string, timestamp?: number): Promise<any[]>;
}

export function resolveExactBaseUrl(country: ExactCountry = 'NL'): string {
  const config = EXACT_REGIONAL_CONFIGS[country] || EXACT_REGIONAL_CONFIGS.NL;
  return config.baseUrl;
}
