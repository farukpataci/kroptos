import * as crypto from 'crypto';

export class WooCommerceWebhook {
  private static readonly processedDeliveries = new Set<string>();
  private static readonly MAX_DELIVERY_CACHE = 10000;

  /**
   * Verifies WooCommerce Webhook HMAC-SHA256 signature using timingSafeEqual.
   * 
   * @param rawBody The unparsed raw HTTP request body Buffer or string.
   * @param signature The X-WC-Webhook-Signature header value.
   * @param secret The webhook secret configured for this integration.
   */
  static verifySignature(rawBody: Buffer | string, signature: string | undefined, secret: string): boolean {
    if (!signature || !secret || !rawBody) {
      return false;
    }

    try {
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(rawBody);
      const computedHash = hmac.digest('base64');

      const expectedBuffer = Buffer.from(computedHash, 'utf8');
      const actualBuffer = Buffer.from(signature.trim(), 'utf8');

      if (expectedBuffer.length !== actualBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
    } catch {
      return false;
    }
  }

  /**
   * Checks if delivery ID was already processed (deduplication).
   */
  static isDuplicateDelivery(deliveryId?: string): boolean {
    if (!deliveryId) return false;
    if (this.processedDeliveries.has(deliveryId)) {
      return true;
    }

    if (this.processedDeliveries.size >= this.MAX_DELIVERY_CACHE) {
      const oldestEntries = Array.from(this.processedDeliveries).slice(0, 1000);
      for (const entry of oldestEntries) {
        this.processedDeliveries.delete(entry);
      }
    }

    this.processedDeliveries.add(deliveryId);
    return false;
  }
}
