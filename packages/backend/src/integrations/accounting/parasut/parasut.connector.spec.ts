import {
  AccountingAmountMismatchError,
  IntegrationNotVerifiedError,
} from '../core/AccountingErrors';
import { CapabilityStatus } from '../core/AccountingTypes';
import { ParasutConnector } from './parasut.connector';

describe('ParasutConnector (Faz 1 - MOCK_READY)', () => {
  const validMockCredentials = {
    clientId: 'test-client-id',
    clientSecret: 'test-secret',
    username: 'admin@kroptos.com',
    password: 'secure-password',
    companyId: '987654',
  };

  describe('1. Bağlantı Testi (testConnection)', () => {
    it('1. MOCK modunda başarılı bağlantı testi firma adı ve ID döner', async () => {
      const connector = new ParasutConnector(validMockCredentials, 'MOCK');
      const result = await connector.testConnection();

      expect(result.success).toBe(true);
      expect(result.companyName).toContain('KroptOS');
      expect(result.environment).toBe('MOCK');
      expect(result.companyId).toBe('987654');
    });

    it('2. MOCK modunda geçersiz kimlik bilgileriyle bağlantı testi başarısız döner', async () => {
      const connector = new ParasutConnector(
        { ...validMockCredentials, username: 'invalid@kroptos.com' },
        'MOCK',
      );
      const result = await connector.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('başarısız');
    });

    it('3. TEST ortamında testConnection çağrısı IntegrationNotVerifiedError fırlatır', async () => {
      const connector = new ParasutConnector(validMockCredentials, 'TEST');

      await expect(connector.testConnection()).rejects.toThrow(IntegrationNotVerifiedError);
    });

    it('4. PRODUCTION ortamında testConnection çağrısı IntegrationNotVerifiedError fırlatır', async () => {
      const connector = new ParasutConnector(validMockCredentials, 'PRODUCTION');

      await expect(connector.testConnection()).rejects.toThrow(IntegrationNotVerifiedError);
    });
  });

  describe('2. Fatura Akışı (createInvoice)', () => {
    it('5. Geçerli kalemler ve eşleşen toplamlarla fatura başarıyla oluşturulur', async () => {
      const connector = new ParasutConnector(validMockCredentials, 'MOCK');
      const result = await connector.createInvoice({
        companyId: '987654',
        referenceCode: 'ORD-1001',
        issueDate: '2026-09-08',
        currency: 'TRY',
        contact: {
          name: 'Ahmet Yılmaz',
          email: 'ahmet@example.com',
          taxNumber: '12345678901',
        },
        items: [
          {
            sku: 'SKU-01',
            name: 'Ürün A',
            quantity: 2,
            unitPrice: 100,
            vatRate: 20,
            vatAmount: 40,
            totalAmount: 240,
          },
        ],
        subtotal: 200,
        vatTotal: 40,
        grandTotal: 240,
      });

      expect(result.externalId).toBeDefined();
      expect(result.externalId).toContain('parasut-inv-');
      expect(result.externalNumber).toBeDefined();
    });

    it('6. Kalemler toplamı ile genel toplam uyuşmadığında AccountingAmountMismatchError fırlatılır', async () => {
      const connector = new ParasutConnector(validMockCredentials, 'MOCK');

      await expect(
        connector.createInvoice({
          companyId: '987654',
          referenceCode: 'ORD-1002',
          issueDate: '2026-09-08',
          currency: 'TRY',
          contact: { name: 'Müşteri' },
          items: [
            {
              sku: 'SKU-01',
              name: 'Ürün',
              quantity: 1,
              unitPrice: 100,
              vatRate: 20,
              totalAmount: 120,
            },
          ],
          subtotal: 100,
          vatTotal: 20,
          grandTotal: 150, // 120 != 150
        }),
      ).rejects.toThrow(AccountingAmountMismatchError);
    });

    it('7. Aynı referenceCode ile tekrar gönderildiğinde idempotent olarak mevcut faturayı döner', async () => {
      const connector = new ParasutConnector(validMockCredentials, 'MOCK');
      const invoiceReq = {
        companyId: '987654',
        referenceCode: 'ORD-IDEMPOTENT-01',
        issueDate: '2026-09-08',
        currency: 'TRY',
        contact: { name: 'Ali Veli' },
        items: [
          {
            sku: 'SKU-X',
            name: 'Kitap',
            quantity: 1,
            unitPrice: 50,
            vatRate: 10,
            totalAmount: 55,
          },
        ],
        subtotal: 50,
        vatTotal: 5,
        grandTotal: 55,
      };

      const first = await connector.createInvoice(invoiceReq);
      const second = await connector.createInvoice(invoiceReq);

      expect(second.externalId).toBe(first.externalId);
      expect(second.externalNumber).toBe(first.externalNumber);
    });
  });

  describe('3. Tahsilat Akışı (recordPayment)', () => {
    it('8. Fatura için geçerli tahsilat kaydı oluşturulur', async () => {
      const connector = new ParasutConnector(validMockCredentials, 'MOCK');
      const result = await connector.recordPayment({
        companyId: '987654',
        invoiceExternalId: 'parasut-inv-1001',
        referenceCode: 'PAY-1001',
        amount: 240,
        currency: 'TRY',
        paymentDate: '2026-09-08',
        paymentMethod: 'credit_card',
      });

      expect(result.externalId).toBeDefined();
      expect(result.externalId).toContain('parasut-pay-');
    });

    it('9. Hata tetikleyici referans verildiğinde tahsilat hatası fırlatılır', async () => {
      const connector = new ParasutConnector(validMockCredentials, 'MOCK');

      await expect(
        connector.recordPayment({
          companyId: '987654',
          invoiceExternalId: 'parasut-inv-1001',
          referenceCode: 'TRIGGER_PAYMENT_FAIL_01',
          amount: 5000,
          currency: 'TRY',
          paymentDate: '2026-09-08',
        }),
      ).rejects.toThrow();
    });
  });

  describe('4. Cari Eşleme (syncContact)', () => {
    it('10. Yeni cari oluşturulur ve externalId döner', async () => {
      const connector = new ParasutConnector(validMockCredentials, 'MOCK');
      const result = await connector.syncContact({
        companyId: '987654',
        kroptosKey: 'TAX-1234567890',
        name: 'Deneme Ltd. Şti.',
        taxNumber: '1234567890',
        taxOffice: 'Kadıköy',
      });

      expect(result.externalId).toBeDefined();
      expect(result.externalId).toContain('parasut-cnt-');
    });

    it('11. Aynı kroptosKey ile tekrar çağrıldığında eşleşen cariyi döner', async () => {
      const connector = new ParasutConnector(validMockCredentials, 'MOCK');
      const contactReq = {
        companyId: '987654',
        kroptosKey: 'EMAIL-info@deneme.com',
        name: 'Deneme Cari',
        email: 'info@deneme.com',
      };

      const first = await connector.syncContact(contactReq);
      const second = await connector.syncContact(contactReq);

      expect(second.externalId).toBe(first.externalId);
    });
  });

  describe('5. Ürün Eşleme (mapProduct)', () => {
    it('12. Ürün SKU ile eşleştirilir ve externalId döner', async () => {
      const connector = new ParasutConnector(validMockCredentials, 'MOCK');
      const result = await connector.mapProduct({
        companyId: '987654',
        sku: 'TEST-SKU-99',
        name: 'Kablosuz Kulaklık',
        vatRate: 20,
        currency: 'TRY',
      });

      expect(result.externalId).toBeDefined();
      expect(result.code).toBe('TEST-SKU-99');
    });
  });

  describe('6. Fatura Sorgulama (findInvoiceByReference)', () => {
    it('13. Oluşturulan faturayı referenceCode ile bulur, olmayanda null döner', async () => {
      const connector = new ParasutConnector(validMockCredentials, 'MOCK');
      const notFound = await connector.findInvoiceByReference('NON-EXISTENT-REF');
      expect(notFound).toBeNull();

      await connector.createInvoice({
        companyId: '987654',
        referenceCode: 'REF-FIND-ME',
        issueDate: '2026-09-08',
        currency: 'TRY',
        contact: { name: 'Test' },
        items: [
          {
            sku: 'SKU-F',
            name: 'Fatura Kalemi',
            quantity: 1,
            unitPrice: 100,
            vatRate: 20,
            totalAmount: 120,
          },
        ],
        subtotal: 100,
        vatTotal: 20,
        grandTotal: 120,
      });

      const found = await connector.findInvoiceByReference('REF-FIND-ME');
      expect(found).not.toBeNull();
      expect(found?.externalId).toBeDefined();
    });
  });

  describe('7. Yetenek Matrisi (capabilities)', () => {
    it('14. Yetenek matrisinde stockSync kesinlikle NOT_SUPPORTED ve salesInvoice MOCK_ONLY olmalıdır', () => {
      const connector = new ParasutConnector(validMockCredentials, 'MOCK');

      expect(connector.capabilities.stockSync).toBe(CapabilityStatus.NOT_SUPPORTED);
      expect(connector.capabilities.eInvoiceOfficialSend).toBe(CapabilityStatus.NOT_SUPPORTED);
      expect(connector.capabilities.salesInvoice).toBe(CapabilityStatus.MOCK_ONLY);
      expect(connector.capabilities.payment).toBe(CapabilityStatus.MOCK_ONLY);
    });
  });
});
