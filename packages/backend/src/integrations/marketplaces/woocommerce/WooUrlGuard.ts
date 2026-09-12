import * as dns from 'dns';
import { promisify } from 'util';
import { BadRequestException } from '@nestjs/common';

const dnsLookup = promisify(dns.lookup);

/**
 * SSRF & URL Protection for WooCommerce Base URLs.
 * 
 * Enforces:
 * - Scheme must be https (http://localhost is permitted ONLY in non-production environments).
 * - Port must be 443 (or 80/8080/3000/3001 in dev).
 * - Target host must not resolve to private, loopback, link-local, or cloud metadata ranges.
 * - Normalizes URL by stripping trailing slashes.
 */
export class WooUrlGuard {
  // RFC1918, Loopback, Link-Local, Cloud Metadata (169.254.169.254)
  private static readonly DISALLOWED_IPV4_RANGES = [
    /^127\./,                           // Loopback
    /^10\./,                            // 10.0.0.0/8
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,   // 172.16.0.0/12
    /^192\.168\./,                      // 192.168.0.0/16
    /^169\.254\./,                      // 169.254.0.0/16 (Link-local & AWS/GCP/Azure metadata)
    /^0\./,                             // 0.0.0.0/8
    /^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./, // Carrier Grade NAT (100.64.0.0/10)
  ];

  /**
   * Cleans, validates and guards a WooCommerce store base URL.
   */
  static async validateAndNormalize(rawUrl: string): Promise<string> {
    const trimmed = String(rawUrl ?? '').trim();
    if (!trimmed) {
      throw new BadRequestException('WooCommerce mağaza adresi (baseUrl) boş olamaz.');
    }

    let parsed: URL;
    try {
      parsed = new URL(trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`);
    } catch {
      throw new BadRequestException(`Geçersiz mağaza URL formatı: '${trimmed}'`);
    }

    const isDev = process.env.NODE_ENV !== 'production';

    // 1. Protocol check
    if (parsed.protocol !== 'https:') {
      const isLocalDev = isDev && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
      if (!isLocalDev) {
        throw new BadRequestException('WooCommerce API bağlantısı için HTTPS protokolü zorunludur.');
      }
    }

    // 2. Port check
    const port = parsed.port ? parseInt(parsed.port, 10) : (parsed.protocol === 'https:' ? 443 : 80);
    const allowedPorts = isDev ? [443, 80, 8080, 3000, 3001, 8000] : [443];
    if (!allowedPorts.includes(port)) {
      throw new BadRequestException(`İzin verilmeyen port: ${port}. Yalnızca standart portlar (443) kabul edilir.`);
    }

    // 3. SSRF IP resolution check
    const hostname = parsed.hostname.toLowerCase();

    // In local development, allow localhost hostname exception
    if (isDev && hostname === 'localhost') {
      const portPart = parsed.port ? `:${parsed.port}` : '';
      return `${parsed.protocol}//${parsed.hostname}${portPart}`.replace(/\/+$/, '');
    }

    // Check if hostname is an explicit disallowed IP
    for (const regex of this.DISALLOWED_IPV4_RANGES) {
      if (regex.test(hostname)) {
        throw new BadRequestException('Özel/yerel ağ IP adreslerine doğrudan bağlantı kurulamaz (SSRF koruması).');
      }
    }

    if (hostname === '::1' || hostname.startsWith('fc00:') || hostname.startsWith('fe80:')) {
      throw new BadRequestException('Yerel IPv6 adreslerine bağlantı kurulamaz.');
    }

    // Resolve DNS to verify it does not point to internal infrastructure
    try {
      const lookupResult = await dnsLookup(hostname);
      const resolvedIp = lookupResult.address;

      for (const regex of this.DISALLOWED_IPV4_RANGES) {
        if (regex.test(resolvedIp)) {
          throw new BadRequestException(
            `Mağaza alan adı yerel/özel ağ IP adresine çözümleniyor (${resolvedIp}). Güvenlik gereği engellendi.`,
          );
        }
      }

      if (resolvedIp === '::1' || resolvedIp.startsWith('fc00:') || resolvedIp.startsWith('fe80:')) {
        throw new BadRequestException('Mağaza alan adı yerel IPv6 adresine çözümleniyor.');
      }
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      // If DNS lookup fails, let caller know DNS is unresolved
      throw new BadRequestException(`Mağaza alan adı çözümlenemedi (${hostname}): ${err?.message || 'DNS hatası'}`);
    }

    // Strip trailing slash and path components (WooCommerce REST is mounted at /wp-json/wc/v3)
    const portPart = parsed.port && port !== 443 ? `:${parsed.port}` : '';
    return `${parsed.protocol}//${parsed.hostname}${portPart}`.replace(/\/+$/, '');
  }
}
