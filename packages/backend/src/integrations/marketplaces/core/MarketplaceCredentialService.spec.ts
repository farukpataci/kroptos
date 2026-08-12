import { BadRequestException } from '@nestjs/common';
import { TRENDYOL_GLOBAL_COUNTRY_CODES } from '@kroptos/shared';
import { MarketplaceCredentialService } from './MarketplaceCredentialService';
import { MarketplaceSettingsRegistry } from '../settings/manifest.registry';

describe('MarketplaceCredentialService.validate', () => {
  // validate() reads only the manifest; the Prisma client is required by the
  // constructor for the credential-rotation path, which these cases never take.
  const service = new MarketplaceCredentialService(new MarketplaceSettingsRegistry(), {} as any);

  const GLOBAL_CREDS = { sellerId: '1', apiKey: 'k', apiSecret: 's', country: 'RO' };

  describe('trendyol_global country', () => {
    it('accepts every country the shared list declares', () => {
      for (const code of TRENDYOL_GLOBAL_COUNTRY_CODES) {
        expect(() =>
          service.validate('trendyol_global', { ...GLOBAL_CREDS, country: code }),
        ).not.toThrow();
      }
    });

    it('rejects a create with no country at all', () => {
      const { country, ...withoutCountry } = GLOBAL_CREDS;
      expect(() => service.validate('trendyol_global', withoutCountry)).toThrow(BadRequestException);
      expect(() => service.validate('trendyol_global', withoutCountry)).toThrow(/country/);
    });

    it('rejects a country code that is not supported, rather than storing it', () => {
      // A plausible-looking but unsupported code is the dangerous case: it would
      // be accepted and then fail at request time, or return another
      // storefront's data.
      expect(() => service.validate('trendyol_global', { ...GLOBAL_CREDS, country: 'ZZ' })).toThrow(
        BadRequestException,
      );
    });

    it('names the supported values in the error so the caller can fix it', () => {
      let message = '';
      try {
        service.validate('trendyol_global', { ...GLOBAL_CREDS, country: 'ZZ' });
      } catch (err: any) {
        message = err.message;
      }
      expect(message).toContain('ZZ');
      for (const code of TRENDYOL_GLOBAL_COUNTRY_CODES) {
        expect(message).toContain(code);
      }
    });

    it('rejects the codes removed as unverified', () => {
      // 'INT' in particular was never a country: it was invented when the
      // storefront selector lived inside the Türkiye provider.
      for (const code of ['INT', 'AZ', 'DE', 'GB']) {
        expect(() =>
          service.validate('trendyol_global', { ...GLOBAL_CREDS, country: code }),
        ).toThrow(BadRequestException);
      }
    });
  });

  describe('trendyol (Türkiye)', () => {
    it('does not declare a country field at all', () => {
      const manifest = new MarketplaceSettingsRegistry().getManifest('trendyol');
      expect(manifest.credentials.map((f) => f.key)).not.toContain('country');
    });

    it('still validates its own required credentials', () => {
      expect(() => service.validate('trendyol', { sellerId: '1', apiKey: 'k' })).toThrow(
        /apiSecret/,
      );
      expect(() =>
        service.validate('trendyol', { sellerId: '1', apiKey: 'k', apiSecret: 's' }),
      ).not.toThrow();
    });
  });

  it('leaves providers without enumerated credentials unaffected', () => {
    expect(() =>
      service.validate('hepsiburada', {
        merchantId: 'm',
        username: 'u',
        password: 'p',
        apiKey: 'k',
        apiSecret: 's',
      }),
    ).not.toThrow();
  });
});
