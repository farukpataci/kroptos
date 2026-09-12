import { BadRequestException } from '@nestjs/common';
import { CegidUriHelper } from './cegid.uri';

describe('CegidUriHelper', () => {
  const validInstanceUrl = 'https://tenant1.cegid.cloud';

  describe('cleanBaseUrl', () => {
    it('should normalize valid https URL and strip trailing slashes', () => {
      const res = CegidUriHelper.cleanBaseUrl('https://tenant1.cegid.cloud/');
      expect(res).toBe('https://tenant1.cegid.cloud');
    });

    it('should reject non-https URLs', () => {
      expect(() =>
        CegidUriHelper.cleanBaseUrl('http://tenant1.cegid.cloud'),
      ).toThrow(BadRequestException);
    });

    it('should reject empty or invalid URLs', () => {
      expect(() => CegidUriHelper.cleanBaseUrl('')).toThrow(BadRequestException);
      expect(() => CegidUriHelper.cleanBaseUrl('not-a-url')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('getExpectedHost', () => {
    it('should return lowercase hostname', () => {
      expect(
        CegidUriHelper.getExpectedHost('https://TENANT1.Cegid.Cloud:443/'),
      ).toBe('tenant1.cegid.cloud');
    });
  });

  describe('validateHost', () => {
    it('should pass for matching host on https', () => {
      const target = 'https://tenant1.cegid.cloud/entity/Default/22.200.001/Customer';
      const parsed = CegidUriHelper.validateHost(target, validInstanceUrl);
      expect(parsed.hostname).toBe('tenant1.cegid.cloud');
    });

    it('should throw BadRequestException when host does not match (SSRF protection)', () => {
      const maliciousTarget = 'https://evil-attacker.com/entity/Default/Customer';
      expect(() =>
        CegidUriHelper.validateHost(maliciousTarget, validInstanceUrl),
      ).toThrow(BadRequestException);
    });

    it('should throw when protocol is not https', () => {
      const target = 'http://tenant1.cegid.cloud/entity/Default/Customer';
      expect(() =>
        CegidUriHelper.validateHost(target, validInstanceUrl),
      ).toThrow(BadRequestException);
    });
  });

  describe('buildContractUrl', () => {
    it('should build standard Acumatica contract entity url with default version', () => {
      const url = CegidUriHelper.buildContractUrl(validInstanceUrl, 'Customer');
      expect(url).toBe(
        'https://tenant1.cegid.cloud/entity/Default/22.200.001/Customer',
      );
    });

    it('should append entity key when provided', () => {
      const url = CegidUriHelper.buildContractUrl(
        validInstanceUrl,
        'Customer',
        'Default',
        '22.200.001',
        'C0001',
      );
      expect(url).toBe(
        'https://tenant1.cegid.cloud/entity/Default/22.200.001/Customer/C0001',
      );
    });

    it('should support custom endpoint name and version', () => {
      const url = CegidUriHelper.buildContractUrl(
        validInstanceUrl,
        'SalesInvoice',
        'CustomEndpoint',
        '20.200.001',
      );
      expect(url).toBe(
        'https://tenant1.cegid.cloud/entity/CustomEndpoint/20.200.001/SalesInvoice',
      );
    });
  });

  describe('buildActionUrl', () => {
    it('should build Acumatica contract action URL', () => {
      const url = CegidUriHelper.buildActionUrl(
        validInstanceUrl,
        'SalesInvoice',
        'ReleaseInvoice',
      );
      expect(url).toBe(
        'https://tenant1.cegid.cloud/entity/Default/22.200.001/SalesInvoice/ReleaseInvoice',
      );
    });
  });

  describe('getTokenUrl', () => {
    it('should generate default identity connect token URL', () => {
      const url = CegidUriHelper.getTokenUrl(validInstanceUrl);
      expect(url).toBe('https://tenant1.cegid.cloud/identity/connect/token');
    });

    it('should validate custom tokenUrl against expected host', () => {
      const custom = 'https://tenant1.cegid.cloud/oauth/v2/token';
      const url = CegidUriHelper.getTokenUrl(validInstanceUrl, custom);
      expect(url).toBe('https://tenant1.cegid.cloud/oauth/v2/token');
    });

    it('should reject foreign custom tokenUrl', () => {
      const foreign = 'https://evil.com/token';
      expect(() =>
        CegidUriHelper.getTokenUrl(validInstanceUrl, foreign),
      ).toThrow(BadRequestException);
    });
  });
});
