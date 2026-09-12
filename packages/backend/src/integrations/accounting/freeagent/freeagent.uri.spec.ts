import { BadRequestException } from '@nestjs/common';
import { FreeAgentUriHelper } from './freeagent.uri';

describe('FreeAgentUriHelper (§5.1)', () => {
  describe('getBaseUrl & getExpectedHost', () => {
    it('returns production host and URL for PRODUCTION', () => {
      expect(FreeAgentUriHelper.getBaseUrl('PRODUCTION')).toBe('https://api.freeagent.com/v2');
      expect(FreeAgentUriHelper.getExpectedHost('PRODUCTION')).toBe('api.freeagent.com');
    });

    it('returns sandbox host and URL for TEST and MOCK', () => {
      expect(FreeAgentUriHelper.getBaseUrl('TEST')).toBe('https://api.sandbox.freeagent.com/v2');
      expect(FreeAgentUriHelper.getExpectedHost('TEST')).toBe('api.sandbox.freeagent.com');

      expect(FreeAgentUriHelper.getBaseUrl('MOCK')).toBe('https://api.sandbox.freeagent.com/v2');
      expect(FreeAgentUriHelper.getExpectedHost('MOCK')).toBe('api.sandbox.freeagent.com');
    });
  });

  describe('validateHost (§5.1 Security Rule 3)', () => {
    it('allows valid production host in PRODUCTION environment', () => {
      const parsed = FreeAgentUriHelper.validateHost(
        'https://api.freeagent.com/v2/invoices/100',
        'PRODUCTION',
      );
      expect(parsed.hostname).toBe('api.freeagent.com');
      expect(parsed.pathname).toBe('/v2/invoices/100');
    });

    it('allows valid sandbox host in TEST environment', () => {
      const parsed = FreeAgentUriHelper.validateHost(
        'https://api.sandbox.freeagent.com/v2/contacts/2',
        'TEST',
      );
      expect(parsed.hostname).toBe('api.sandbox.freeagent.com');
    });

    it('rejects cross-environment URL (sandbox URL in PRODUCTION)', () => {
      expect(() => {
        FreeAgentUriHelper.validateHost(
          'https://api.sandbox.freeagent.com/v2/invoices/1',
          'PRODUCTION',
        );
      }).toThrow(BadRequestException);
    });

    it('rejects cross-environment URL (production URL in TEST)', () => {
      expect(() => {
        FreeAgentUriHelper.validateHost(
          'https://api.freeagent.com/v2/invoices/1',
          'TEST',
        );
      }).toThrow(BadRequestException);
    });

    it('rejects non-https protocol', () => {
      expect(() => {
        FreeAgentUriHelper.validateHost(
          'http://api.freeagent.com/v2/invoices/1',
          'PRODUCTION',
        );
      }).toThrow(BadRequestException);
    });

    it('rejects third-party or spoofed domains', () => {
      expect(() => {
        FreeAgentUriHelper.validateHost(
          'https://evil-attacker.com/v2/invoices/1',
          'PRODUCTION',
        );
      }).toThrow(BadRequestException);

      expect(() => {
        FreeAgentUriHelper.validateHost(
          'https://api.freeagent.com.evil.com/v2/invoices/1',
          'PRODUCTION',
        );
      }).toThrow(BadRequestException);
    });

    it('rejects invalid or empty URLs', () => {
      expect(() => FreeAgentUriHelper.validateHost('', 'PRODUCTION')).toThrow(BadRequestException);
      expect(() => FreeAgentUriHelper.validateHost('not-a-url', 'PRODUCTION')).toThrow(BadRequestException);
    });
  });

  describe('extractResourceId (§5.1 Rule 1)', () => {
    it('extracts ID from full FreeAgent URL', () => {
      expect(
        FreeAgentUriHelper.extractResourceId('https://api.freeagent.com/v2/contacts/42'),
      ).toBe('42');
      expect(
        FreeAgentUriHelper.extractResourceId('https://api.sandbox.freeagent.com/v2/categories/001'),
      ).toBe('001');
    });

    it('passes through raw numeric or alphanumeric ID', () => {
      expect(FreeAgentUriHelper.extractResourceId('42')).toBe('42');
      expect(FreeAgentUriHelper.extractResourceId(105)).toBe('105');
      expect(FreeAgentUriHelper.extractResourceId('CAT-001')).toBe('CAT-001');
    });

    it('validates resource type if specified', () => {
      expect(
        FreeAgentUriHelper.extractResourceId(
          'https://api.freeagent.com/v2/contacts/42',
          'contacts',
        ),
      ).toBe('42');

      expect(() => {
        FreeAgentUriHelper.extractResourceId(
          'https://api.freeagent.com/v2/invoices/42',
          'contacts',
        );
      }).toThrow(BadRequestException);
    });
  });

  describe('buildResourceUri (§5.1 Rule 4)', () => {
    it('builds canonical URI for contacts', () => {
      const uri = FreeAgentUriHelper.buildResourceUri('contacts', '42', 'PRODUCTION');
      expect(uri).toBe('https://api.freeagent.com/v2/contacts/42');
    });

    it('builds canonical URI for categories in sandbox', () => {
      const uri = FreeAgentUriHelper.buildResourceUri('categories', '001', 'TEST');
      expect(uri).toBe('https://api.sandbox.freeagent.com/v2/categories/001');
    });

    it('builds canonical URI from an existing URL safely without duplicating', () => {
      const uri = FreeAgentUriHelper.buildResourceUri(
        'contacts',
        'https://api.sandbox.freeagent.com/v2/contacts/99',
        'TEST',
      );
      expect(uri).toBe('https://api.sandbox.freeagent.com/v2/contacts/99');
    });

    it('builds company URI', () => {
      expect(FreeAgentUriHelper.buildResourceUri('company', '', 'PRODUCTION')).toBe(
        'https://api.freeagent.com/v2/company',
      );
    });
  });

  describe('isEnvironmentMatch (§5.1 Rule 2)', () => {
    it('returns true when URL matches current environment', () => {
      expect(
        FreeAgentUriHelper.isEnvironmentMatch(
          'https://api.freeagent.com/v2/contacts/1',
          'PRODUCTION',
        ),
      ).toBe(true);

      expect(
        FreeAgentUriHelper.isEnvironmentMatch(
          'https://api.sandbox.freeagent.com/v2/contacts/1',
          'TEST',
        ),
      ).toBe(true);
    });

    it('returns false when sandbox URL is used in production (invalidates mapping)', () => {
      expect(
        FreeAgentUriHelper.isEnvironmentMatch(
          'https://api.sandbox.freeagent.com/v2/contacts/1',
          'PRODUCTION',
        ),
      ).toBe(false);
    });

    it('returns false on invalid URL', () => {
      expect(FreeAgentUriHelper.isEnvironmentMatch('invalid-url', 'PRODUCTION')).toBe(false);
    });
  });
});
