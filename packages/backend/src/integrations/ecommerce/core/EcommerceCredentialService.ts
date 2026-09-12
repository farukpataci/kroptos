import { BadRequestException, Injectable } from '@nestjs/common';
import { decrypt, encrypt } from '../../../common/utils/encryption.util';
import { EcommerceProvider } from './EcommerceTypes';

/**
 * Required credential keys per e-commerce provider.
 */
const REQUIRED_CREDENTIALS: Record<EcommerceProvider, string[]> = {
  SHOPIFY: ['shopDomain', 'accessToken'],
  WOOCOMMERCE: ['url', 'consumerKey', 'consumerSecret'],
  MAGENTO: ['url', 'accessToken'],
  TICIMAX: ['url', 'apiKey'],
  IDEASOFT: ['url', 'clientId', 'clientSecret'],
  TSOFT: ['storeDomain', 'username', 'password'],
  OPENCART: ['url', 'apiKey', 'username'],
  PRESTASHOP: ['url', 'apiKey'],
  IKAS: ['storeUrl', 'apiToken'],
};

@Injectable()
export class EcommerceCredentialService {
  /**
   * Decrypts encrypted credentials stored in DB.
   */
  decrypt(encryptedText: string): Record<string, any> {
    try {
      return JSON.parse(decrypt(encryptedText));
    } catch (error: any) {
      throw new BadRequestException(`E-Ticaret kimlik bilgileri çözülemedi: ${error.message}`);
    }
  }

  /**
   * Encrypts credentials before persisting.
   */
  encrypt(credentials: Record<string, any>): string {
    return encrypt(JSON.stringify(credentials ?? {}));
  }

  /**
   * Validates that all required credentials are present for the given provider.
   */
  validate(provider: string, credentials: Record<string, any>): void {
    const key = provider.toUpperCase() as EcommerceProvider;
    const required = REQUIRED_CREDENTIALS[key];

    if (!required) {
      throw new BadRequestException(`Desteklenmeyen e-ticaret altyapısı: ${provider}`);
    }

    const creds: Record<string, any> = { ...credentials };
    if (key === 'TSOFT') {
      if (!creds.storeDomain && creds.url) creds.storeDomain = creds.url;
      if (!creds.storeDomain && creds.domain) creds.storeDomain = creds.domain;
      if (!creds.username && creds.user) creds.username = creds.user;
      if (!creds.password && creds.pass) creds.password = creds.pass;
    } else if (key === 'TICIMAX') {
      if (!creds.url && creds.storeDomain) creds.url = creds.storeDomain;
      if (!creds.apiKey && creds.uyeKodu) creds.apiKey = creds.uyeKodu;
    } else if (key === 'OPENCART') {
      if (!creds.url && creds.storeUrl) creds.url = creds.storeUrl;
      if (!creds.url && creds.storeDomain) creds.url = creds.storeDomain;
      if (!creds.apiKey && creds.key) creds.apiKey = creds.key;
      if (!creds.username && creds.user) creds.username = creds.user;
    }

    const missing = required.filter((field) => !String(creds?.[field] ?? '').trim());
    if (missing.length > 0) {
      throw new BadRequestException(
        `${provider} için zorunlu kimlik bilgileri eksik: ${missing.join(', ')}`,
      );
    }
  }

  /**
   * Returns list of required field names for a given provider.
   */
  requiredFields(provider: string): string[] {
    return REQUIRED_CREDENTIALS[provider.toUpperCase() as EcommerceProvider] ?? [];
  }
}
