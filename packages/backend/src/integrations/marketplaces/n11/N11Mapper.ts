import { MarketplaceOrder, MarketplaceOrderItem, MarketplaceProduct } from '../core/MarketplaceTypes';
import { RawN11OrderLine, RawN11Product, RawN11ShipmentPackage } from './N11Types';

/** n11 quotes prices in one currency per product; anything else is refused. */
const SUPPORTED_CURRENCY = 'TL';

export class N11Mapper {
  /**
   * n11's package statuses. `UnPacked` is reachable only from `Picking` — it is
   * what a package becomes after its contents were split into new packages — so
   * it maps past `pending`. `UnSupplied` is a package the seller could not
   * supply, which is a cancellation.
   */
  static readonly STATUS_MAP: Record<string, string> = {
    created: 'pending',
    picking: 'processing',
    unpacked: 'processing',
    shipped: 'shipped',
    delivered: 'delivered',
    cancelled: 'cancelled',
    unsupplied: 'cancelled',
  };

  static toKroptosStatus(n11Status: string | undefined): string {
    return N11Mapper.STATUS_MAP[String(n11Status ?? '').trim().toLowerCase()] ?? 'pending';
  }

  /**
   * The key an order is stored under. One n11 order can be split into several
   * packages that ship, and are cancelled, independently — collapsing them onto
   * the order number would leave one row whose status describes neither half,
   * and the second package to arrive would collide with the first.
   */
  static packageKey(pkg: RawN11ShipmentPackage): string {
    const orderNumber = String(pkg.orderNumber ?? '').trim();
    const packageId = String(pkg.id ?? '').trim();
    // `id` is null for "Konuma Özel Teslimat", where n11 delivers and there is
    // no package to track; the order number alone is unique in that case.
    return packageId ? `${orderNumber}-${packageId}` : orderNumber;
  }

  /** Sum of what the seller invoices, used to sanity-check `totalAmount`. */
  static lineTotal(lines: RawN11OrderLine[]): number {
    return lines.reduce((sum, line) => {
      const gross = Number(line.price ?? 0) * Number(line.quantity ?? 0);
      return sum + gross - Number(line.totalSellerDiscountPrice ?? 0);
    }, 0);
  }

  static toUnifiedOrder(pkg: RawN11ShipmentPackage): MarketplaceOrder {
    const lines = Array.isArray(pkg.lines) ? pkg.lines : [];

    const items: MarketplaceOrderItem[] = lines.map((line) => {
      const quantity = Number(line.quantity) || 0;
      const unitPrice = Number(line.price ?? 0);
      return {
        sku: String(line.stockCode ?? ''),
        name: line.productName?.trim() || 'N11 Product',
        quantity,
        unitPrice,
        // Documented formula: (price × quantity) − totalSellerDiscountPrice.
        totalPrice: unitPrice * quantity - Number(line.totalSellerDiscountPrice ?? 0),
      };
    });

    const status = N11Mapper.toKroptosStatus(pkg.shipmentPackageStatus);
    const address = pkg.shippingAddress ?? {};

    return {
      orderNumber: N11Mapper.packageKey(pkg),
      marketplaceOrderNumber: String(pkg.orderNumber ?? ''),
      // n11 spells it with a lower-case f; the billing address carries the
      // company name instead when the buyer asked for a corporate invoice.
      customerName: pkg.customerfullName?.trim() || address.fullName?.trim() || '',
      customerEmail: pkg.customerEmail,
      customerPhone: address.gsm?.trim(),
      shippingAddress: [address.address, address.neighborhood, address.district, address.city]
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(', '),
      status,
      paymentStatus: status === 'cancelled' ? 'failed' : 'paid',
      // What the seller actually collects. The line sum is checked against this
      // by the connector, which warns when the two cannot be reconciled.
      totalAmount: Number(pkg.totalAmount ?? 0),
      // n11 returns no currency on a package; TRY is assumed and the product
      // side refuses anything that is not TL, so a future multi-currency n11
      // cannot slip wrong amounts in silently.
      currency: 'TRY',
      source: 'n11',
      items,
    };
  }

  /**
   * Throws rather than guessing when a product is priced in a currency this
   * integration has never been verified against — a wrong currency is a wrong
   * price, and a wrong price reaches the buyer.
   */
  static toUnifiedProduct(product: RawN11Product): MarketplaceProduct {
    const currency = String(product.currencyType ?? SUPPORTED_CURRENCY).trim().toUpperCase();
    if (currency !== SUPPORTED_CURRENCY) {
      throw new Error(
        `n11 ürünü '${product.stockCode ?? '?'}' ${currency} para biriminde listelenmiş. ` +
          `Yalnızca ${SUPPORTED_CURRENCY} doğrulandı; kayıt işlenmedi.`,
      );
    }

    return {
      sku: String(product.stockCode ?? ''),
      name: product.title ?? '',
      description: product.description,
      // VARSAYIM: salePrice KDV dahil (brüt) alınıyor. n11 dokümanı bunu
      // söylemiyor, yalnızca vatRate'i ayrı bir alan olarak veriyor. Satıcı
      // panelinde bilinen bir ürünle karşılaştırılmadan fiyat yazma ucu
      // (price.push) açılmayacak.
      price: Number(product.salePrice ?? 0),
      stockQuantity: Number(product.quantity ?? 0),
      image: Array.isArray(product.imageUrls) ? product.imageUrls[0] : undefined,
      barcode: product.barcode ?? undefined,
    };
  }
}
