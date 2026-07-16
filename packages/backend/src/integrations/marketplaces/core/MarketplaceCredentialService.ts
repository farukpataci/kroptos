import { Injectable, BadRequestException } from '@nestjs/common';
import { decrypt } from '../../../common/utils/encryption.util';

@Injectable()
export class MarketplaceCredentialService {
  /**
   * Decrypts and parses the database-stored credentials string.
   */
  decrypt(encryptedText: string): Record<string, any> {
    try {
      const rawText = decrypt(encryptedText);
      return JSON.parse(rawText);
    } catch (err: any) {
      throw new BadRequestException(`Failed to decrypt credentials: ${err.message}`);
    }
  }

  /**
   * Validates required credential keys for a provider and returns the decrypted credentials object.
   * If any value contains the string "invalid", it will still pass structural validation
   * (so the connector's testConnection can handle checking for actual connection validity).
   */
  validate(provider: string, credentials: Record<string, any>): void {
    const p = provider.toUpperCase();
    const missingKeys: string[] = [];

    if (p === 'TRENDYOL') {
      if (!credentials.apiKey) missingKeys.push('apiKey');
      if (!credentials.apiSecret) missingKeys.push('apiSecret');
      if (!credentials.sellerId) missingKeys.push('sellerId');
    } else if (p === 'HEPSIBURADA') {
      if (!credentials.merchantId) missingKeys.push('merchantId');
      if (!credentials.apiKey) missingKeys.push('apiKey');
      if (!credentials.apiSecret) missingKeys.push('apiSecret');
    } else if (p === 'AMAZON') {
      if (!credentials.sellerId) missingKeys.push('sellerId');
      if (!credentials.awsAccessKey) missingKeys.push('awsAccessKey');
      if (!credentials.awsSecretKey) missingKeys.push('awsSecretKey');
      if (!credentials.refreshToken) missingKeys.push('refreshToken');
    } else if (p === 'N11') {
      if (!credentials.apiKey) missingKeys.push('apiKey');
      if (!credentials.apiSecret) missingKeys.push('apiSecret');
    } else if (p === 'CICEKSEPETI') {
      if (!credentials.apiKey) missingKeys.push('apiKey');
    } else {
      throw new BadRequestException(`Unsupported marketplace provider: ${provider}`);
    }

    if (missingKeys.length > 0) {
      throw new BadRequestException(
        `Missing required credentials for ${provider}: ${missingKeys.join(', ')}`,
      );
    }
  }
}
