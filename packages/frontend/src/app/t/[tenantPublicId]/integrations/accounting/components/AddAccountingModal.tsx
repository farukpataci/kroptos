'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  XMarkIcon,
  ShieldCheckIcon,
  InformationCircleIcon,
  BanknotesIcon,
  ArrowPathIcon,
  LinkIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { AccountingIntegrationItem, AccountingProviderInfo } from '../types';

interface AddAccountingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingIntegration?: AccountingIntegrationItem | null;
}

const DEFAULT_PROVIDERS: AccountingProviderInfo[] = [
  {
    id: 'PARASUT',
    displayName: 'Paraşüt',
    country: 'TR',
    protocol: 'jsonapi',
    readiness: 'MOCK_READY',
    documentationStatus: 'PARTIAL',
    credentialSchema: {
      provider: 'PARASUT',
      name: 'Paraşüt',
      fields: [
        { key: 'clientId', label: 'Client ID (Uygulama Kimliği)', type: 'text', required: true },
        { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true, secret: true },
        { key: 'username', label: 'Kullanıcı Adı (E-posta)', type: 'text', required: true },
        { key: 'password', label: 'Şifre', type: 'password', required: true, secret: true },
        { key: 'companyId', label: 'Firma ID (Company ID)', type: 'text', required: true },
        { key: 'redirectUri', label: 'Redirect URI', type: 'text', required: false },
      ],
    },
    capabilities: { stockSync: 'NOT_SUPPORTED', salesInvoice: 'MOCK_ONLY' },
    supportsMock: true,
    supportsTest: false,
    supportsProduction: false,
  },
  {
    id: 'KOLAYBI',
    displayName: "KolayBi'",
    country: 'TR',
    protocol: 'rest',
    readiness: 'MOCK_READY',
    documentationStatus: 'PARTIAL',
    credentialSchema: {
      provider: 'KOLAYBI',
      name: "KolayBi'",
      fields: [
        { key: 'apiKey', label: 'API Anahtarı (API Key)', type: 'password', required: true, secret: true },
        { key: 'channel', label: 'Kanal Kodu (Channel)', type: 'text', required: true },
        { key: 'baseUrl', label: 'API Base URL', type: 'url', required: false },
      ],
    },
    capabilities: { stockSync: 'NOT_SUPPORTED', salesInvoice: 'MOCK_ONLY' },
    supportsMock: true,
    supportsTest: false,
    supportsProduction: false,
  },
  {
    id: 'BIZIMHESAP',
    displayName: 'BizimHesap',
    country: 'TR',
    protocol: 'rest',
    readiness: 'MOCK_READY',
    documentationStatus: 'VERIFIED',
    credentialSchema: {
      provider: 'BIZIMHESAP',
      name: 'BizimHesap',
      fields: [
        { key: 'firmId', label: 'Firma ID / Kod (firmId)', type: 'password', required: true, secret: true },
        { key: 'key', label: 'API Anahtarı (key)', type: 'password', required: true, secret: true },
        { key: 'token', label: 'API Belirteci (token)', type: 'password', required: true, secret: true },
      ],
    },
    capabilities: { stockSync: 'NOT_SUPPORTED', salesInvoice: 'MOCK_ONLY', multiCompany: 'SUPPORTED' },
    supportsMock: true,
    supportsTest: false,
    supportsProduction: false,
  },
  {
    id: 'SAP_S4HANA_CLOUD',
    displayName: 'SAP S/4HANA Cloud',
    country: 'DE',
    protocol: 'odata',
    readiness: 'MOCK_READY',
    documentationStatus: 'PARTIAL',
    credentialSchema: {
      provider: 'SAP_S4HANA_CLOUD',
      name: 'SAP S/4HANA Cloud (Public Edition)',
      fields: [
        { key: 'apiKey', label: 'Sandbox API Key (sandbox.api.sap.com)', type: 'password', required: false, secret: true },
        { key: 'baseUrl', label: 'Tenant API Base URL', type: 'url', required: false },
        { key: 'username', label: 'Communication User', type: 'text', required: false },
        { key: 'password', label: 'Communication Password', type: 'password', required: false, secret: true },
      ],
    },
    capabilities: { stockSync: 'NOT_SUPPORTED', salesInvoice: 'NOT_SUPPORTED', multiCompany: 'SUPPORTED' },
    supportsMock: true,
    supportsTest: false,
    supportsProduction: false,
  },
  {
    id: 'MS_DYNAMICS_BC_ONLINE',
    displayName: 'Dynamics 365 Business Central Online',
    country: 'US',
    protocol: 'odata',
    readiness: 'MOCK_READY',
    documentationStatus: 'PARTIAL',
    credentialSchema: {
      provider: 'MS_DYNAMICS_BC_ONLINE',
      name: 'Microsoft Dynamics 365 Business Central Online',
      fields: [
        {
          key: 'aadTenantId',
          label: 'Microsoft Entra (Azure AD) Directory / Tenant ID',
          type: 'text',
          required: true,
          description: 'Azure Portal / Entra ID genel bakışında yer alan Directory (tenant) ID GUID değeri.',
        },
        {
          key: 'environmentName',
          label: 'Ortam Adı (Environment Name)',
          type: 'text',
          required: true,
          defaultValue: 'production',
          description: 'Business Central ortamı: "production", "sandbox" veya şirketinizin özel ortam adı.',
        },
        {
          key: 'companyId',
          label: 'Business Central Şirket Kimliği (Company ID GUID)',
          type: 'text',
          required: true,
          description: 'İşlemlerin yürütüleceği Business Central Company GUID değeri.',
        },
        {
          key: 'userDomain',
          label: 'Kullanıcı Alan Adı (User Domain - İsteğe Bağlı)',
          type: 'text',
          required: false,
          description: 'Doğrudan kiracı URL yapısı kullanılıyorsa (ör. firmaniz.com), aksi halde boş bırakınız.',
        },
        {
          key: 'clientId',
          label: 'Özel İstemci Kimliği (Client ID - İsteğe Bağlı)',
          type: 'text',
          required: false,
          description: 'Kendi özel Entra ID uygulamanızı kullanmak isterseniz giriniz; boşsa merkezi KroptOS çok kiracılı uygulaması kullanılır.',
        },
        {
          key: 'clientSecret',
          label: 'Özel İstemci Gizli Anahtarı (Client Secret - İsteğe Bağlı)',
          type: 'password',
          required: false,
          secret: true,
          description: 'Özel Entra ID uygulamanızın istemci parolası (Client Secret).',
        },
      ],
    },
    capabilities: { stockSync: 'NOT_SUPPORTED', salesInvoice: 'MOCK_ONLY', multiCompany: 'SUPPORTED' },
    supportsMock: true,
    supportsTest: false,
    supportsProduction: false,
  },
  {
    id: 'SAGE-ACCOUNTING',
    displayName: 'Sage Business Cloud Accounting',
    country: 'GB',
    protocol: 'rest',
    readiness: 'MOCK_READY',
    documentationStatus: 'PARTIAL',
    credentialSchema: {
      provider: 'SAGE-ACCOUNTING',
      name: 'Sage Business Cloud Accounting',
      fields: [
        { key: 'businessId', label: 'Sage İşletme Kimliği (Business ID)', type: 'text', required: true, description: 'Sage panelinizdeki işletme ID değeri veya GET /businesses çıktısı.' },
        { key: 'defaultLedgerAccountId', label: 'Varsayılan Gelir Defteri Hesabı (Ledger Account ID)', type: 'text', required: false, description: 'Fatura satırlarında kullanılacak nominal gelir hesabı (ör. 4000).' },
        { key: 'defaultTaxRateId', label: 'Varsayılan Vergi Oranı (Tax Rate ID)', type: 'text', required: false, description: 'Fatura satırlarında geçerli Sage vergi oranı (ör. GB_STANDARD).' },
        { key: 'clientId', label: 'Özel Client ID (İsteğe Bağlı)', type: 'text', required: false, description: 'Özel Sage Developer uygulamanız varsa girin; boşsa merkezi KroptOS uygulaması kullanılır.' },
        { key: 'clientSecret', label: 'Özel Client Secret (İsteğe Bağlı)', type: 'password', required: false, secret: true, description: 'Özel uygulamanızın istemci gizli anahtarı.' },
      ],
    },
    capabilities: { stockSync: 'NOT_SUPPORTED', salesInvoice: 'MOCK_ONLY', multiCompany: 'MOCK_ONLY' },
    supportsMock: true,
    supportsTest: false,
    supportsProduction: false,
  },
  {
    id: 'XERO',
    displayName: 'Xero',
    country: 'NZ',
    protocol: 'rest',
    readiness: 'MOCK_READY',
    documentationStatus: 'VERIFIED',
    credentialSchema: {
      provider: 'xero',
      name: 'Xero',
      fields: [
        { key: 'tenantId', label: 'Xero Kuruluş / Tenant Kimliği (Tenant ID)', type: 'text', required: true, description: 'Xero üzerindeki bağlı organizasyon / tenant kimliği.' },
        { key: 'tenantName', label: 'Kuruluş Adı (Organization Name)', type: 'text', required: false, description: 'Bağlı organizasyonun adı.' },
        { key: 'accountCode', label: 'Satış Gelir Hesabı Kodu (Account Code)', type: 'text', required: false, description: 'Xero genel muhasebe satış hesabı kodu (varsayılan: 200).' },
        { key: 'bankAccountCode', label: 'Banka Hesabı Kodu (Bank Account Code)', type: 'text', required: false, description: 'Ödemeler için Xero banka hesap kodu (varsayılan: 090).' },
        { key: 'clientId', label: 'Özel Client ID (İsteğe Bağlı)', type: 'text', required: false, description: 'Özel Xero Developer uygulamanız varsa girin; boşsa merkezi KroptOS uygulaması kullanılır.' },
        { key: 'clientSecret', label: 'Özel Client Secret (İsteğe Bağlı)', type: 'password', required: false, secret: true, description: 'Özel uygulamanızın istemci gizli anahtarı.' },
      ],
    },
    capabilities: { stockSync: 'NOT_SUPPORTED', salesInvoice: 'MOCK_ONLY', multiCompany: 'MOCK_ONLY' },
    supportsMock: true,
    supportsTest: false,
    supportsProduction: false,
  },
  {
    id: 'QUICKBOOKS',
    displayName: 'QuickBooks Online',
    country: 'US',
    protocol: 'rest',
    readiness: 'MOCK_READY',
    documentationStatus: 'VERIFIED',
    credentialSchema: {
      provider: 'quickbooks',
      name: 'QuickBooks Online',
      fields: [
        { key: 'realmId', label: 'Company / Realm ID', type: 'text', required: true, description: 'QuickBooks Online şirket/kuruluş Realm ID kimliği.' },
        { key: 'taxCodeRef', label: 'Vergi Kodu Referansı (Tax Code Ref - İsteğe Bağlı)', type: 'text', required: false, description: 'AST devre dışı şirketler için varsayılan vergi kodu (örn: TAX veya 1).' },
        { key: 'depositAccountId', label: 'Mevduat Hesap Kodu (Deposit Account ID - İsteğe Bağlı)', type: 'text', required: false, description: 'Ödeme tahsilatları için varsayılan mevduat hesabı ID.' },
        { key: 'clientId', label: 'Özel Client ID (İsteğe Bağlı)', type: 'text', required: false, description: 'Özel Intuit Developer uygulamanız varsa girin; boşsa merkezi KroptOS uygulaması kullanılır.' },
        { key: 'clientSecret', label: 'Özel Client Secret (İsteğe Bağlı)', type: 'password', required: false, secret: true, description: 'Özel uygulamanızın istemci gizli anahtarı.' },
      ],
    },
    capabilities: { stockSync: 'NOT_SUPPORTED', salesInvoice: 'MOCK_ONLY', multiCompany: 'MOCK_ONLY' },
    supportsMock: true,
    supportsTest: false,
    supportsProduction: false,
  },
  {
    id: 'ODOO',
    displayName: 'Odoo ERP & Accounting',
    country: 'BE',
    protocol: 'rest',
    readiness: 'MOCK_READY',
    documentationStatus: 'PARTIAL',
    credentialSchema: {
      provider: 'odoo',
      name: 'Odoo ERP & Accounting',
      fields: [
        { key: 'baseUrl', label: 'Odoo Sunucu URL (Base URL)', type: 'text', required: true, description: 'Odoo sunucu adresi (örn: https://mycompany.odoo.com veya https://erp.local:8069).' },
        { key: 'database', label: 'Veritabanı Adı (Database Name)', type: 'text', required: true, description: 'Bağlanılacak Odoo veritabanı adı.' },
        { key: 'apiKey', label: 'API Anahtarı (API Key)', type: 'password', required: true, secret: true, description: 'Odoo kullanıcınızın API anahtarı (Şifre kullanımı desteklenmez).' },
        { key: 'companyId', label: 'Şirket ID (Company ID - İsteğe Bağlı)', type: 'text', required: false, description: 'Çoklu şirket ortamlarında hedef şirket numarası (örn: 1).' },
        { key: 'defaultJournalId', label: 'Varsayılan Yevmiye ID (Journal ID - İsteğe Bağlı)', type: 'text', required: false, description: 'Müşteri faturaları için satış yevmiyesi (Journal) ID.' },
        { key: 'defaultTaxId', label: 'Varsayılan Vergi ID (Tax ID - İsteğe Bağlı)', type: 'text', required: false, description: 'Fatura satırlarına atanacak varsayılan vergi ID.' },
      ],
    },
    capabilities: { stockSync: 'NOT_SUPPORTED', salesInvoice: 'MOCK_ONLY', multiCompany: 'MOCK_ONLY' },
    supportsMock: true,
    supportsTest: false,
    supportsProduction: false,
  },
  {
    id: 'DATEV',
    displayName: 'DATEV (EXTF Buchungsstapel)',
    country: 'DE',
    protocol: 'rest',
    readiness: 'MOCK_READY',
    documentationStatus: 'VERIFIED',
    credentialSchema: {
      provider: 'DATEV',
      name: 'DATEV EXTF Buchungsstapel',
      fields: [
        { key: 'beraterNummer', label: 'Berater-Nr (Danışman No: 1001-9999999)', type: 'number', required: true, defaultValue: '1001', description: 'Mali müşavirinizin (Steuerberater) DATEV danışman numarası' },
        { key: 'mandantenNummer', label: 'Mandanten-Nr (Müşteri No: 1-99999)', type: 'number', required: true, defaultValue: '1', description: 'DATEV sistemindeki müşteri / firma numaranız' },
        { key: 'wjBeginn', label: 'WJ-Beginn (Mali Yıl Başlangıcı: YYYY-MM-DD)', type: 'text', required: true, defaultValue: '2026-01-01', description: 'Mevcut mali yıl başlangıç tarihi' },
        { key: 'sachkontenLaenge', label: 'Sachkontenlänge (Hesap Uzunluğu: 4-8)', type: 'number', required: true, defaultValue: '4', description: 'Standart hesap numarası uzunluğu (Standart: 4)' },
        { key: 'kontenrahmen', label: 'Kontenrahmen (SKR03 veya SKR04)', type: 'text', required: true, defaultValue: 'SKR03', description: 'Hesap planı (SKR03 veya SKR04)' },
        { key: 'encoding', label: 'Dosya Kodlaması (WINDOWS-1252 veya UTF-8)', type: 'text', required: false, defaultValue: 'WINDOWS-1252', description: 'Karakter kodlaması' },
        { key: 'festschreibung', label: 'Festschreibung (0 = Taslak, 1 = Kilitli)', type: 'number', required: false, defaultValue: '0', description: 'Kayıt kilitleme durumu' },
      ],
    },
    capabilities: { stockSync: 'NOT_SUPPORTED', salesInvoice: 'MOCK_ONLY', multiCompany: 'MOCK_ONLY' },
    supportsMock: true,
    supportsTest: true,
    supportsProduction: true,
  },
  {
    id: 'LEXWARE-OFFICE',
    displayName: 'Lexware Office',
    country: 'DE',
    protocol: 'rest',
    readiness: 'MOCK_READY',
    documentationStatus: 'PARTIAL',
    credentialSchema: {
      provider: 'LEXWARE-OFFICE',
      name: 'Lexware Office',
      fields: [
        {
          key: 'apiKey',
          label: 'API Anahtarı (API Key)',
          type: 'password',
          required: true,
          secret: true,
          description: 'Lexware Office profilinizden oluşturulan API anahtarı.',
        },
      ],
    },
    capabilities: { stockSync: 'NOT_SUPPORTED', salesInvoice: 'MOCK_ONLY', payment: 'NOT_SUPPORTED' },
    supportsMock: true,
    supportsTest: false,
    supportsProduction: false,
  },
  {
    id: 'SEVDESK',
    displayName: 'sevDesk',
    country: 'DE',
    protocol: 'rest',
    readiness: 'MOCK_READY',
    documentationStatus: 'PARTIAL',
    credentialSchema: {
      provider: 'sevdesk',
      name: 'sevDesk',
      fields: [
        {
          key: 'apiToken',
          label: 'API Belirteci (API Token)',
          type: 'password',
          required: true,
          secret: true,
          description:
            'sevDesk web panelinizde Ayarlar > Kullanıcı Yönetimi (Einstellungen > Benutzer) bölümünden aldığınız 32 haneli kullanıcı API token.',
        },
      ],
    },
    capabilities: { stockSync: 'NOT_SUPPORTED', salesInvoice: 'MOCK_ONLY', payment: 'MOCK_ONLY' },
    supportsMock: true,
    supportsTest: false,
    supportsProduction: false,
  },
  {
    id: 'FREEAGENT',
    displayName: 'FreeAgent',
    country: 'GB',
    protocol: 'rest',
    readiness: 'MOCK_READY',
    documentationStatus: 'PARTIAL',
    credentialSchema: {
      provider: 'freeagent',
      name: 'FreeAgent',
      fields: [
        {
          key: 'defaultCategoryUrl',
          label: 'Varsayılan Gelir Kategorisi URI (Default Category URI)',
          type: 'text',
          required: false,
          description: 'FreeAgent muhasebe gelir kategorisi URI adresi.',
        },
        {
          key: 'bankAccountUrl',
          label: 'Banka Hesabı URI (Bank Account URI)',
          type: 'text',
          required: false,
          description: 'Tahsilat açıklamaları için banka hesabı URI adresi.',
        },
        {
          key: 'clientId',
          label: 'Özel İstemci Kimliği (Client ID - İsteğe Bağlı)',
          type: 'text',
          required: false,
          description: 'Özel FreeAgent uygulamanız varsa girin; boşsa merkezi KroptOS uygulaması kullanılır.',
        },
        {
          key: 'clientSecret',
          label: 'Özel İstemci Gizli Anahtarı (Client Secret - İsteğe Bağlı)',
          type: 'password',
          required: false,
          secret: true,
          description: 'Özel FreeAgent uygulamanızın istemci parolası.',
        },
      ],
    },
    capabilities: { stockSync: 'NOT_SUPPORTED', salesInvoice: 'MOCK_ONLY', payment: 'MOCK_ONLY' },
    supportsMock: true,
    supportsTest: false,
    supportsProduction: false,
  },
  {
    id: 'EXACT-ONLINE',
    displayName: 'Exact Online',
    country: 'NL',
    protocol: 'odata',
    readiness: 'MOCK_READY',
    documentationStatus: 'PARTIAL',
    credentialSchema: {
      provider: 'exact-online',
      name: 'Exact Online',
      fields: [
        {
          key: 'country',
          label: 'Ülke / Bölge (Country)',
          type: 'text',
          required: false,
          defaultValue: 'NL',
          description: 'Exact Online bölgesi: "NL" (Hollanda), "BE" (Belçika), "DE", "UK", "US", "ES".',
        },
        {
          key: 'division',
          label: 'Şirket / Bölüm Kodu (Division)',
          type: 'text',
          required: false,
          description: 'İşlem yapılacak Exact Online division/şirket numarası (sayısal).',
        },
        {
          key: 'journalCode',
          label: 'Satış Günlüğü Kodu (Journal Code)',
          type: 'text',
          required: false,
          defaultValue: '70',
          description: 'Exact Online satış günlüğü kodu (örn: 70).',
        },
        {
          key: 'clientId',
          label: 'Client ID (Uygulama Kimliği)',
          type: 'text',
          required: false,
          description: 'Exact Online App Center istemci kimliği.',
        },
        {
          key: 'clientSecret',
          label: 'Client Secret (Gizli Anahtar)',
          type: 'password',
          required: false,
          secret: true,
          description: 'Exact Online App Center istemci gizli anahtarı.',
        },
      ],
    },
    capabilities: { stockSync: 'NOT_SUPPORTED', salesInvoice: 'MOCK_ONLY', payment: 'MOCK_ONLY' },
    supportsMock: true,
    supportsTest: false,
    supportsProduction: false,
  },
  {
    id: 'VISMA-NET-ERP',
    displayName: 'Visma.net ERP',
    country: 'NO',
    protocol: 'rest',
    readiness: 'MOCK_READY',
    documentationStatus: 'PARTIAL',
    credentialSchema: {
      provider: 'visma-net-erp',
      name: 'Visma.net ERP',
      fields: [
        {
          key: 'ippCompanyId',
          label: 'Şirket Tanımlayıcısı (ipp-company-id)',
          type: 'text',
          required: true,
          description: 'Visma.net ERP şirket kimlik numarası (örn: 1113659).',
        },
        {
          key: 'clientId',
          label: 'Client ID (Visma Developer Portal)',
          type: 'text',
          required: false,
          description: 'Visma Developer Portal üzerinde kayıtlı uygulama istemci kimliği.',
        },
        {
          key: 'clientSecret',
          label: 'Client Secret (Gizli Anahtar)',
          type: 'password',
          required: false,
          secret: true,
          description: 'Visma Developer Portal uygulama gizli anahtarı.',
        },
        {
          key: 'incomeAccount',
          label: 'Gelir Hesabı Kodu (Account Number)',
          type: 'text',
          required: false,
          description: 'Fatura satırlarında kullanılacak işletme hesap planı gelir kodu (örn: 3000).',
        },
        {
          key: 'vatCodeId',
          label: 'KDV / Vergi Kodu (VAT Code ID)',
          type: 'text',
          required: false,
          description: 'Nordics/AB vergi kodu (örn: 25, 15, 0).',
        },
        {
          key: 'branchNumber',
          label: 'Şube Numarası (Branch Number)',
          type: 'text',
          required: false,
          description: 'Çok şubeli işletmeler için Visma.net ERP şube kodu.',
        },
      ],
    },
    capabilities: { stockSync: 'NOT_SUPPORTED', salesInvoice: 'MOCK_ONLY', payment: 'MOCK_ONLY' },
    supportsMock: true,
    supportsTest: false,
    supportsProduction: false,
  },
  {
    id: 'FORTNOX',
    displayName: 'Fortnox',
    country: 'SE',
    protocol: 'rest',
    readiness: 'MOCK_READY',
    documentationStatus: 'PARTIAL',
    credentialSchema: {
      provider: 'fortnox',
      name: 'Fortnox',
      fields: [
        {
          key: 'clientId',
          label: 'Client ID (Fortnox Developer Portal)',
          type: 'text',
          required: true,
          description: 'Fortnox Developer Portal üzerinde oluşturulan uygulamanın Client ID değeri.',
        },
        {
          key: 'clientSecret',
          label: 'Client Secret (Gizli Anahtar)',
          type: 'password',
          required: true,
          secret: true,
          description: 'Fortnox Developer Portal üzerinde verilen Client Secret anahtarı.',
        },
        {
          key: 'redirectUri',
          label: 'Redirect URI (Geri Dönüş URL)',
          type: 'text',
          required: true,
          description: 'OAuth 2.0 yetkilendirme geri dönüş adresi.',
        },
        {
          key: 'defaultSalesAccount',
          label: 'Varsayılan Satış Hesabı (Sales Account)',
          type: 'text',
          required: false,
          description: 'İsveç BAS hesap planı gelir hesabı (varsayılan: 3001).',
        },
        {
          key: 'defaultVATRate',
          label: 'Varsayılan KDV Oranı (%)',
          type: 'text',
          required: false,
          description: 'Varsayılan İsveç KDV oranı (örn: 25).',
        },
      ],
    },
    capabilities: { stockSync: 'NOT_SUPPORTED', salesInvoice: 'MOCK_ONLY' },
    supportsMock: true,
    supportsTest: false,
    supportsProduction: false,
  },
  {
    id: 'NETSUITE',
    displayName: 'Oracle NetSuite',
    country: 'US',
    protocol: 'rest',
    readiness: 'MOCK_READY',
    documentationStatus: 'PARTIAL',
    credentialSchema: {
      provider: 'netsuite',
      name: 'Oracle NetSuite',
      fields: [
        {
          key: 'accountId',
          label: 'NetSuite Hesap Kimliği (Account ID)',
          type: 'text',
          required: true,
          description: 'NetSuite hesap numaranız (örn: "1234567" veya Sandbox için "1234567_SB1").',
        },
        {
          key: 'clientId',
          label: 'İstemci Kimliği (Client ID / Consumer Key)',
          type: 'text',
          required: true,
          description: 'OAuth 2.0 Entegrasyon kaydındaki Consumer Key değeri.',
        },
        {
          key: 'certificateId',
          label: 'Sertifika Kimliği (Certificate ID / kid)',
          type: 'text',
          required: true,
          description: 'OAuth 2.0 Client Credentials kurulumunda sertifikaya atanan kid kimliği.',
        },
        {
          key: 'keyReference',
          label: 'Özel Anahtar Referansı (Key Reference)',
          type: 'text',
          required: true,
          description: 'Sunucu ortamında/KMS\'te saklanan RSA özel anahtarının ortam değişkeni adı (örn: "NETSUITE_PRIVATE_KEY"). Özel anahtar formdan girilmez.',
        },
        {
          key: 'subsidiaryId',
          label: 'Subsidiary ID (OneWorld)',
          type: 'text',
          required: false,
          description: 'OneWorld hesaplarında kayıtların bağlanacağı iştirak/subsidiary dahili numarası (§5.9).',
        },
        {
          key: 'certificateExpiresAt',
          label: 'Sertifika Bitiş Tarihi (YYYY-MM-DD)',
          type: 'text',
          required: false,
          description: 'Yüklenen açık anahtar sertifikasının son geçerlilik tarihi (30 ve 7 gün kala uyarı verilir).',
        },
        {
          key: 'concurrencyLimit',
          label: 'Eşzamanlı İstek Limiti (Varsayılan: 1)',
          type: 'number',
          required: false,
          description: 'Hesap genelindeki eşzamanlılık havuzundan bu bağlantı için ayrılan tavan.',
        },
      ],
    },
    capabilities: { stockSync: 'NOT_SUPPORTED', salesInvoice: 'MOCK_ONLY' },
    supportsMock: true,
    supportsTest: false,
    supportsProduction: false,
  },
  {
    id: 'FATTURE-IN-CLOUD',
    displayName: 'Fatture in Cloud (TeamSystem)',
    country: 'IT',
    protocol: 'rest',
    readiness: 'MOCK_READY',
    documentationStatus: 'PARTIAL',
    credentialSchema: {
      provider: 'fatture-in-cloud',
      name: 'Fatture in Cloud (TeamSystem)',
      fields: [
        {
          key: 'companyId',
          label: 'Fatture in Cloud Şirket Kimliği (Company ID)',
          type: 'text',
          required: true,
          description: 'Fatture in Cloud firma ID değeri (GET /user/companies ile listelenir). Tüm çağrılar /c/{company_id}/ altına kapsamlanır.',
        },
        {
          key: 'paymentAccountId',
          label: 'Varsayılan Ödeme / Kasa-Banka Hesabı ID (Payment Account ID)',
          type: 'text',
          required: false,
          description: 'Tahsil edilmiş ("paid") faturalar için zorunlu kasa/banka hesap ID değeri (§5.6).',
        },
        {
          key: 'useGrossPrices',
          label: 'Fiyatları Brüt Olarak Gönder (use_gross_prices)',
          type: 'select',
          required: false,
          defaultValue: 'false',
          description: 'Kalem fiyatlarının net mi brüt mü iletileceğini belirler (§5.4). Varsayılan: false (net fiyat).',
        },
        {
          key: 'defaultVatId',
          label: 'Varsayılan FIC KDV ID (Default VAT ID)',
          type: 'text',
          required: false,
          defaultValue: '0',
          description: 'Fatture in Cloud üzerindeki standart KDV oranı ID değeri (örn. %22 standart KDV için).',
        },
        {
          key: 'clientId',
          label: 'Özel İstemci Kimliği (Client ID - İsteğe Bağlı)',
          type: 'text',
          required: false,
          description: 'Özel FIC Developer uygulamanız varsa girin; boşsa merkezi KroptOS OAuth uygulaması kullanılır.',
        },
        {
          key: 'clientSecret',
          label: 'Özel İstemci Gizli Anahtarı (Client Secret - İsteğe Bağlı)',
          type: 'password',
          required: false,
          secret: true,
          description: 'Özel FIC Developer uygulamanızın istemci parolası.',
        },
      ],
    },
    capabilities: { stockSync: 'NOT_SUPPORTED', salesInvoice: 'MOCK_ONLY' },
    supportsMock: true,
    supportsTest: false,
    supportsProduction: false,
  },
  {
    id: 'CEGID-XRP-FLEX',
    displayName: 'Cegid XRP Flex',
    country: 'FR',
    protocol: 'rest',
    readiness: 'MOCK_READY',
    documentationStatus: 'PARTIAL',
    credentialSchema: {
      provider: 'cegid-xrp-flex',
      name: 'Cegid XRP Flex',
      fields: [
        {
          key: 'instanceUrl',
          label: 'Cegid XRP Flex Örnek URL (Instance URL)',
          type: 'text',
          required: true,
          description: 'Cegid XRP Flex bulut örneğinizin temel adresi (örn. https://acme.cegid.cloud).',
        },
        {
          key: 'clientId',
          label: 'OAuth 2.0 İstemci Kimliği (Client ID)',
          type: 'text',
          required: true,
          description: 'Cegid XRP Flex OAuth 2.0 Connected Application istemci kimliği.',
        },
        {
          key: 'clientSecret',
          label: 'OAuth 2.0 İstemci Parolası (Client Secret)',
          type: 'password',
          required: true,
          secret: true,
          description: 'Cegid XRP Flex OAuth 2.0 Connected Application gizli anahtarı.',
        },
        {
          key: 'username',
          label: 'Kullanıcı Adı (Username)',
          type: 'text',
          required: true,
          description: 'API erişim yetkisine sahip Cegid XRP Flex ERP kullanıcı adı.',
        },
        {
          key: 'password',
          label: 'Kullanıcı Parolası (Password)',
          type: 'password',
          required: true,
          secret: true,
          description: 'Cegid XRP Flex kullanıcısının parolası.',
        },
        {
          key: 'defaultIncomeAccount',
          label: 'Varsayılan Gelir / Satış Hesabı Kodu (Compte de Ventes - 707xxx)',
          type: 'text',
          required: true,
          defaultValue: '707000',
          description: 'Fransız Tekdüzen Hesap Planı (PCG) satış hesabı kodu. Mali müşavirinizden temin ediniz.',
        },
        {
          key: 'defaultVatCode',
          label: 'Varsayılan KDV / Vergi Kodu (Code Taxe / TVA)',
          type: 'text',
          required: true,
          defaultValue: 'TVA20',
          description: 'Cegid XRP Flex sisteminde tanımlı vergi kodu (örn. TVA20). Mali müşavirinizden teyit ediniz.',
        },
        {
          key: 'branchId',
          label: 'Şube Kodu (Branch ID - İsteğe Bağlı)',
          type: 'text',
          required: false,
          description: 'Çok şubeli kurulumlar için PX-Branch başlığında iletilecek şube kodu.',
        },
        {
          key: 'endpointName',
          label: 'Uç Nokta Adı (Endpoint Name - İsteğe Bağlı)',
          type: 'text',
          required: false,
          defaultValue: 'Default',
          description: 'Acumatica sözleşme uç noktası adı. Varsayılan: Default.',
        },
        {
          key: 'endpointVersion',
          label: 'Uç Nokta Sürümü (Endpoint Version - İsteğe Bağlı)',
          type: 'text',
          required: false,
          defaultValue: '20.200.001',
          description: 'Acumatica sözleşme sürümü. Varsayılan: 20.200.001.',
        },
      ],
    },
    capabilities: { stockSync: 'NOT_SUPPORTED', salesInvoice: 'MOCK_ONLY' },
    supportsMock: true,
    supportsTest: false,
    supportsProduction: false,
  },
  {
    id: 'PENNYLANE',
    displayName: 'Pennylane',
    country: 'FR',
    protocol: 'rest',
    readiness: 'MOCK_READY',
    documentationStatus: 'VERIFIED',
    credentialSchema: {
      provider: 'pennylane',
      name: 'Pennylane',
      fields: [
        {
          key: 'apiToken',
          label: 'API Belirteci (API Token)',
          type: 'password',
          required: true,
          secret: true,
          description: 'Pennylane Ayarlar > Geliştirici sayfasından üretilen API v2 belirteci.',
        },
        {
          key: 'baseUrl',
          label: 'API Taban URL (Base URL)',
          type: 'text',
          required: false,
          defaultValue: 'https://app.pennylane.com/api/external/v2/',
          description: 'Pennylane API v2 ana adresi (Yalnızca API v2 desteklenir).',
        },
        {
          key: 'companyId',
          label: 'Şirket Kimliği (Company ID - İsteğe Bağlı)',
          type: 'text',
          required: false,
          description: 'Çoklu şirket hesapları için hedef şirket kimliği.',
        },
        {
          key: 'defaultVatRate',
          label: 'Varsayılan KDV Kodu (Default VAT Rate)',
          type: 'text',
          required: false,
          defaultValue: 'FR_200',
          description: 'Fransız KDV oranı kodu (FR_200: %20 standart, FR_100: %10, FR_055: %5.5, FR_021: %2.1, exempt: İstisna).',
        },
      ],
    },
    capabilities: { stockSync: 'NOT_SUPPORTED', salesInvoice: 'MOCK_ONLY' },
    supportsMock: true,
    supportsTest: false,
    supportsProduction: false,
  },
  {
    id: 'LOGO-REST',
    displayName: 'Logo Tiger REST Servis',
    country: 'TR',
    protocol: 'rest',
    readiness: 'MOCK_READY',
    documentationStatus: 'PARTIAL',
    credentialSchema: {
      provider: 'logo-rest',
      name: 'Logo Tiger REST Servis',
      fields: [
        { key: 'baseUrl', label: 'REST Servis Adresi', type: 'url', required: true, description: 'Logo REST Servisinin çalıştığı sunucu (örn. http://10.0.0.5:32001). Varsayılan port 32001.' },
        { key: 'clientId', label: 'Client ID', type: 'text', required: true, description: 'Logo Çözüm Ortağı üzerinden verilen istemci kimliği.' },
        { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true, secret: true, description: 'Logo Çözüm Ortağı üzerinden verilen istemci sırrı.' },
        { key: 'username', label: 'Logo Kullanıcı Adı', type: 'text', required: true },
        { key: 'password', label: 'Logo Şifresi', type: 'password', required: true, secret: true },
        { key: 'companyId', label: 'Firma Numarası (firmno)', type: 'text', required: true, defaultValue: '1', description: 'Token bu firmaya kilitlenir; her firma için ayrı bağlantı/oturum tutulur.' },
        { key: 'periodNo', label: 'Dönem Numarası', type: 'text', required: false, description: 'Boş bırakılırsa aktif dönem.' },
      ],
    },
    capabilities: { stockSync: 'NOT_SUPPORTED', salesInvoice: 'MOCK_ONLY' },
    supportsMock: true,
    supportsTest: false,
    supportsProduction: false,
  },
  {
    id: 'LOGO-OBJECTS',
    displayName: 'Logo GO3 (Logo Objects)',
    country: 'TR',
    protocol: 'custom',
    readiness: 'MOCK_READY',
    documentationStatus: 'DOCUMENTATION_REQUIRED',
    credentialSchema: {
      provider: 'logo-objects',
      name: 'Logo GO3 (Logo Objects)',
      fields: [
        { key: 'username', label: 'Logo Kullanıcı Adı', type: 'text', required: true },
        { key: 'password', label: 'Logo Şifresi', type: 'password', required: true, secret: true },
        { key: 'companyId', label: 'Firma Numarası', type: 'text', required: true, defaultValue: '1', description: 'Login çağrısındaki firma numarası; oturum bu firmaya kilitlenir.' },
        { key: 'periodNo', label: 'Dönem Numarası', type: 'text', required: true, defaultValue: '0', description: '0 = aktif dönem.' },
      ],
    },
    capabilities: { stockSync: 'NOT_SUPPORTED', salesInvoice: 'MOCK_ONLY' },
    supportsMock: true,
    supportsTest: false,
    supportsProduction: false,
  },
];

const PROVIDER_THEMES: Record<string, { bg: string; text: string; badge: string; iconLetter: string }> = {
  'LOGO-OBJECTS': {
    bg: 'bg-indigo-600/10 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 border border-indigo-500/20',
    text: 'text-indigo-700 dark:text-indigo-300',
    badge: 'Logo Objects (GO3)',
    iconLetter: 'G',
  },
  'LOGO-REST': {
    bg: 'bg-sky-600/10 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300 border border-sky-500/20',
    text: 'text-sky-700 dark:text-sky-300',
    badge: 'Logo ERP',
    iconLetter: 'L',
  },
  PENNYLANE: {
    bg: 'bg-teal-600/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-300 border border-teal-500/20',
    text: 'text-teal-600 dark:text-teal-300',
    badge: 'Pennylane (FR)',
    iconLetter: 'P',
  },
  'CEGID-XRP-FLEX': {
    bg: 'bg-violet-600/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300 border border-violet-500/20',
    text: 'text-violet-600 dark:text-violet-300',
    badge: 'Cegid ERP (FR)',
    iconLetter: 'C',
  },
  'FATTURE-IN-CLOUD': {
    bg: 'bg-sky-600/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-300 border border-sky-500/20',
    text: 'text-sky-600 dark:text-sky-300',
    badge: 'TeamSystem FIC',
    iconLetter: 'F',
  },
  NETSUITE: {
    bg: 'bg-blue-700/10 text-blue-700 dark:bg-blue-600/20 dark:text-blue-300 border border-blue-600/20',
    text: 'text-blue-700 dark:text-blue-300',
    badge: 'NetSuite ERP',
    iconLetter: 'N',
  },
  DATEV: {
    bg: 'bg-emerald-600/10 text-emerald-600 dark:bg-emerald-600/20 dark:text-emerald-400 border border-emerald-600/20',
    text: 'text-emerald-600 dark:text-emerald-400',
    badge: 'DATEV DE',
    iconLetter: 'D',
  },
  PARASUT: {
    bg: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/20',
    text: 'text-emerald-600 dark:text-emerald-400',
    badge: 'Paraşüt E-Fatura',
    iconLetter: 'P',
  },
  KOLAYBI: {
    bg: 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 border border-indigo-500/20',
    text: 'text-indigo-600 dark:text-indigo-400',
    badge: "KolayBi'",
    iconLetter: 'K',
  },
  BIZIMHESAP: {
    bg: 'bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400 border border-teal-500/20',
    text: 'text-teal-600 dark:text-teal-400',
    badge: 'BizimHesap',
    iconLetter: 'B',
  },
  SAP_S4HANA_CLOUD: {
    bg: 'bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-500/20',
    text: 'text-blue-600 dark:text-blue-400',
    badge: 'SAP S/4HANA Cloud',
    iconLetter: 'S',
  },
  MS_DYNAMICS_BC_ONLINE: {
    bg: 'bg-cyan-600/10 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400 border border-cyan-500/20',
    text: 'text-cyan-600 dark:text-cyan-400',
    badge: 'Dynamics 365 BC',
    iconLetter: 'D',
  },
  'SAGE-ACCOUNTING': {
    bg: 'bg-emerald-600/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/20',
    text: 'text-emerald-600 dark:text-emerald-400',
    badge: 'Sage Business Cloud',
    iconLetter: 'S',
  },
  XERO: {
    bg: 'bg-sky-500/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400 border border-sky-500/20',
    text: 'text-sky-600 dark:text-sky-400',
    badge: 'Xero Accounting',
    iconLetter: 'X',
  },
  QUICKBOOKS: {
    bg: 'bg-emerald-700/10 text-emerald-700 dark:bg-emerald-600/20 dark:text-emerald-400 border border-emerald-600/20',
    text: 'text-emerald-700 dark:text-emerald-400',
    badge: 'QuickBooks Online',
    iconLetter: 'Q',
  },
  ODOO: {
    bg: 'bg-purple-600/10 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 border border-purple-500/20',
    text: 'text-purple-700 dark:text-purple-300',
    badge: 'Odoo ERP',
    iconLetter: 'O',
  },
  'LEXWARE-OFFICE': {
    bg: 'bg-amber-600/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/20',
    text: 'text-amber-600 dark:text-amber-400',
    badge: 'Lexware Office',
    iconLetter: 'L',
  },
  SEVDESK: {
    bg: 'bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-500/20',
    text: 'text-blue-600 dark:text-blue-400',
    badge: 'sevDesk DACH',
    iconLetter: 'S',
  },
  FREEAGENT: {
    bg: 'bg-indigo-600/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 border border-indigo-500/20',
    text: 'text-indigo-600 dark:text-indigo-400',
    badge: 'FreeAgent UK',
    iconLetter: 'F',
  },
  'EXACT-ONLINE': {
    bg: 'bg-red-600/10 text-red-600 dark:bg-red-500/20 dark:text-red-400 border border-red-500/20',
    text: 'text-red-600 dark:text-red-400',
    badge: 'Exact NL/BE',
    iconLetter: 'E',
  },
  'VISMA-NET-ERP': {
    bg: 'bg-red-600/10 text-red-600 dark:bg-red-500/20 dark:text-red-400 border border-red-500/20',
    text: 'text-red-600 dark:text-red-400',
    badge: 'Visma.net ERP',
    iconLetter: 'V',
  },
  FORTNOX: {
    bg: 'bg-emerald-700/10 text-emerald-700 dark:bg-emerald-600/20 dark:text-emerald-300 border border-emerald-600/20',
    text: 'text-emerald-700 dark:text-emerald-300',
    badge: 'Fortnox (İsveç)',
    iconLetter: 'F',
  },
};

interface AddAccountingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingIntegration?: AccountingIntegrationItem | null;
  initialProviderId?: string;
}

export default function AddAccountingModal({
  isOpen,
  onClose,
  onSuccess,
  editingIntegration,
  initialProviderId,
}: AddAccountingModalProps) {
  const t = useTranslations('accounting');
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resolveProviderId = (id?: string | null): string => {
    if (!id) return 'PARASUT';
    const lower = id.toLowerCase().replace(/[-_]/g, '');
    if (lower.includes('sap')) return 'SAP_S4HANA_CLOUD';
    if (
      lower.includes('dynamics') ||
      lower.includes('msdynamics') ||
      lower === 'msbc' ||
      lower.includes('businesscentral')
    )
      return 'MS_DYNAMICS_BC_ONLINE';
    if (lower.includes('sage')) return 'SAGE-ACCOUNTING';
    if (lower.includes('xero')) return 'XERO';
    if (lower.includes('quickbooks') || lower.includes('qbo')) return 'QUICKBOOKS';
    if (lower.includes('odoo')) return 'ODOO';
    if (lower.includes('lexware')) return 'LEXWARE-OFFICE';
    if (lower.includes('sevdesk')) return 'SEVDESK';
    if (lower.includes('freeagent')) return 'FREEAGENT';
    if (lower.includes('exact')) return 'EXACT-ONLINE';
    if (lower.includes('visma')) return 'VISMA-NET-ERP';
    if (lower.includes('fortnox')) return 'FORTNOX';
    if (lower.includes('netsuite')) return 'NETSUITE';
    if (lower.includes('fatture') || lower.includes('fic')) return 'FATTURE-IN-CLOUD';
    if (lower.includes('cegid')) return 'CEGID-XRP-FLEX';
    if (lower.includes('pennylane')) return 'PENNYLANE';
    if (lower.includes('logoobjects') || lower.includes('go3')) return 'LOGO-OBJECTS';
    if (lower.includes('logo')) return 'LOGO-REST';
    if (lower.includes('datev')) return 'DATEV';
    if (lower.includes('kolaybi')) return 'KOLAYBI';
    if (lower.includes('bizimhesap')) return 'BIZIMHESAP';
    if (lower.includes('parasut')) return 'PARASUT';

    const match = DEFAULT_PROVIDERS.find(
      (p) => p.id.toLowerCase().replace(/[-_]/g, '') === lower,
    );
    return match ? match.id : id.toUpperCase();
  };

  const [providers, setProviders] = useState<AccountingProviderInfo[]>(DEFAULT_PROVIDERS);
  const [selectedProviderId, setSelectedProviderId] = useState<string>(() => {
    if (editingIntegration?.provider) return resolveProviderId(editingIntegration.provider);
    if (initialProviderId) return resolveProviderId(initialProviderId);
    return 'PARASUT';
  });

  const [name, setName] = useState<string>(() => {
    if (editingIntegration?.name) return editingIntegration.name;
    const pid = initialProviderId ? resolveProviderId(initialProviderId) : 'PARASUT';
    const match =
      DEFAULT_PROVIDERS.find((p) => resolveProviderId(p.id) === pid) ||
      DEFAULT_PROVIDERS.find((p) => p.id === pid);
    return match ? `${match.displayName} Muhasebe` : 'Muhasebe Entegrasyonu';
  });

  const [environment, setEnvironment] = useState<'MOCK' | 'TEST' | 'PRODUCTION'>(
    editingIntegration?.environment || 'MOCK',
  );
  const [credentials, setCredentials] = useState<Record<string, string>>(
    (editingIntegration?.credentials as Record<string, string>) || {},
  );

  useEffect(() => {
    if (isOpen) {
      if (editingIntegration) {
        const resolved = resolveProviderId(editingIntegration.provider);
        setSelectedProviderId(resolved);
        setName(editingIntegration.name);
        setEnvironment(editingIntegration.environment || 'MOCK');
        setCredentials((editingIntegration.credentials as Record<string, string>) || {});
      } else if (initialProviderId) {
        const resolved = resolveProviderId(initialProviderId);
        setSelectedProviderId(resolved);
        const match =
          DEFAULT_PROVIDERS.find((p) => resolveProviderId(p.id) === resolved) ||
          DEFAULT_PROVIDERS.find((p) => p.id === resolved);
        setName(match ? `${match.displayName} Muhasebe` : 'Muhasebe Entegrasyonu');
        setEnvironment('MOCK');
        setCredentials({});
      }
    }
  }, [isOpen, initialProviderId, editingIntegration]);

  const [isStartingOAuth, setIsStartingOAuth] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveredBusinesses, setDiscoveredBusinesses] = useState<any[]>([]);
  const [discoveredAccounts, setDiscoveredAccounts] = useState<any[]>([]);
  const [discoveredTaxRates, setDiscoveredTaxRates] = useState<any[]>([]);

  // Dynamics 365 discovery state
  const [isDiscoveringDynamics, setIsDiscoveringDynamics] = useState(false);
  const [discoveredDynamicsCompanies, setDiscoveredDynamicsCompanies] = useState<any[]>([]);

  const resolvedProviderKey = resolveProviderId(selectedProviderId);

  const activeProvider =
    providers.find((p) => resolveProviderId(p.id) === resolvedProviderKey) ||
    DEFAULT_PROVIDERS.find((p) => resolveProviderId(p.id) === resolvedProviderKey) ||
    providers.find((p) => p.id.toUpperCase() === selectedProviderId.toUpperCase()) ||
    DEFAULT_PROVIDERS.find((p) => p.id.toUpperCase() === selectedProviderId.toUpperCase()) ||
    DEFAULT_PROVIDERS[0];

  const isDynamics = resolvedProviderKey === 'MS_DYNAMICS_BC_ONLINE';
  const isSage = resolvedProviderKey === 'SAGE-ACCOUNTING';
  const isXero = resolvedProviderKey === 'XERO';
  const isQuickBooks = resolvedProviderKey === 'QUICKBOOKS';
  const isOdoo = resolvedProviderKey === 'ODOO';
  const isSap = resolvedProviderKey === 'SAP_S4HANA_CLOUD';
  const isLexware = resolvedProviderKey === 'LEXWARE-OFFICE';
  const isFortnox = resolvedProviderKey === 'FORTNOX';
  const isNetSuite = resolvedProviderKey === 'NETSUITE';
  const isFattureInCloud = resolvedProviderKey === 'FATTURE-IN-CLOUD';
  const isCegid = resolvedProviderKey === 'CEGID-XRP-FLEX';
  const isPennylane = resolvedProviderKey === 'PENNYLANE';
  const isLogoRest = resolvedProviderKey === 'LOGO-REST';
  const isLogoObjects = resolvedProviderKey === 'LOGO-OBJECTS';

  const certExpiryDays = useMemo(() => {
    if (!isNetSuite || !credentials.certificateExpiresAt) return null;
    const diff = new Date(credentials.certificateExpiresAt).getTime() - Date.now();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }, [isNetSuite, credentials.certificateExpiresAt]);

  const isReauthRequired =
    (isSage || isXero || isQuickBooks) &&
    ((editingIntegration?.status as string) === 'failed' ||
      (editingIntegration?.status === 'error' &&
        (editingIntegration?.lastErrorMessage?.includes('REAUTHORIZATION_REQUIRED') ||
          editingIntegration?.lastErrorMessage?.includes('invalid_grant'))));

  const handleStartOAuth = async () => {
    if (!editingIntegration?.id) {
      toast.error('OAuth başlatmak için lütfen önce entegrasyonu kaydedin.');
      return;
    }
    setIsStartingOAuth(true);
    try {
      const redirectUri = window.location.origin + '/api/accounting/oauth/callback';
      const res = await api.post<{ authorizationUrl: string }>(
        `/accounting/integrations/${editingIntegration.id}/oauth/start`,
        { redirectUri },
      );
      if (res?.authorizationUrl) {
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        const popupName = isXero ? 'XeroOAuth' : isQuickBooks ? 'QBOOAuth' : 'SageOAuth';
        const providerName = isXero ? 'Xero' : isQuickBooks ? 'QuickBooks Online' : 'Sage';
        const popup = window.open(
          res.authorizationUrl,
          popupName,
          `width=${width},height=${height},top=${top},left=${left}`,
        );

        const onMessage = (event: MessageEvent) => {
          if (event.data?.type === 'ACCOUNTING_OAUTH_RESULT') {
            window.removeEventListener('message', onMessage);
            if (event.data.success) {
              toast.success(`${providerName} OAuth yetkilendirmesi başarıyla tamamlandı!`);
              onSuccess();
            } else {
              toast.error(event.data.message || 'Yetkilendirme başarısız oldu.');
            }
          }
        };
        window.addEventListener('message', onMessage);
      }
    } catch (err: any) {
      toast.error(err.message || 'OAuth yönlendirmesi başlatılamadı.');
    } finally {
      setIsStartingOAuth(false);
    }
  };

  const handleDiscoverConfig = async () => {
    if (!editingIntegration?.id) {
      toast.error('Yapılandırma keşfi için önce entegrasyonu kaydedin.');
      return;
    }
    setIsDiscovering(true);
    try {
      const [bizs, accs, taxes] = await Promise.all([
        api.get<any[]>(`/accounting/integrations/${editingIntegration.id}/businesses`).catch(() => []),
        api.get<any[]>(`/accounting/integrations/${editingIntegration.id}/ledger-accounts`).catch(() => []),
        api.get<any[]>(`/accounting/integrations/${editingIntegration.id}/tax-rates`).catch(() => []),
      ]);
      setDiscoveredBusinesses(bizs || []);
      setDiscoveredAccounts(accs || []);
      setDiscoveredTaxRates(taxes || []);
      toast.success('Sage yapılandırma seçenekleri güncellendi.');
    } catch (err: any) {
      toast.error(err.message || 'Yapılandırma verileri çekilemedi.');
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleDiscoverDynamicsCompanies = async () => {
    if (!editingIntegration?.id) {
      toast.error('Şirket listesini çekmek için önce entegrasyonu kaydedin.');
      return;
    }
    setIsDiscoveringDynamics(true);
    try {
      const companies = await api.get<any[]>(`/accounting/integrations/${editingIntegration.id}/businesses`);
      setDiscoveredDynamicsCompanies(companies || []);
      toast.success('Business Central şirketleri listelendi.');
    } catch (err: any) {
      toast.error(err.message || 'Şirket listesi alınamadı.');
    } finally {
      setIsDiscoveringDynamics(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    api
      .get<AccountingProviderInfo[]>('/accounting/providers')
      .then((res) => {
        if (Array.isArray(res) && res.length > 0) {
          setProviders(() => {
            const merged = [...DEFAULT_PROVIDERS];
            for (const item of res) {
              const idx = merged.findIndex(
                (m) =>
                  m.id.toUpperCase() === item.id.toUpperCase() ||
                  resolveProviderId(m.id) === resolveProviderId(item.id),
              );
              if (idx >= 0) {
                merged[idx] = { ...merged[idx], ...item };
              } else {
                merged.push(item);
              }
            }
            return merged;
          });
        }
      })
      .catch(() => {
        // keep fallback DEFAULT_PROVIDERS
      });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    if (editingIntegration) {
      const pid = resolveProviderId(editingIntegration.provider);
      setSelectedProviderId(pid);
      setName(editingIntegration.name);
      setEnvironment(editingIntegration.environment);
      setCredentials((editingIntegration.credentials as Record<string, string>) || {});
    } else if (initialProviderId) {
      const pid = resolveProviderId(initialProviderId);
      setSelectedProviderId(pid);
      const match =
        DEFAULT_PROVIDERS.find((p) => resolveProviderId(p.id) === pid) ||
        providers.find((p) => resolveProviderId(p.id) === pid);
      if (match) {
        setName(`${match.displayName} Muhasebe`);
        const defaultCreds: Record<string, string> = {};
        match.credentialSchema?.fields?.forEach((f) => {
          if (f.defaultValue) defaultCreds[f.key] = f.defaultValue;
        });
        setCredentials(defaultCreds);
      }
    }
  }, [isOpen, initialProviderId, editingIntegration]);

  const isProviderLocked = Boolean(initialProviderId || editingIntegration);

  const theme =
    PROVIDER_THEMES[resolvedProviderKey] ||
    PROVIDER_THEMES[activeProvider.id.toUpperCase()] ||
    PROVIDER_THEMES[selectedProviderId.toUpperCase()] || {
      bg: 'bg-cyan-600/10 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400 border border-cyan-500/20',
      text: 'text-cyan-600 dark:text-cyan-400',
      badge: activeProvider.displayName,
      iconLetter: activeProvider.displayName.charAt(0),
    };

  const handleProviderChange = (newId: string) => {
    const pid = resolveProviderId(newId);
    setSelectedProviderId(pid);
    const p =
      DEFAULT_PROVIDERS.find((pr) => resolveProviderId(pr.id) === pid) ||
      providers.find((pr) => resolveProviderId(pr.id) === pid);
    if (p && !editingIntegration) {
      setName(`${p.displayName} Muhasebe`);
      const defaultCreds: Record<string, string> = {};
      p.credentialSchema?.fields?.forEach((f) => {
        if (f.defaultValue) defaultCreds[f.key] = f.defaultValue;
      });
      setCredentials(defaultCreds);
    }
  };

  const handleCredentialChange = (key: string, value: string) => {
    setCredentials((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (editingIntegration) {
        await api.patch(`/accounting/integrations/${editingIntegration.id}`, {
          name,
          environment,
          credentials,
        });
        toast.success(t('messages.updateSuccess'));
      } else {
        const created = await api.post<any>('/accounting/integrations', {
          provider: resolvedProviderKey,
          name,
          environment,
          credentials,
        });
        if (created?.id && (environment === 'MOCK' || !environment)) {
          try {
            await api.post(`/accounting/integrations/${created.id}/test-connection`);
          } catch {
            // ignore
          }
        }
        toast.success(t('messages.createSuccess'));
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || t('messages.operationFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl animate-scale-in">
        {/* Header */}
        <header className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl font-bold text-base shadow-xs ${theme.bg}`}>
                {theme.iconLetter}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    {editingIntegration
                      ? `${activeProvider.displayName} Ayarlarını Düzenle`
                      : `${activeProvider.displayName} Bağlantı Kurulumu`}
                  </h2>
                  <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold ${theme.bg}`}>
                    {theme.badge}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {activeProvider.displayName} API kimlik ve entegrasyon bilgilerini tanımlayın
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-5">
            {/* MOCK_READY Notice Banner for the active provider */}
            <div className="rounded-xl border border-amber-500/30 bg-amber-50 dark:bg-amber-950/30 p-3.5 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
              <ShieldCheckIcon className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-bold text-amber-950 dark:text-amber-100">
                  MOCK_READY Entegrasyon:
                </span>{' '}
                {activeProvider.displayName} API erişimi güvenli simülasyon modunda çalışmaktadır. TEST ve PRODUCTION modları canlı kimlik bilgileri onaylanana kadar korumalıdır ve ağ isteği yapmaz.
              </div>
            </div>

            {/* Dynamics 365 BC Entra ID Onboarding Guidance (§3.2, §9) */}
            {selectedProviderId === 'MS_DYNAMICS_BC_ONLINE' && (
              <div className="rounded-xl border border-cyan-500/30 bg-cyan-50 dark:bg-cyan-950/30 p-4 text-xs text-cyan-900 dark:text-cyan-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-cyan-950 dark:text-cyan-100">
                  <InformationCircleIcon className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                  Microsoft Entra ID & Business Central Kurulum Adımları
                </div>
                <ol className="list-decimal list-inside space-y-1 text-cyan-800 dark:text-cyan-300">
                  <li><strong>Entra ID:</strong> Uygulama kaydı oluşturun, <code>API.ReadWrite.All</code> Application izni ekleyin.</li>
                  <li><strong>Business Central:</strong> &quot;Microsoft Entra Applications&quot; sayfasında Client ID kaydedip <code>D365 BASIC</code> ve <code>D365 SALES DOC, EDIT</code> izin kümelerini atayın.</li>
                  <li><strong>Grant Consent:</strong> Kart üzerindeki &quot;Grant Consent&quot; butonuyla onay verin.</li>
                </ol>
                <p className="text-[11px] text-cyan-700 dark:text-cyan-400 pt-1 border-t border-cyan-500/20">
                  * HTTP 403 hatası alınıyorsa Entra doğrulaması başarılıdır ancak Business Central içindeki izin kümeleri eksiktir.
                </p>
              </div>
            )}

            {/* Sage Business Cloud Accounting Guidance (§1, §4, §6) */}
            {isSage && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/30 p-4 text-xs text-emerald-900 dark:text-emerald-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-emerald-950 dark:text-emerald-100">
                  <InformationCircleIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Sage Business Cloud Accounting Entegrasyon Rehberi
                </div>
                <ul className="list-disc list-inside space-y-1 text-emerald-800 dark:text-emerald-300">
                  <li><strong>Bölgesel Model:</strong> Sage İngiltere ve Avrupa odaklıdır. Türk vergi / e-Fatura modeli uygulanmaz.</li>
                  <li><strong>Zorunlu Yapılandırma (§6):</strong> Fatura gönderimi için Varsayılan Gelir Hesabı ve Vergi Oranı seçilmelidir.</li>
                  <li><strong>Dönen Refresh Token (§4.1):</strong> Her token kullanımında rotasyon uygulanır ve sunucu tarafında güvenli saklanır.</li>
                </ul>
              </div>
            )}

            {/* Xero Accounting API Guidance */}
            {isXero && (
              <div className="rounded-xl border border-sky-500/30 bg-sky-50 dark:bg-sky-950/30 p-4 text-xs text-sky-900 dark:text-sky-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-sky-950 dark:text-sky-100">
                  <InformationCircleIcon className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                  Xero Accounting API Entegrasyon Rehberi
                </div>
                <ul className="list-disc list-inside space-y-1 text-sky-800 dark:text-sky-300">
                  <li><strong>Küresel Model:</strong> Xero uluslararası bulut muhasebe standardını kullanır (Yeni Zelanda, İngiltere, ABD, Avustralya). Türk e-Fatura / GİB zorunluluğu yoktur.</li>
                  <li><strong>3 Adımlı Mutabakat Akışı:</strong> Faturalar önce DRAFT olarak oluşturulur, sunucu hesaplamalı toplamlar mutabakat toleransı (≤ 0.05) içinde doğrulanıp AUTHORISED statüsüne alınır.</li>
                  <li><strong>Dönen Refresh Token:</strong> Token rotasyonu 30 dakikalık tolerans (grace period) ile çalışır, 60 günlük hareketsizlik sonlanmasına karşı haftalık otomatik canlı tutma tetiklenir.</li>
                </ul>
              </div>
            )}

            {/* QuickBooks Online Guidance */}
            {isQuickBooks && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/30 p-4 text-xs text-emerald-900 dark:text-emerald-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-emerald-950 dark:text-emerald-100">
                  <InformationCircleIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  QuickBooks Online Entegrasyon Rehberi
                </div>
                <ul className="list-disc list-inside space-y-1 text-emerald-800 dark:text-emerald-300">
                  <li><strong>Küresel Model:</strong> QuickBooks Online ABD, İngiltere, Kanada ve Avustralya standartlarını kullanır. Türk e-Fatura zorunluluğu yoktur.</li>
                  <li><strong>Otomatik Satış Vergisi (AST):</strong> QBO Şirket Tercihlerinde AST etkinse vergi tutarı QBO motorunca hesaplanır; KroptOS sadece net satır tutarlarını iletir ve mutabakat için doğrular.</li>
                  <li><strong>Belge No ve İptal (Void):</strong> DocNumber 21 karakterle sınırlandırılır; iptal işlemleri doğrudan silme yerine QBO standartlarına uygun Void (tutar sıfırlama) akışıyla yürütülür.</li>
                  <li><strong>Yıkıcı Token Politikası:</strong> Intuit güvenlik modeli gereği geçersiz veya süresi dolmuş refresh token kullanımı oturumu sonlandırır. Yeniden yetkilendirme gerekirse doğrudan &quot;QuickBooks ile Yeniden Bağlan&quot; adımını kullanın.</li>
                </ul>
              </div>
            )}

            {/* Odoo Guidance */}
            {isOdoo && (
              <div className="rounded-xl border border-purple-500/30 bg-purple-50 dark:bg-purple-950/30 p-4 text-xs text-purple-900 dark:text-purple-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-purple-950 dark:text-purple-100">
                  <InformationCircleIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  Odoo ERP &amp; Muhasebe Entegrasyon Rehberi
                </div>
                <ul className="list-disc list-inside space-y-1 text-purple-800 dark:text-purple-300">
                  <li><strong>Tekil Bağlantı:</strong> Odoo Online, Odoo.sh ve On-Premise kurulumların tamamı tek konnektör üzerinden yönetilir.</li>
                  <li><strong>Çift Taşıma Desteği:</strong> Odoo 19+ için modern REST JSON-2 taşıması, Odoo 18 ve öncesi için Classic RPC (/jsonrpc) protokolü otomatik olarak seçilir.</li>
                  <li><strong>API Anahtarı Zorunluluğu:</strong> Güvenlik standardı gereği kullanıcı parolalarıyla bağlantı desteklenmez; Odoo kullanıcı ayarlarından oluşturulan API Anahtarı kullanılır.</li>
                  <li><strong>Taslak ve Mutabakat Akışı:</strong> Faturalar önce taslak (draft) olarak oluşturulur, sunucu hesaplamalı toplam tutar mutabakatı doğrulandıktan sonra onaylanır (action_post).</li>
                </ul>
              </div>
            )}

            {/* Lexware Office Guidance (§1, §3, §7) */}
            {isLexware && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-50 dark:bg-amber-950/30 p-4 text-xs text-amber-900 dark:text-amber-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-950 dark:text-amber-100">
                  <InformationCircleIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  Lexware Office Entegrasyon Rehberi
                </div>
                <ul className="list-disc list-inside space-y-1 text-amber-800 dark:text-amber-300">
                  <li><strong>Almanya Bulut Muhasebesi:</strong> Lexware Office (lexoffice) REST API standardını kullanır. Organizasyona özel tekil API anahtarı ile yetkilendirilir.</li>
                  <li><strong>Taslak ve Mutabakat Akışı:</strong> Faturalar önce taslak (draft) olarak açılır, sunucu hesaplamalı toplam tutar mutabakatı doğrulandıktan sonra onaylanır (finalize). Finalize işleminde sürüm kilidi (version) kullanılır.</li>
                  <li><strong>Değişmezlik (Immutability):</strong> Onaylanan faturalar değiştirilemez ve silinemez; düzeltmeler ters kayıt (credit note) ile yapılır.</li>
                  <li><strong>Ödeme Kaydı:</strong> Lexware Office API&apos;si ödeme oluşturmayı desteklemez (salt okunurdur). Tahsilat kayıtları Lexware Office paneli veya banka eşleştirmesi üzerinden yürütülür.</li>
                </ul>
              </div>
            )}

            {/* Cegid XRP Flex Guidance (§1, §4, §6) */}
            {isCegid && (
              <div className="rounded-xl border border-violet-500/30 bg-violet-50 dark:bg-violet-950/30 p-4 text-xs text-violet-900 dark:text-violet-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-violet-950 dark:text-violet-100">
                  <InformationCircleIcon className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  Cegid XRP Flex Bulut ERP Entegrasyon Rehberi
                </div>
                <ul className="list-disc list-inside space-y-1 text-violet-800 dark:text-violet-300">
                  <li><strong>Fransa Bulut ERP Mimarisi:</strong> Cegid XRP Flex, Acumatica tabanlı REST sözleşme API&apos;sini kullanır. Cegid Loop veya Expert serisinden bağımsız kurumsal ERP ürünüdür.</li>
                  <li><strong>Hesap Planı ve Vergi Kodları (Mali Müşavir):</strong> Fatura gönderimi öncesinde Fransız Tekdüzen Hesap Planı (PCG - 707xxx) satış hesapları ve TVA kodları şirketinizin <em>expert-comptable</em> (mali müşaviri) ile netleştirilmelidir.</li>
                  <li><strong>Taslak, Mutabakat ve Onay Döngüsü:</strong> Faturalar önce taslak (Hold: true) olarak açılır, sunucu hesaplamalı toplam tutar mutabakat toleransı (≤ 0.05) içinde teyit edildikten sonra kesinleştirilir (ReleaseInvoice).</li>
                  <li><strong>Güvenli Kimlik Yönetimi:</strong> OAuth 2.0 Password Grant ile token alınır ve sunucu tarafında güvenli şekilde saklanır.</li>
                </ul>
              </div>
            )}

            {/* Pennylane Guidance (§3, §5.1, §5.3, §5.4, §6) */}
            {isPennylane && (
              <div className="rounded-xl border border-teal-500/30 bg-teal-50 dark:bg-teal-950/30 p-4 text-xs text-teal-900 dark:text-teal-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-teal-950 dark:text-teal-100">
                  <InformationCircleIcon className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                  Pennylane Bulut Muhasebe Entegrasyon Rehberi (API v2)
                </div>
                <ul className="list-disc list-inside space-y-1 text-teal-800 dark:text-teal-300">
                  <li><strong>Yalnızca API v2 Mimarisi:</strong> Pennylane entegrasyonu tamamen modern REST v2 API standardını kullanır (API v1 kullanımdan kaldırılmıştır).</li>
                  <li><strong>Fatura Numaralandırma & Yaşam Döngüsü:</strong> Faturalar KroptOS tarafından yapılandırılmış veri olarak taslak (draft: true) açılır; fatura numarası ve sıralı yasal dizilim Pennylane tarafından üretilir.</li>
                  <li><strong>Sunucu Hesaplamalı Mutabakat:</strong> Toplam tutar sunucu tarafından hesaplanır; mutabakat toleransı (≤ 0.05 EUR) doğrulandıktan sonra kesinleştirilir (finalize). Uyuşmazlık durumunda fatura taslakta bekletilir.</li>
                  <li><strong>Fransız KDV Kodları ve Limitler:</strong> Fransız KDV sistemi kodlu enum (FR_200, FR_100 vb.) olarak eşlenir. İstekler 25 istek / 5 saniye kayan pencere sınırına tabidir.</li>
                </ul>
              </div>
            )}

            {/* Logo Objects (GO3) guidance (docs/logo.agent.md §1.2, §4) */}
            {isLogoObjects && (
              <div className="rounded-xl border border-indigo-500/30 bg-indigo-50 dark:bg-indigo-950/30 p-4 text-xs text-indigo-900 dark:text-indigo-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-indigo-950 dark:text-indigo-100">
                  <InformationCircleIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  Logo GO3 (Logo Objects) Entegrasyon Rehberi
                </div>
                <ul className="list-disc list-inside space-y-1 text-indigo-800 dark:text-indigo-300">
                  <li><strong>Kapsam:</strong> GO3, Go Plus ve Tiger Plus. Bu ürünlerde REST servis yoktur; bağlantı Logo Objects (COM) üzerinden kurulur.</li>
                  <li><strong>Agent zorunlu:</strong> COM yalnızca Logo&apos;nun kurulu olduğu Windows makinesinde çalışır. KroptOS Agent o makineye kurulur ve buluta yalnızca dışarı yönlü bağlanır; müşteride hiçbir port açılmaz.</li>
                  <li><strong>Oturum:</strong> Login(kullanıcı, şifre, firma, dönem) — firma ve dönem oturuma kilitlenir; dönem 0 aktif dönemdir.</li>
                  <li><strong>Ön koşul:</strong> Logo Objects kullanım hakkı. Bu sürüm yalnızca MOCK ortamında çalışır; canlı bağlantı Agent ve COM duman testi sonrasında açılır.</li>
                </ul>
              </div>
            )}

            {/* Logo Tiger REST guidance (docs/logo.agent.md §1.1, §4, §5.3) */}
            {isLogoRest && (
              <div className="rounded-xl border border-sky-500/30 bg-sky-50 dark:bg-sky-950/30 p-4 text-xs text-sky-900 dark:text-sky-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-sky-950 dark:text-sky-100">
                  <InformationCircleIcon className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                  Logo REST Servis Entegrasyon Rehberi
                </div>
                <ul className="list-disc list-inside space-y-1 text-sky-800 dark:text-sky-300">
                  <li><strong>Desteklenen ürünler:</strong> Tiger 3, Tiger Wings ve Enterprise sürümleri. <strong>GO3, Start, Tiger Plus ve Go Plus Logo REST tarafından desteklenmez</strong>; bunlar için Logo Objects (COM) tabanlı ayrı bir yol gerekir.</li>
                  <li><strong>Ticari ön koşul:</strong> Client ID / Client Secret yalnızca Logo Çözüm Ortaklarına verilir. Ayrı lisans gerekmez; Logo Objects kullanım hakkı yeterlidir.</li>
                  <li><strong>Kurulum:</strong> ERP dizinindeki <code>RESTServis\LogoRestServiceSetup.exe</code> ile kurulur, <code>RestServiceWSManager.exe</code> ile yapılandırılır. Varsayılan port 32001.</li>
                  <li><strong>Firma kilidi:</strong> Token, girilen firma numarasına (firmno) bağlıdır. Birden fazla firma için ayrı bağlantı açın.</li>
                  <li><strong>Güvenlik:</strong> REST servisini internete açmayın. Bu sürüm yalnızca MOCK ortamında çalışır; canlı bağlantı, yerel ağdaki KroptOS Agent ile sağlanacaktır.</li>
                </ul>
              </div>
            )}

            {/* Re-authorization required warning banner */}
            {isReauthRequired && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-50 dark:bg-rose-950/40 p-4 text-xs text-rose-900 dark:text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-start gap-2.5">
                  <ExclamationTriangleIcon className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                  <div>
                    <span className="font-bold text-rose-950 dark:text-rose-100">Yeniden Yetkilendirme Gerekli:</span>
                    <p className="mt-0.5 text-rose-800 dark:text-rose-300">
                      {isXero ? 'Xero' : isQuickBooks ? 'QuickBooks Online' : 'Sage'} refresh token süresi dolmuş veya geçersiz kalmıştır. Lütfen &quot;{isXero ? 'Xero' : isQuickBooks ? 'QuickBooks' : 'Sage'} ile Yeniden Bağlan&quot; düğmesine basarak oturumunuzu tazeleyin.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleStartOAuth}
                  disabled={isStartingOAuth}
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-rose-700 transition-all shadow-sm"
                >
                  <ArrowPathIcon className={`h-4 w-4 ${isStartingOAuth ? 'animate-spin' : ''}`} />
                  {isXero ? 'Xero' : isQuickBooks ? 'QuickBooks' : 'Sage'} ile Yeniden Bağlan
                </button>
              </div>
            )}

            {/* Provider Selector (ONLY visible when opened generically without a specific pre-selected provider) */}
            {!isProviderLocked && (
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Muhasebe Programı Seçin <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {providers.map((p) => {
                    const isSelected = p.id.toUpperCase() === selectedProviderId.toUpperCase();
                    const pTheme = PROVIDER_THEMES[p.id.toUpperCase()] || theme;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleProviderChange(p.id)}
                        className={`group flex items-center justify-between rounded-xl border p-3 text-left transition-all ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 shadow-sm ring-1 ring-blue-600/30'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                              isSelected
                                ? 'bg-blue-600 text-white shadow-sm'
                                : `${pTheme.bg}`
                            }`}
                          >
                            {pTheme.iconLetter}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate text-slate-900 dark:text-white">
                              {p.displayName}
                            </p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                              {p.protocol.toUpperCase()} · {p.readiness}
                            </p>
                          </div>
                        </div>
                        {isSelected && (
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-blue-600 dark:bg-blue-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Integration Name */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                {t('fields.name')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400"
                placeholder="Örn: Muhasebe Şirketi"
              />
            </div>

            {/* Environment Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                {t('fields.environment')}
              </label>
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value as any)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
              >
                <option value="MOCK">{t('env.mock')} (Güvenli Simülasyon)</option>
                <option value="TEST">{t('env.test')} (Canlı Doğrulama Gerekli)</option>
                <option value="PRODUCTION">{t('env.production')} (Canlı Doğrulama Gerekli)</option>
              </select>
              {environment !== 'MOCK' && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium">
                  <InformationCircleIcon className="h-4 w-4 shrink-0" />
                  {t('env.warningNonMock')}
                </p>
              )}
            </div>

            {/* Dynamic Provider Credential Fields */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-4 space-y-4">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                    {activeProvider.displayName} Bağlantı Bilgileri
                  </h3>
                  <p className="mt-0.5 text-[0.6875rem] text-slate-500 dark:text-slate-400">
                    {activeProvider.displayName} panelinizden temin ettiğiniz API erişim bilgilerini girin.
                  </p>
                </div>

                {isDynamics && editingIntegration?.id && (
                  <button
                    type="button"
                    onClick={handleDiscoverDynamicsCompanies}
                    disabled={isDiscoveringDynamics}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-50 dark:bg-cyan-950/40 px-3 py-1.5 text-xs font-semibold text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/60 transition-all"
                  >
                    <ArrowPathIcon className={`h-3.5 w-3.5 ${isDiscoveringDynamics ? 'animate-spin' : ''}`} />
                    Şirketleri Çek
                  </button>
                )}
              </div>

              {/* Dynamics Discovered Companies Chips */}
              {isDynamics && discoveredDynamicsCompanies.length > 0 && (
                <div className="rounded-xl border border-cyan-500/20 bg-cyan-50/50 dark:bg-cyan-950/20 p-3 space-y-2">
                  <span className="text-[11px] font-bold text-cyan-900 dark:text-cyan-200">
                    Kayıtlı Business Central Şirketleri (Seçmek için tıklayın):
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {discoveredDynamicsCompanies.map((comp) => (
                      <button
                        key={comp.id}
                        type="button"
                        onClick={() => handleCredentialChange('companyId', comp.id)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                          credentials.companyId === comp.id
                            ? 'bg-cyan-600 text-white shadow-sm ring-2 ring-cyan-400'
                            : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-cyan-500 hover:text-cyan-600'
                        }`}
                      >
                        {comp.name} ({comp.id.substring(0, 8)}...)
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {activeProvider.credentialSchema?.fields?.map((field) => {
                  const isSecret = field.type === 'password' || field.secret;
                  const currentValue = credentials[field.key] || '';
                  return (
                    <div
                      key={field.key}
                      className={field.type === 'url' ? 'col-span-full space-y-1' : 'space-y-1'}
                    >
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                          {field.label} {field.required ? <span className="text-red-500">*</span> : ''}
                        </label>

                        {/* Dynamics quick helpers */}
                        {isDynamics && field.key === 'environmentName' && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleCredentialChange('environmentName', 'production')}
                              className={`text-[10px] px-1.5 py-0.5 rounded font-medium transition-all ${
                                currentValue === 'production'
                                  ? 'bg-cyan-600 text-white'
                                  : 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/20'
                              }`}
                            >
                              production
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCredentialChange('environmentName', 'sandbox')}
                              className={`text-[10px] px-1.5 py-0.5 rounded font-medium transition-all ${
                                currentValue === 'sandbox'
                                  ? 'bg-cyan-600 text-white'
                                  : 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/20'
                              }`}
                            >
                              sandbox
                            </button>
                          </div>
                        )}

                        {isDynamics && field.key === 'companyId' && !currentValue && (
                          <button
                            type="button"
                            onClick={() =>
                              handleCredentialChange(
                                'companyId',
                                'b0a00001-0000-0000-0000-000000000001',
                              )
                            }
                            className="text-[10px] text-cyan-600 dark:text-cyan-400 hover:underline px-1.5 py-0.5 rounded bg-cyan-500/10 font-medium"
                          >
                            Örnek GUID Doldur
                          </button>
                        )}
                      </div>

                      <input
                        type={field.type === 'password' ? 'password' : 'text'}
                        required={field.required && !editingIntegration}
                        value={currentValue}
                        onChange={(e) => handleCredentialChange(field.key, e.target.value)}
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400"
                        placeholder={
                          editingIntegration && isSecret && currentValue
                            ? '••••••••'
                            : field.description || field.label
                        }
                      />
                      {field.description && (
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          {field.description}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Fortnox Information Banner (§5.4, §5.5, §5.6, §9) */}
            {isFortnox && (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 space-y-3">
                <div className="flex items-center gap-2 border-b border-emerald-500/20 pb-2">
                  <InformationCircleIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                    Fortnox (İsveç) Muhasebe Entegrasyon Bilgileri
                  </h3>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-300 space-y-2">
                  <p>
                    • <strong>Mali Yıl Kısıtı:</strong> Fatura kesilecek tarihe ait Fortnox hesabınızda aktif bir mali yıl tanımlı olmalıdır. Açık mali yıl yoksa fatura aktarımı durdurulur.
                  </p>
                  <p>
                    • <strong>Fatura Değişmezliği:</strong> Deftere kaydedilmiş (Booked: true) faturalar İsveç Bokföringslagen uyarınca değiştirilemez veya silinemez. Düzeltmeler alacak faturası (Kreditfaktura) ile yapılır.
                  </p>
                  <p>
                    • <strong>E-posta Gönderimi Yapılmaz:</strong> Faturalar KroptOS üzerinden müşteriye e-posta ile iletilmez; belge dağıtımı doğrudan Fortnox panelinden yapılmalıdır.
                  </p>
                  <p>
                    • <strong>Rate Limiti:</strong> Fortnox 5 saniyelik blokta en fazla 25 istek kısıtını uygular (300 req/dk).
                  </p>
                </div>
              </div>
            )}

            {/* Oracle NetSuite Information & Concurrency Banner (§5.2, §5.3, §9) */}
            {isNetSuite && (
              <div className="rounded-2xl border border-blue-500/20 bg-blue-50/40 dark:bg-blue-950/20 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-blue-500/20 pb-2">
                  <div className="flex items-center gap-2">
                    <InformationCircleIcon className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                      Oracle NetSuite ERP Entegrasyon Bilgileri
                    </h3>
                  </div>
                  {certExpiryDays !== null && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        certExpiryDays <= 0
                          ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                          : certExpiryDays <= 7
                          ? 'bg-red-500/10 text-red-600 border border-red-500/20 animate-pulse'
                          : certExpiryDays <= 30
                          ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                      }`}
                    >
                      {certExpiryDays <= 0
                        ? 'Sertifika Süresi Doldu!'
                        : `Sertifika: ${certExpiryDays} gün kaldı`}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-300 space-y-2">
                  <p>
                    • <strong>Kurulum Adımları:</strong> NetSuite panelinde <em>Setup &gt; Integration &gt; Manage Integrations</em> altından OAuth 2.0 (Client Credentials) entegrasyonu açın. <em>Setup &gt; Integration &gt; OAuth 2.0 Client Credentials Setup</em> adımından açık anahtar sertifikanızı yükleyip <strong>kid</strong> değerini alın.
                  </p>
                  <p>
                    • <strong>Özel Anahtar Güvenliği:</strong> RSA özel anahtarınız sunucu güvenli ortamında tanımlı bir ortam değişkeninde tutulur; formu doldururken yalnızca referans adı (örn: <code>NETSUITE_PRIVATE_KEY</code>) belirtilir. Anahtar arayüze girilmez (§5.2).
                  </p>
                  <p>
                    • <strong>Eşzamanlılık Havuzu Paylaşımı:</strong> NetSuite API kotası hesap genelindedir ve tüm entegrasyonlarınızla aynı havuzdan tüketilir. Varsayılan eşzamanlılık 1&apos;dir. Yoğun veri aktarımlarının mesai saatleri dışında yapılması önerilir (§5.3).
                  </p>
                  <p>
                    • <strong>OneWorld Subsidiary:</strong> Çoklu tüzel kişiliğe sahip NetSuite hesaplarında fatura ve carilerin bağlanacağı tüzel kişilik ID&apos;si yapılandırmadan girilir (§5.9).
                  </p>
                </div>
              </div>
            )}

            {/* Fatture in Cloud (TeamSystem) Information & Legal Notice Banner (§1, §2.1, §5.1, §9) */}
            {isFattureInCloud && (
              <div className="rounded-2xl border border-sky-500/20 bg-sky-50/40 dark:bg-sky-950/20 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-sky-500/20 pb-2">
                  <div className="flex items-center gap-2">
                    <InformationCircleIcon className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0" />
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                      Fatture in Cloud (TeamSystem) Entegrasyon Bilgileri
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
                    MOCK_READY
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-300 space-y-2">
                  <p>
                    • <strong>TeamSystem Ayrımı:</strong> Fatture in Cloud, TeamSystem grubunun tek açık dokümanlı bulut API çözümüdür. TeamSystem Enterprise / Alyante çözümleri şirket içi (on-prem) ve yetkili iş ortağı (partner) kanalıyla sağlandığından ayrı bir takvimde ele alınacaktır (§1).
                  </p>
                  <p>
                    • <strong>SdI E-Fatura Güvenlik Sınırı:</strong> İtalya vergi dairesi (SdI) iletimi yasal ve geri alınamaz bir işlemdir. Bu fazda SdI resmi gönderim ucu çağrılmaz; fatura verisi hazırlanır ve <code>dry_run</code> XML doğrulaması yapılır. Resmi iletim Fatture in Cloud portalı üzerinden operatör onayıyla yürütülür (§2.1, §5.1).
                  </p>
                  <p>
                    • <strong>İki Bağımsız Durum Ekseni:</strong> KroptOS belge durumu (belgenin oluşturulması) ile FIC e-fatura iletim durumu (<code>ei_status</code>) birbirinden tamamen bağımsızdır. Belgeleriniz arayüzde iki ayrı sütunda gösterilir (§5.2).
                  </p>
                  <p>
                    • <strong>Kasa/Banka Hesabı Zorunluluğu:</strong> Tahsil edilmiş (&quot;paid&quot;) fatura oluşturabilmek için Fatture in Cloud kasa/banka hesap ID&apos;si zorunludur (§5.6).
                  </p>
                </div>
              </div>
            )}

            {/* Sage OAuth & Token Status (§5 & §10) */}
            {isSage && (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-500/20 pb-3">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <LinkIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      Sage OAuth2 Tarayıcı Yetkilendirmesi
                    </h3>
                    <p className="mt-0.5 text-[0.6875rem] text-slate-500 dark:text-slate-400">
                      Tarayıcı yönlendirmesiyle Sage hesabınızda KroptOS oturumunu açıp yetki verin.
                    </p>
                  </div>
                  {editingIntegration?.id ? (
                    <button
                      type="button"
                      onClick={handleStartOAuth}
                      disabled={isStartingOAuth}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-all shadow-xs"
                    >
                      <ArrowPathIcon className={`h-4 w-4 ${isStartingOAuth ? 'animate-spin' : ''}`} />
                      Sage ile Bağlan / Yetkilendir
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">
                      Entegrasyonu kaydettikten sonra bağlanabilirsiniz.
                    </span>
                  )}
                </div>

                {editingIntegration?.lastVerifiedAt && (
                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <ShieldCheckIcon className="h-4 w-4 text-emerald-600" />
                    <span>
                      Son Token / Doğrulama Zamanı:{' '}
                      <strong>{new Date(editingIntegration.lastVerifiedAt).toLocaleString('tr-TR')}</strong>
                    </span>
                  </div>
                )}

                {/* Configuration Discovery Helpers (§6) */}
                {editingIntegration?.id && (
                  <div className="pt-2 border-t border-emerald-500/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Sage Yapılandırma Keşfi (Hesap Planı ve Vergiler)
                      </span>
                      <button
                        type="button"
                        onClick={handleDiscoverConfig}
                        disabled={isDiscovering}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        <ArrowPathIcon className={`h-3.5 w-3.5 ${isDiscovering ? 'animate-spin' : ''}`} />
                        Yapılandırmayı Çek
                      </button>
                    </div>

                    {discoveredBusinesses.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[11px] font-medium text-slate-500">Mevcut İşletmeler:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {discoveredBusinesses.map((b: any) => (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => handleCredentialChange('businessId', b.id)}
                              className="rounded-lg bg-emerald-100 dark:bg-emerald-900/40 px-2 py-1 text-[11px] font-medium text-emerald-800 dark:text-emerald-200 hover:bg-emerald-200"
                            >
                              {b.name || b.displayed_as} ({b.id})
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {discoveredAccounts.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[11px] font-medium text-slate-500">Gelir Hesapları (Ledger Accounts):</span>
                        <div className="flex flex-wrap gap-1.5">
                          {discoveredAccounts.map((a: any) => (
                            <button
                              key={a.id}
                              type="button"
                              onClick={() => handleCredentialChange('defaultLedgerAccountId', a.id)}
                              className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-200"
                            >
                              {a.displayed_as || a.name} ({a.id})
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {discoveredTaxRates.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[11px] font-medium text-slate-500">Vergi Oranları (Tax Rates):</span>
                        <div className="flex flex-wrap gap-1.5">
                          {discoveredTaxRates.map((tr: any) => (
                            <button
                              key={tr.id}
                              type="button"
                              onClick={() => handleCredentialChange('defaultTaxRateId', tr.id)}
                              className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-200"
                            >
                              {tr.displayed_as || tr.name} ({tr.percentage}%)
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Xero OAuth & Organization Selection */}
            {isXero && (
              <div className="rounded-2xl border border-sky-500/20 bg-sky-50/40 dark:bg-sky-950/20 p-4 space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-sky-500/20 pb-3">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <LinkIcon className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                      Xero OAuth2 Tarayıcı Yetkilendirmesi
                    </h3>
                    <p className="mt-0.5 text-[0.6875rem] text-slate-500 dark:text-slate-400">
                      Tarayıcı yönlendirmesiyle Xero hesabınızda KroptOS oturumunu açıp yetki verin ve bağlı organizasyonu seçin.
                    </p>
                  </div>
                  {editingIntegration?.id ? (
                    <button
                      type="button"
                      onClick={handleStartOAuth}
                      disabled={isStartingOAuth}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-sky-700 transition-all shadow-xs"
                    >
                      <ArrowPathIcon className={`h-4 w-4 ${isStartingOAuth ? 'animate-spin' : ''}`} />
                      Xero ile Bağlan / Yetkilendir
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">
                      Entegrasyonu kaydettikten sonra bağlanabilirsiniz.
                    </span>
                  )}
                </div>

                {editingIntegration?.lastVerifiedAt && (
                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <ShieldCheckIcon className="h-4 w-4 text-sky-600" />
                    <span>
                      Son Token / Doğrulama Zamanı:{' '}
                      <strong>{new Date(editingIntegration.lastVerifiedAt).toLocaleString('tr-TR')}</strong>
                    </span>
                  </div>
                )}

                {/* Organization Discovery */}
                {editingIntegration?.id && (
                  <div className="pt-2 border-t border-sky-500/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Xero Organizasyonları / Kuruluşları
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          setIsDiscovering(true);
                          try {
                            const data = await api.get<any[]>(
                              `/accounting/integrations/${editingIntegration.id}/businesses`,
                            );
                            setDiscoveredBusinesses(data || []);
                            toast.success('Xero organizasyon listesi güncellendi.');
                          } catch (err: any) {
                            toast.error(err.message || 'Organizasyon listesi alınamadı.');
                          } finally {
                            setIsDiscovering(false);
                          }
                        }}
                        disabled={isDiscovering}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline"
                      >
                        <ArrowPathIcon className={`h-3.5 w-3.5 ${isDiscovering ? 'animate-spin' : ''}`} />
                        Organizasyonları Çek
                      </button>
                    </div>

                    {discoveredBusinesses.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[11px] font-medium text-slate-500">Mevcut Organizasyonlar:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {discoveredBusinesses.map((b: any) => (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => {
                                handleCredentialChange('tenantId', b.id);
                                if (b.name) handleCredentialChange('tenantName', b.name);
                              }}
                              className="rounded-lg bg-sky-100 dark:bg-sky-900/40 px-2 py-1 text-[11px] font-medium text-sky-800 dark:text-sky-200 hover:bg-sky-200"
                            >
                              {b.name} ({b.id})
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* QuickBooks OAuth */}
            {isQuickBooks && (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-500/20 pb-3">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <LinkIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      QuickBooks Online OAuth2 Tarayıcı Yetkilendirmesi
                    </h3>
                    <p className="mt-0.5 text-[0.6875rem] text-slate-500 dark:text-slate-400">
                      Tarayıcı yönlendirmesiyle Intuit App Center üzerinde KroptOS yetkisini onaylayıp Realm ID bağlantısını tamamlayın.
                    </p>
                  </div>
                  {editingIntegration?.id ? (
                    <button
                      type="button"
                      onClick={handleStartOAuth}
                      disabled={isStartingOAuth}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-all shadow-xs"
                    >
                      <ArrowPathIcon className={`h-4 w-4 ${isStartingOAuth ? 'animate-spin' : ''}`} />
                      QuickBooks ile Bağlan / Yetkilendir
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">
                      Entegrasyonu kaydettikten sonra bağlanabilirsiniz.
                    </span>
                  )}
                </div>

                {editingIntegration?.lastVerifiedAt && (
                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <ShieldCheckIcon className="h-4 w-4 text-emerald-600" />
                    <span>
                      Son Token / Doğrulama Zamanı:{' '}
                      <strong>{new Date(editingIntegration.lastVerifiedAt).toLocaleString('tr-TR')}</strong>
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <footer className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 px-6 py-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              {t('actions.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 hover:shadow-blue-500/20 disabled:opacity-50 transition-all"
            >
              {isSubmitting ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>{t('actions.saving')}</span>
                </>
              ) : (
                <span>{t('actions.save')}</span>
              )}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
