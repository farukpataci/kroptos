import * as crypto from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { NetSuiteUriHelper } from './netsuite.uri';
import { NetSuiteCertificateCheckResult } from './netsuite.types';

export interface NetSuiteJwtParams {
  accountId: string;
  clientId: string;
  certificateId: string;
  keyReference: string;
  algorithm?: 'PS256' | 'RS256';
}

/**
 * NetSuite OAuth 2.0 M2M JWT Oluşturucu (§2.2, §3.b, §5.2)
 *
 * KRİTİK GÜVENLİK İLKELERİ:
 * 1. Özel anahtar (private key) ve üretilen JWT KESİNLİKLE log'a, audit'e, hata mesajlarına veya HTTP yanıtlarına YAZILMAZ.
 * 2. Özel anahtar parametre olarak değil, yalnızca sunucu ortam referansıyla (`keyReference`) okunur.
 * 3. Hata durumlarında anahtarın içeriği ASLA hata mesajında belirtilmez.
 */
export class NetSuiteJwtHelper {
  /**
   * Sunucu ortam değişkenlerinden özel anahtarı güvenli şekilde okur.
   */
  static getPrivateKeyFromReference(keyReference: string): string {
    if (!keyReference || typeof keyReference !== 'string' || !keyReference.trim()) {
      throw new BadRequestException('[NetSuite JWT] Geçersiz veya boş özel anahtar referansı (keyReference).');
    }

    const trimmedRef = keyReference.trim();
    const key = process.env[trimmedRef];

    if (!key || !key.trim()) {
      throw new BadRequestException(
        `[NetSuite JWT] Güvenlik hatası: "${trimmedRef}" referanslı özel anahtar sunucu ortamında tanımlı değil.`,
      );
    }

    return key.trim();
  }

  /**
   * Base64URL kodlayıcı
   */
  private static base64UrlEncode(data: string | Buffer): string {
    const buf = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
    return buf.toString('base64url');
  }

  /**
   * OAuth 2.0 M2M client assertion JWT üretir (§2.2, §3.b).
   * Algoritma: PS256 (RSA-PSS with SHA-256) veya RS256.
   */
  static generateClientAssertion(params: NetSuiteJwtParams): string {
    const { accountId, clientId, certificateId, keyReference, algorithm = 'PS256' } = params;

    if (!clientId?.trim()) {
      throw new BadRequestException('[NetSuite JWT] İstemci kimliği (clientId) boş olamaz.');
    }
    if (!certificateId?.trim()) {
      throw new BadRequestException('[NetSuite JWT] Sertifika kimliği (certificateId) boş olamaz.');
    }

    const privateKey = this.getPrivateKeyFromReference(keyReference);
    const tokenUrl = NetSuiteUriHelper.getTokenUrl(accountId);
    const nowSeconds = Math.floor(Date.now() / 1000);

    const header = {
      alg: algorithm,
      typ: 'JWT',
      kid: certificateId.trim(),
    };

    const payload = {
      iss: clientId.trim(),
      scope: 'rest_webservices',
      aud: tokenUrl,
      iat: nowSeconds,
      exp: nowSeconds + 60, // 60 saniye geçerlilik süresi
    };

    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));
    const signingInput = `${encodedHeader}.${encodedPayload}`;

    try {
      let signature: Buffer;

      if (algorithm === 'PS256') {
        const signer = crypto.createSign('RSA-SHA256');
        signer.update(signingInput);
        signer.end();
        signature = signer.sign({
          key: privateKey,
          padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
          saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
        });
      } else {
        const signer = crypto.createSign('RSA-SHA256');
        signer.update(signingInput);
        signer.end();
        signature = signer.sign(privateKey);
      }

      const encodedSignature = this.base64UrlEncode(signature);
      return `${signingInput}.${encodedSignature}`;
    } catch (err: any) {
      // Hata mesajında anahtar veya JWT detayı kesinlikle sızdırılmaz
      throw new BadRequestException(
        `[NetSuite JWT] JWT imzalama işlemi başarısız oldu. Lütfen anahtar formatını kontrol ediniz. (${err?.message || 'Crypto error'})`,
      );
    }
  }

  /**
   * Sertifika geçerlilik ve kalan gün kontrolü (§5.2)
   * Eşikler: 30 gün ve 7 gün kala uyarı; süre dolmuşsa EXPIRED.
   */
  static checkCertificateStatus(certificateExpiresAt?: string): NetSuiteCertificateCheckResult {
    if (!certificateExpiresAt || typeof certificateExpiresAt !== 'string' || !certificateExpiresAt.trim()) {
      return {
        status: 'NOT_SET',
        isExpired: false,
        isExpiringSoon: false,
        isCritical: false,
      };
    }

    const expiryDate = new Date(certificateExpiresAt.trim());
    if (isNaN(expiryDate.getTime())) {
      return {
        status: 'NOT_SET',
        isExpired: false,
        isExpiringSoon: false,
        isCritical: false,
        warningMessage: `[NetSuite] Geçersiz sertifika bitiş tarihi formatı: "${certificateExpiresAt}".`,
      };
    }

    const now = Date.now();
    const diffMs = expiryDate.getTime() - now;
    const daysRemaining = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (daysRemaining < 0) {
      return {
        status: 'EXPIRED',
        daysRemaining,
        expiresAt: expiryDate.toISOString(),
        isExpired: true,
        isExpiringSoon: true,
        isCritical: true,
        warningMessage:
          'NetSuite OAuth sertifikasının süresi DOLDU. Güvenlik gereği entegrasyon yeniden yapılandırılana kadar istek yapılamaz.',
      };
    }

    if (daysRemaining <= 7) {
      return {
        status: 'EXPIRING_SOON',
        daysRemaining,
        expiresAt: expiryDate.toISOString(),
        isExpired: false,
        isExpiringSoon: true,
        isCritical: true,
        warningMessage: `KRİTİK UYARI: NetSuite sertifikasının süresi ${daysRemaining} gün içinde dolacak! Lütfen yeni sertifikayı NetSuite'e yükleyin.`,
      };
    }

    if (daysRemaining <= 30) {
      return {
        status: 'EXPIRING_SOON',
        daysRemaining,
        expiresAt: expiryDate.toISOString(),
        isExpired: false,
        isExpiringSoon: true,
        isCritical: false,
        warningMessage: `UYARI: NetSuite sertifikasının süresi ${daysRemaining} gün içinde dolacak. Yenileme planlayınız.`,
      };
    }

    return {
      status: 'VALID',
      daysRemaining,
      expiresAt: expiryDate.toISOString(),
      isExpired: false,
      isExpiringSoon: false,
      isCritical: false,
    };
  }
}
