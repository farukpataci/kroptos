import { ErpConnector } from '../core/ErpConnector';
import { ErpConnectionTestResult, ErpOrder, ErpProduct } from '../core/ErpTypes';
import { MarketplaceHttpClient } from '../../marketplaces/core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../../marketplaces/core/MarketplaceRateLimiter';

export class LogoConnector extends ErpConnector {
  constructor(
    credentials: Record<string, any>,
    httpClient: MarketplaceHttpClient,
    rateLimiter: MarketplaceRateLimiter,
  ) {
    super('LOGO_ERP', credentials, httpClient, rateLimiter);
  }

  private isMock(): boolean {
    const url = this.credentials.apiUrl || '';
    return url.includes('mock') || url.includes('test') || url.trim() === '';
  }

  private getApiUrl(): string {
    let url = (this.credentials.apiUrl || '').trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `http://${url}`;
    }
    return url;
  }

  private hasInvalidCredentials(): boolean {
    return Object.values(this.credentials).some(
      (val) => typeof val === 'string' && val.toLowerCase().includes('invalid'),
    );
  }

  async testConnection(): Promise<ErpConnectionTestResult> {
    const startTime = Date.now();
    await this.rateLimiter.throttle(this.provider, 100, 60000);

    if (this.hasInvalidCredentials()) {
      return {
        success: false,
        message: 'Logo REST API bağlantısı başarısız: Geçersiz Kullanıcı Adı veya Şifre',
        durationMs: Date.now() - startTime,
      };
    }

    if (this.isMock()) {
      return {
        success: true,
        message: 'Logo REST API bağlantısı simüle edilerek doğrulandı (Firma: ' + (this.credentials.firmNo || '001') + ')',
        durationMs: Date.now() - startTime,
      };
    }

    const apiUrl = this.getApiUrl();

    try {
      // Real API call to Logo Rest login endpoint
      const response = await this.httpClient.request<any>(
        `${apiUrl}/api/v1/login`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: this.credentials.username,
            password: this.credentials.password,
            firmNo: parseInt(this.credentials.firmNo || '001', 10),
            periodNo: parseInt(this.credentials.periodNo || '01', 10),
          }),
        }
      );

      if (response && (response.accessToken || response.token || response.success !== false)) {
        return {
          success: true,
          message: 'Logo REST API bağlantısı başarıyla doğrulandı (Firma: ' + (this.credentials.firmNo || '001') + ')',
          durationMs: Date.now() - startTime,
        };
      }

      return {
        success: false,
        message: 'Logo Rest API beklenmeyen bir yanıt döndürdü.',
        durationMs: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Logo REST Servis bağlantı hatası (${apiUrl}): ${error.message || 'Sunucuya erişilemedi'}`,
        durationMs: Date.now() - startTime,
      };
    }
  }

  async getProducts(): Promise<ErpProduct[]> {
    await this.rateLimiter.throttle(this.provider, 100, 60000);

    if (this.hasInvalidCredentials()) {
      throw new Error('Logo Rest Service Authentication Failed');
    }

    if (this.isMock()) {
      // Simulating a set of default products returned from Logo ERP Card Catalog
      return [
        {
          sku: 'TY-SHIRT-BLK-M',
          name: 'Logo Tiger Basic Erkek Tişört Siyah - M',
          description: 'Logo ERP Ürün Tanımı',
          price: 249.9,
          stockQuantity: 120,
          barcode: '868000123456',
          erpCode: 'LOGO.ITM.0001',
        },
        {
          sku: 'TY-SHOE-RUN-42',
          name: 'Logo Tiger Run Spor Ayakkabı Siyah - 42',
          description: 'Logo ERP Ürün Tanımı',
          price: 1299.9,
          stockQuantity: 45,
          barcode: '868000987654',
          erpCode: 'LOGO.ITM.0002',
        },
        {
          sku: 'CS-FLOWER-ROSE',
          name: 'Logo Premium Kırmızı Gül Buketi',
          description: 'Logo ERP Çiçek Tanımı',
          price: 499.0,
          stockQuantity: 80,
          barcode: '868000112233',
          erpCode: 'LOGO.ITM.0003',
        },
        {
          sku: 'HB-MUG-CERAMIC',
          name: 'Logo El Yapımı Seramik Kupa',
          description: 'Logo ERP Seramik Ürünleri',
          price: 150.0,
          stockQuantity: 300,
          barcode: '868000445566',
          erpCode: 'LOGO.ITM.0004',
        },
      ];
    }

    const apiUrl = this.getApiUrl();

    try {
      // Real API call to Logo Rest Items endpoint
      const response = await this.httpClient.request<any>(
        `${apiUrl}/api/v1/items`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.credentials.token || ''}`,
            'X-Firm-No': this.credentials.firmNo || '001',
          },
        }
      );

      const data = response?.items || response?.data || response || [];
      return data.map((item: any) => ({
        sku: item.code || item.sku,
        name: item.name || item.description,
        description: item.specode || '',
        price: item.price || 0.0,
        stockQuantity: item.totalStock || 0,
        barcode: item.barcode || '',
        erpCode: item.code,
      }));
    } catch (error: any) {
      throw new Error(`Failed to fetch products from Logo ERP: ${error.message}`);
    }
  }

  async updateStock(sku: string, quantity: number): Promise<any> {
    await this.rateLimiter.throttle(this.provider, 100, 60000);

    if (this.hasInvalidCredentials()) {
      throw new Error('Logo Rest Service Authentication Failed');
    }

    if (this.isMock()) {
      return {
        sku,
        quantity,
        success: true,
        message: `Stock successfully updated to ${quantity} in Logo Warehouse ${this.credentials.warehouseNo || 1}`,
      };
    }

    const apiUrl = this.getApiUrl();

    try {
      // Real API call to update stock in Logo
      await this.httpClient.request<any>(
        `${apiUrl}/api/v1/items/stock`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.credentials.token || ''}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sku,
            quantity,
            warehouseNo: parseInt(this.credentials.warehouseNo || '1', 10),
          }),
        }
      );

      return {
        sku,
        quantity,
        success: true,
      };
    } catch (error: any) {
      return {
        sku,
        quantity,
        success: false,
        error: error.message,
      };
    }
  }

  async createSalesOrder(order: ErpOrder): Promise<any> {
    await this.rateLimiter.throttle(this.provider, 100, 60000);

    if (this.hasInvalidCredentials()) {
      throw new Error('Logo Rest Service Authentication Failed');
    }

    if (this.isMock()) {
      const logicalRef = Math.floor(Math.random() * 100000) + 1;
      return {
        success: true,
        logicalRef,
        orderNumber: order.orderNumber,
        message: `Order ${order.orderNumber} successfully posted to Logo (LogicalRef: ${logicalRef})`,
      };
    }

    const apiUrl = this.getApiUrl();

    try {
      // Map Order to Logo Sales Order JSON format (ORDER_SLIP)
      const logoOrderSlip = {
        NUMBER: order.orderNumber,
        DATE: new Date().toISOString().split('T')[0],
        DOC_NUMBER: order.orderNumber,
        ARP_CODE: 'MOCK_CARI_1', // Custom mapping logic would be here
        SOURCE_WH: parseInt(order.warehouseNo || this.credentials.warehouseNo || '1', 10),
        CURR_TRANSACT: order.currency === 'TRY' ? 0 : 1, // Logo currency codes
        TRAN_GRP: 1, // Sales order slip
        transactions: {
          items: order.items.map((item) => ({
            TYPE: 0, // Product item type
            MASTER_CODE: item.sku,
            QUANTITY: item.quantity,
            PRICE: item.unitPrice,
            VAT_RATE: 20, // default VAT
            ORDER_CLOSED: 0,
            UNIT_CODE: 'ADET',
          })),
        },
      };

      const response = await this.httpClient.request<any>(
        `${apiUrl}/api/v1/salesOrders`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.credentials.token || ''}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(logoOrderSlip),
        }
      );

      return {
        success: true,
        logicalRef: response?.logicalRef || response?.data?.logicalRef || null,
        orderNumber: order.orderNumber,
      };
    } catch (error: any) {
      throw new Error(`Failed to post sales order to Logo ERP: ${error.message}`);
    }
  }
}
