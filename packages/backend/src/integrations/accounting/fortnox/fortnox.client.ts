import {
  FortnoxArticle,
  FortnoxCustomer,
  FortnoxFinancialYear,
  FortnoxInvoice,
  FortnoxPayment,
} from './fortnox.types';

export const FORTNOX_API_BASE_URL = 'https://api.fortnox.se/3';
export const FORTNOX_OAUTH_AUTH_URL = 'https://apps.fortnox.se/oauth-v1/auth';
export const FORTNOX_OAUTH_TOKEN_URL = 'https://apps.fortnox.se/oauth-v1/token';

/**
 * Fortnox Client Interface (§2, §5)
 * Note: Email and Print endpoints are strictly forbidden (§5.5) and are not exposed.
 */
export interface IFortnoxClient {
  /**
   * Get company information or test connectivity
   */
  getCompanyInformation(): Promise<{
    CompanyName: string;
    OrganisationNumber?: string;
    DatabaseNumber?: string | number;
  }>;

  /**
   * Check financial years for a given date (§5.6)
   * GET /3/financialyears/?date={date}
   */
  getFinancialYears(date?: string): Promise<FortnoxFinancialYear[]>;

  /**
   * Create draft invoice
   * POST /3/invoices
   */
  createInvoice(invoice: FortnoxInvoice): Promise<FortnoxInvoice>;

  /**
   * Read invoice details including calculated totals
   * GET /3/invoices/{DocumentNumber}
   */
  getInvoice(documentNumber: string | number): Promise<FortnoxInvoice>;

  /**
   * Bookkeep / finalize an invoice (§5.4)
   * PUT /3/invoices/{DocumentNumber}/bookkeep
   */
  bookkeepInvoice(documentNumber: string | number): Promise<FortnoxInvoice>;

  /**
   * Cancel an unbooked invoice
   * PUT /3/invoices/{DocumentNumber}/cancel
   */
  cancelInvoice(documentNumber: string | number): Promise<FortnoxInvoice>;

  /**
   * Create credit invoice against a booked invoice (§5.5)
   * PUT /3/invoices/{DocumentNumber}/credit
   */
  creditInvoice(documentNumber: string | number): Promise<FortnoxInvoice>;

  /**
   * Search invoice by order number filter (§5.7)
   * GET /3/invoices?yourordernumber={orderNumber}
   */
  searchInvoicesByOrderNumber(orderNumber: string): Promise<FortnoxInvoice[]>;

  /**
   * Create customer
   * POST /3/customers
   */
  createCustomer(customer: FortnoxCustomer): Promise<FortnoxCustomer>;

  /**
   * Get customer by customer number
   * GET /3/customers/{CustomerNumber}
   */
  getCustomer(customerNumber: string): Promise<FortnoxCustomer | null>;

  /**
   * Create article / product
   * POST /3/articles
   */
  createArticle(article: FortnoxArticle): Promise<FortnoxArticle>;

  /**
   * Get article by article number
   * GET /3/articles/{ArticleNumber}
   */
  getArticle(articleNumber: string): Promise<FortnoxArticle | null>;

  /**
   * Record payment for an invoice
   * POST /3/invoicepayments
   */
  createPayment(payment: FortnoxPayment): Promise<FortnoxPayment>;
}
