import { BadRequestException } from '@nestjs/common';
import { EcommerceHttpClient } from '../core/EcommerceHttpClient';
import {
  IkasCredentials,
  IkasFulfillmentPayload,
  IkasInventoryUpdatePayload,
  IkasRawOrder,
  IkasRawProduct,
} from './IkasTypes';

export class IkasClient {
  private readonly credentials: IkasCredentials;
  private readonly httpClient: EcommerceHttpClient;
  private readonly isSimulated: boolean;

  constructor(credentials: IkasCredentials, httpClient: EcommerceHttpClient) {
    this.credentials = credentials;
    this.httpClient = httpClient;
    this.isSimulated = Boolean(
      process.env.NODE_ENV === 'test' ||
        credentials.apiToken === 'mock' ||
        credentials.apiToken === 'simulated' ||
        credentials.apiToken?.startsWith('mock_') ||
        credentials.storeUrl?.includes('mock') ||
        credentials.storeDomain?.includes('mock'),
    );
  }

  /**
   * Normalizes the store URL into an absolute URL.
   * e.g. "butigim" -> "https://butigim.myikas.com"
   * e.g. "https://butigim.myikas.com/" -> "https://butigim.myikas.com"
   */
  public getNormalizedStoreUrl(): string {
    const raw = String(
      this.credentials.storeUrl || this.credentials.storeDomain || '',
    ).trim();

    if (!raw) {
      return 'https://api.myikas.com';
    }

    let domain = raw;
    if (domain.startsWith('http://') || domain.startsWith('https://')) {
      try {
        const u = new URL(domain);
        domain = u.hostname;
      } catch {
        // fallback
      }
    }

    domain = domain.replace(/\/+$/, '');

    if (!domain.includes('.')) {
      domain = `${domain}.myikas.com`;
    }

    return `https://${domain}`;
  }

  /**
   * Resolves GraphQL Admin endpoint.
   */
  public getGraphQLEndpoint(): string {
    const base = this.getNormalizedStoreUrl();
    if (base.includes('api.myikas.com')) {
      return 'https://api.myikas.com/api/v1/admin/graphql';
    }
    return `${base}/api/v1/admin/graphql`;
  }

  /**
   * Resolves authentication token.
   */
  public getToken(): string {
    const token = String(
      this.credentials.apiToken || this.credentials.accessToken || '',
    ).trim();

    if (!token && !this.isSimulated) {
      throw new BadRequestException('İkas API Token (apiToken) belirtilmedi.');
    }

    return token;
  }

  /**
   * Executes a GraphQL query / mutation against İkas Admin API.
   */
  public async graphql<T = any>(
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<T> {
    if (this.isSimulated) {
      return {} as T;
    }

    const token = this.getToken();
    const endpoint = this.getGraphQLEndpoint();

    const response = await this.httpClient.json<{ data?: T; errors?: Array<{ message: string }> }>(
      endpoint,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          query,
          variables,
        }),
      },
    );

    if (response.errors && response.errors.length > 0) {
      throw new BadRequestException(
        `İkas API Hatası: ${response.errors.map((e) => e.message).join(', ')}`,
      );
    }

    return response.data as T;
  }

  /**
   * Tests connection by executing a lightweight GraphQL query or store info query.
   */
  public async testConnection(): Promise<{ success: boolean; message: string; details?: Record<string, unknown> }> {
    if (this.isSimulated) {
      return {
        success: true,
        message: 'İkas bağlantı testi başarılı (Simülasyon Modu).',
        details: { mode: 'simulation', shopDomain: this.getNormalizedStoreUrl() },
      };
    }

    try {
      const query = `
        query PingStore {
          store {
            id
            name
            domain
            currency
          }
        }
      `;

      const data = await this.graphql<{ store?: { id: string; name: string; domain?: string; currency?: string } }>(
        query,
      );

      const store = data?.store;
      return {
        success: true,
        message: `İkas bağlantısı başarılı: ${store?.name || this.getNormalizedStoreUrl()}`,
        details: {
          storeId: store?.id,
          storeName: store?.name,
          currency: store?.currency,
          domain: store?.domain || this.getNormalizedStoreUrl(),
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'İkas mağaza API bağlantısı kurulamadı.',
        details: { error: error.message },
      };
    }
  }

  /**
   * Fetches orders from İkas.
   */
  public async getOrders(params?: { limit?: number; page?: number; status?: string }): Promise<IkasRawOrder[]> {
    if (this.isSimulated) {
      return [
        {
          id: 'ikas-order-101',
          orderNumber: 'IKS-1001',
          orderStatus: 'WAITING_FOR_SHIPMENT',
          paymentStatus: 'PAID',
          currency: 'TRY',
          totalPrice: 1250.0,
          subTotalPrice: 1100.0,
          totalTax: 150.0,
          totalShippingPrice: 0,
          totalDiscountPrice: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          customer: {
            id: 'cust-1',
            firstName: 'Ahmet',
            lastName: 'Yılmaz',
            email: 'ahmet@example.com',
            phone: '+905551234567',
          },
          shippingAddress: {
            firstName: 'Ahmet',
            lastName: 'Yılmaz',
            address1: 'Atatürk Cad. No: 42 D: 5',
            city: 'İstanbul',
            district: 'Kadıköy',
            country: 'Türkiye',
            countryCode: 'TR',
            phone: '+905551234567',
          },
          orderLineItems: [
            {
              id: 'item-1',
              productId: 'prod-1',
              variantId: 'var-1',
              sku: 'IKAS-TSHIRT-BLK-M',
              barcode: '868000000001',
              name: 'Basic Pamuklu T-Shirt',
              variantName: 'Siyah / M',
              quantity: 2,
              price: 550.0,
              finalPrice: 1100.0,
            },
          ],
        },
      ];
    }

    const limit = params?.limit || 50;
    const page = params?.page || 1;

    const query = `
      query ListOrders($limit: Int, $page: Int) {
        listOrders(pagination: { limit: $limit, page: $page }) {
          data {
            id
            orderNumber
            orderStatus
            paymentStatus
            currency
            totalPrice
            subTotalPrice
            totalTax
            totalShippingPrice
            totalDiscountPrice
            createdAt
            updatedAt
            customer {
              id
              firstName
              lastName
              email
              phone
            }
            shippingAddress {
              firstName
              lastName
              address1
              address2
              city
              district
              postalCode
              country
              countryCode
              phone
            }
            billingAddress {
              firstName
              lastName
              address1
              address2
              city
              district
              postalCode
              country
              countryCode
              phone
            }
            orderLineItems {
              id
              productId
              variantId
              sku
              barcode
              name
              variantName
              quantity
              price
              finalPrice
              taxRatio
              discountAmount
            }
          }
        }
      }
    `;

    const data = await this.graphql<{ listOrders?: { data?: IkasRawOrder[] } }>(query, {
      limit,
      page,
    });

    return data?.listOrders?.data || [];
  }

  /**
   * Fetches single order by ID.
   */
  public async getOrder(orderId: string): Promise<IkasRawOrder> {
    if (this.isSimulated) {
      const orders = await this.getOrders();
      return orders.find((o) => o.id === orderId) || orders[0];
    }

    const query = `
      query GetOrder($id: String!) {
        getOrder(id: $id) {
          id
          orderNumber
          orderStatus
          paymentStatus
          currency
          totalPrice
          subTotalPrice
          totalTax
          totalShippingPrice
          totalDiscountPrice
          createdAt
          updatedAt
          customer {
            id
            firstName
            lastName
            email
            phone
          }
          shippingAddress {
            firstName
            lastName
            address1
            address2
            city
            district
            postalCode
            country
            countryCode
            phone
          }
          billingAddress {
            firstName
            lastName
            address1
            address2
            city
            district
            postalCode
            country
            countryCode
            phone
          }
          orderLineItems {
            id
            productId
            variantId
            sku
            barcode
            name
            variantName
            quantity
            price
            finalPrice
            taxRatio
            discountAmount
          }
        }
      }
    `;

    const data = await this.graphql<{ getOrder?: IkasRawOrder }>(query, { id: orderId });
    if (!data?.getOrder) {
      throw new BadRequestException(`İkas siparişi bulunamadı: ${orderId}`);
    }

    return data.getOrder;
  }

  /**
   * Fetches products catalogue from İkas.
   */
  public async getProducts(params?: { limit?: number; page?: number }): Promise<IkasRawProduct[]> {
    if (this.isSimulated) {
      return [
        {
          id: 'prod-1',
          name: 'Basic Pamuklu T-Shirt',
          status: 'ACTIVE',
          brand: 'Kroptos Collection',
          variants: [
            {
              id: 'var-1',
              productId: 'prod-1',
              sku: 'IKAS-TSHIRT-BLK-M',
              barcode: '868000000001',
              name: 'Siyah / M',
              price: 550.0,
              stock: 45,
            },
          ],
        },
      ];
    }

    const limit = params?.limit || 50;
    const page = params?.page || 1;

    const query = `
      query ListProducts($limit: Int, $page: Int) {
        listProducts(pagination: { limit: $limit, page: $page }) {
          data {
            id
            name
            description
            status
            brand {
              name
            }
            createdAt
            updatedAt
            variants {
              id
              productId
              sku
              barcode
              name
              price
              discountPrice
              stock
              weight
            }
            images {
              url
            }
          }
        }
      }
    `;

    const data = await this.graphql<{ listProducts?: { data?: IkasRawProduct[] } }>(query, {
      limit,
      page,
    });

    return data?.listProducts?.data || [];
  }

  /**
   * Updates inventory quantity for a variant.
   */
  public async updateStock(payload: IkasInventoryUpdatePayload): Promise<boolean> {
    if (this.isSimulated) {
      return true;
    }

    const mutation = `
      mutation UpdateStock($variantId: String!, $stock: Int!) {
        updateVariantStock(input: { variantId: $variantId, stock: $stock }) {
          success
        }
      }
    `;

    const res = await this.graphql<{ updateVariantStock?: { success: boolean } }>(mutation, {
      variantId: payload.variantId,
      stock: payload.stock,
    });

    return res?.updateVariantStock?.success ?? true;
  }

  /**
   * Fulfills an order with tracking information in İkas.
   */
  public async createFulfillment(payload: IkasFulfillmentPayload): Promise<{ success: boolean; message?: string }> {
    if (this.isSimulated) {
      return { success: true, message: 'İkas siparişi kargolandı (Simülasyon).' };
    }

    const mutation = `
      mutation CreateFulfillment($input: CreateFulfillmentInput!) {
        createFulfillment(input: $input) {
          success
          message
        }
      }
    `;

    const res = await this.graphql<{ createFulfillment?: { success: boolean; message?: string } }>(
      mutation,
      {
        input: {
          orderId: payload.orderId,
          cargoCompany: payload.cargoCompany,
          trackingNumber: payload.trackingNumber,
          trackingUrl: payload.trackingUrl,
          lineItemIds: payload.lineItemIds,
        },
      },
    );

    return {
      success: res?.createFulfillment?.success ?? true,
      message: res?.createFulfillment?.message,
    };
  }
}
