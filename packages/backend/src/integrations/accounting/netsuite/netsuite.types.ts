import { AccountingEnvironment } from '../core/AccountingTypes';

export type NetSuiteEnvironment = AccountingEnvironment;

/**
 * NetSuite M2M OAuth 2.0 Credentials (§5.2)
 * Özel anahtar kesinlikle bu JSON'a doğrudan yazılmaz!
 * Yalnızca ortam/KMS referansı (`keyReference`) saklanır.
 */
export interface NetSuiteCredentials {
  accountId: string; // NetSuite Account ID (örn: "1234567" veya "1234567_SB1")
  clientId: string; // Integration Record Consumer Key / Client ID
  certificateId: string; // kid header değeri (NetSuite Setup Certificate ID)
  keyReference: string; // Özel anahtar referansı (örn: "NETSUITE_PRIVATE_KEY_PROD")
  subsidiaryId?: string | number; // OneWorld hesapları için zorunlu subsidiary ID (§5.9)
  certificateExpiresAt?: string; // Sertifika bitiş tarihi (ISO 8601) (§5.2)
  concurrencyLimit?: number; // Entegrasyon başına eşzamanlı istek limiti (varsayılan: 1) (§5.3)
}

/**
 * OAuth 2.0 Token Response
 */
export interface NetSuiteTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number; // saniye (örn: 3600)
}

export interface NetSuiteCachedToken {
  accessToken: string;
  expiresAt: number; // epoch ms
}

/**
 * NetSuite Sertifika Durumu (§5.2)
 */
export type NetSuiteCertificateStatus = 'VALID' | 'EXPIRING_SOON' | 'EXPIRED' | 'NOT_SET';

export interface NetSuiteCertificateCheckResult {
  status: NetSuiteCertificateStatus;
  daysRemaining?: number;
  expiresAt?: string;
  isExpired: boolean;
  isExpiringSoon: boolean; // 30 gün veya daha az
  isCritical: boolean; // 7 gün veya daha az
  warningMessage?: string;
}

/**
 * NetSuite REST Kayıt Şeması Tipleri
 */
export interface NetSuiteRecordRef {
  id?: string | number;
  refName?: string;
  externalId?: string;
}

export interface NetSuiteCustomerPayload {
  entityId?: string;
  companyName?: string;
  firstName?: string;
  lastName?: string;
  isPerson?: boolean;
  email?: string;
  phone?: string;
  subsidiary?: NetSuiteRecordRef;
  externalId?: string;
  [key: string]: any;
}

export interface NetSuiteInvoiceItemLine {
  item: NetSuiteRecordRef;
  quantity: number;
  rate?: number;
  amount?: number;
  description?: string;
  taxCode?: NetSuiteRecordRef;
  [key: string]: any;
}

export interface NetSuiteInvoicePayload {
  entity: NetSuiteRecordRef; // Customer ref
  tranDate?: string; // YYYY-MM-DD
  dueDate?: string; // YYYY-MM-DD
  otherRefNum?: string; // External / Po number
  memo?: string;
  subsidiary?: NetSuiteRecordRef; // OneWorld
  currency?: NetSuiteRecordRef;
  item?: {
    items: NetSuiteInvoiceItemLine[];
  };
  externalId?: string; // KroptOS referansı (§5.7)
  [key: string]: any;
}

export interface NetSuitePaymentPayload {
  customer: NetSuiteRecordRef;
  payment?: number;
  tranDate?: string;
  memo?: string;
  externalId?: string;
  subsidiary?: NetSuiteRecordRef;
  [key: string]: any;
}

export interface NetSuiteItemPayload {
  itemId: string;
  displayName?: string;
  description?: string;
  salesDescription?: string;
  rate?: number;
  subsidiary?: NetSuiteRecordRef;
  externalId?: string;
  [key: string]: any;
}

/**
 * Metadata Catalog Şema Keşfi Tipleri (§5.5)
 */
export interface NetSuiteMetadataCatalogProperty {
  type: string;
  title?: string;
  format?: string;
  readOnly?: boolean;
  required?: boolean;
  description?: string;
}

export interface NetSuiteMetadataCatalogSchema {
  title: string;
  type: string;
  properties: Record<string, NetSuiteMetadataCatalogProperty>;
  required?: string[];
}

export interface NetSuiteSchemaDiscovery {
  discoveredAt: string;
  accountId: string;
  records: Record<string, {
    fields: string[];
    requiredFields: string[];
  }>;
  missingRequiredFields: string[];
  isValid: boolean;
}
