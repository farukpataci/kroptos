import { AccountingProviderSchema } from '../core/AccountingTypes';

/**
 * Odoo Credential Schema (§5, §6, §10)
 *
 * CRITICAL SECURITY RULE (§5, §10):
 * - NO password field! Odoo API keys are used for both modern JSON-2 and classic RPC.
 * - Password MUST NOT be accepted, stored, or transmitted.
 */
export const ODOO_CREDENTIAL_SCHEMA: AccountingProviderSchema = {
  provider: 'ODOO',
  name: 'Odoo (ERP & Accounting)',
  fields: [
    {
      key: 'baseUrl',
      label: 'Odoo Sunucu URL (Base URL)',
      type: 'url',
      required: true,
      description: 'Odoo örneğinizin genel HTTPS adresi (örn: https://mycompany.odoo.com).',
    },
    {
      key: 'database',
      label: 'Veritabanı Adı (Database Name)',
      type: 'text',
      required: true,
      description: 'Bağlanılacak Odoo veritabanının adı (Database identifier).',
    },
    {
      key: 'apiKey',
      label: 'Odoo API Anahtarı (API Key)',
      type: 'password',
      required: true,
      secret: true,
      description: 'Kullanıcı profilinizden oluşturulan Odoo API anahtarı. Şifre yerine geçer.',
    },
    {
      key: 'defaultJournalId',
      label: 'Varsayılan Satış Günlüğü ID (Journal ID - İsteğe Bağlı)',
      type: 'number',
      required: false,
      description: 'Müşteri faturalarının kaydedileceği satış günlüğü (Customer Invoices Journal).',
    },
    {
      key: 'defaultTaxId',
      label: 'Varsayılan Satış Vergisi ID (Tax ID - İsteğe Bağlı)',
      type: 'number',
      required: false,
      description: 'Fatura satırlarına uygulanacak varsayılan Odoo vergi kimliği (account.tax ID).',
    },
  ],
};
