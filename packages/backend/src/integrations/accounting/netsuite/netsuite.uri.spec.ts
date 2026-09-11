import { BadRequestException } from '@nestjs/common';
import { NetSuiteUriHelper } from './netsuite.uri';

describe('NetSuiteUriHelper', () => {
  const prodAccount = '1234567';
  const sandboxAccount = '1234567_SB1';
  const complexSandbox = 'TSTDRV99999_SB2';

  describe('getExpectedHost & getBaseUrl (§2.1, §3.a, §5.1)', () => {
    it('should generate correct hostname for production account', () => {
      const host = NetSuiteUriHelper.getExpectedHost(prodAccount);
      expect(host).toBe('1234567.suitetalk.api.netsuite.com');
      expect(NetSuiteUriHelper.getBaseUrl(prodAccount)).toBe('https://1234567.suitetalk.api.netsuite.com');
    });

    it('should correctly transform sandbox account (underscores to hyphens, lowercase)', () => {
      const host = NetSuiteUriHelper.getExpectedHost(sandboxAccount);
      expect(host).toBe('1234567-sb1.suitetalk.api.netsuite.com');
      expect(NetSuiteUriHelper.getBaseUrl(sandboxAccount)).toBe('https://1234567-sb1.suitetalk.api.netsuite.com');
    });

    it('should correctly normalize mixed-case complex sandbox IDs', () => {
      const host = NetSuiteUriHelper.getExpectedHost(complexSandbox);
      expect(host).toBe('tstdrv99999-sb2.suitetalk.api.netsuite.com');
      expect(NetSuiteUriHelper.getBaseUrl(complexSandbox)).toBe('https://tstdrv99999-sb2.suitetalk.api.netsuite.com');
    });

    it('should reject empty or invalid account IDs', () => {
      expect(() => NetSuiteUriHelper.getExpectedHost('')).toThrow(BadRequestException);
      expect(() => NetSuiteUriHelper.getExpectedHost('   ')).toThrow(BadRequestException);
      expect(() => NetSuiteUriHelper.getExpectedHost('12345; DROP TABLE')).toThrow(BadRequestException);
      expect(() => NetSuiteUriHelper.getExpectedHost('1234.evil.com')).toThrow(BadRequestException);
    });
  });

  describe('URL Builders', () => {
    it('should build correct token URL', () => {
      const url = NetSuiteUriHelper.getTokenUrl(sandboxAccount);
      expect(url).toBe('https://1234567-sb1.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token');
    });

    it('should build correct metadata catalog URL', () => {
      const url = NetSuiteUriHelper.getMetadataCatalogUrl(sandboxAccount);
      expect(url).toBe('https://1234567-sb1.suitetalk.api.netsuite.com/services/rest/record/v1/metadata-catalog');

      const selectUrl = NetSuiteUriHelper.getMetadataCatalogUrl(sandboxAccount, 'customer');
      expect(selectUrl).toBe('https://1234567-sb1.suitetalk.api.netsuite.com/services/rest/record/v1/metadata-catalog?select=customer');
    });

    it('should build correct SuiteQL URL with query params', () => {
      const url = NetSuiteUriHelper.getSuiteQLUrl(sandboxAccount, 50, 100);
      expect(url).toBe('https://1234567-sb1.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql?limit=50&offset=100');
    });

    it('should build record URLs with standard IDs', () => {
      const listUrl = NetSuiteUriHelper.buildRecordUrl(sandboxAccount, 'customer');
      expect(listUrl).toBe('https://1234567-sb1.suitetalk.api.netsuite.com/services/rest/record/v1/customer');

      const itemUrl = NetSuiteUriHelper.buildRecordUrl(sandboxAccount, 'customer', 42);
      expect(itemUrl).toBe('https://1234567-sb1.suitetalk.api.netsuite.com/services/rest/record/v1/customer/42');
    });

    it('should build record URLs with eid: syntax for upsert (§5.7)', () => {
      const eidUrl = NetSuiteUriHelper.buildRecordUrl(sandboxAccount, 'invoice', 'eid:ORD-12345');
      expect(eidUrl).toBe('https://1234567-sb1.suitetalk.api.netsuite.com/services/rest/record/v1/invoice/eid:ORD-12345');
    });
  });

  describe('validateHost & Host Security (§5.1)', () => {
    it('should accept valid matching HTTPS URLs', () => {
      const target = 'https://1234567-sb1.suitetalk.api.netsuite.com/services/rest/record/v1/customer/42';
      const parsed = NetSuiteUriHelper.validateHost(target, sandboxAccount);
      expect(parsed.hostname).toBe('1234567-sb1.suitetalk.api.netsuite.com');
    });

    it('should reject HTTP protocol', () => {
      const target = 'http://1234567-sb1.suitetalk.api.netsuite.com/services/rest/record/v1/customer/42';
      expect(() => NetSuiteUriHelper.validateHost(target, sandboxAccount)).toThrow(BadRequestException);
    });

    it('should reject URLs for different accounts (cross-account isolation)', () => {
      const target = 'https://9999999.suitetalk.api.netsuite.com/services/rest/record/v1/customer/42';
      expect(() => NetSuiteUriHelper.validateHost(target, sandboxAccount)).toThrow(BadRequestException);
    });

    it('should reject unauthorized foreign hosts (SSRF prevention)', () => {
      expect(() => NetSuiteUriHelper.validateHost('https://evil-attacker.com/api', sandboxAccount)).toThrow(
        BadRequestException,
      );
      expect(() =>
        NetSuiteUriHelper.validateHost(
          'https://1234567-sb1.suitetalk.api.netsuite.com.evil.com/fake',
          sandboxAccount,
        ),
      ).toThrow(BadRequestException);
    });

    it('should correctly check isAccountMatch', () => {
      expect(
        NetSuiteUriHelper.isAccountMatch(
          'https://1234567-sb1.suitetalk.api.netsuite.com/services/rest/record/v1/invoice',
          sandboxAccount,
        ),
      ).toBe(true);

      expect(
        NetSuiteUriHelper.isAccountMatch(
          'https://1234567.suitetalk.api.netsuite.com/services/rest/record/v1/invoice',
          sandboxAccount,
        ),
      ).toBe(false);
    });
  });
});
