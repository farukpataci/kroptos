import { Injectable, BadRequestException } from '@nestjs/common';
import { decrypt } from '../../../common/utils/encryption.util';
import { MarketplaceSettingsRegistry } from '../settings/manifest.registry';

@Injectable()
export class MarketplaceCredentialService {
  constructor(private readonly registry: MarketplaceSettingsRegistry) {}

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
   * Checks that every credential the provider's manifest marks `required` is
   * present. The required keys used to live in an if/else chain here and in the
   * form on the frontend; both now read the same manifest, so the two can no
   * longer drift apart.
   *
   * Values are not inspected beyond being present — a credential that looks
   * well-formed but is wrong is the connector's testConnection to discover.
   */
  validate(provider: string, credentials: Record<string, any>): void {
    const manifest = this.registry.getManifest(provider);

    const missingKeys = manifest.credentials
      .filter((field) => field.required && !credentials[field.key])
      .map((field) => field.key);

    if (missingKeys.length > 0) {
      throw new BadRequestException(
        `Missing required credentials for ${provider}: ${missingKeys.join(', ')}`,
      );
    }

    // A field that declares options accepts only those options. Without this a
    // storefront code the marketplace has never heard of is stored happily and
    // surfaces later as a 404 — or, worse, as another storefront's data. Written
    // against the manifest rather than one provider so every enumerated
    // credential is covered by the same rule.
    for (const field of manifest.credentials) {
      if (!field.options?.length) continue;

      const value = credentials[field.key];
      if (value === undefined || value === null || value === '') continue;

      const allowed = field.options.map((opt) => opt.value);
      if (!allowed.includes(value)) {
        throw new BadRequestException(
          `Invalid value for ${provider}.${field.key}: '${value}'. ` +
            `Supported values: ${allowed.join(', ')}`,
        );
      }
    }
  }
}
