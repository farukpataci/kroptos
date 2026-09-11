import * as crypto from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { NetSuiteJwtHelper } from './netsuite.jwt';

describe('NetSuiteJwtHelper (§2.2, §3.b, §5.2)', () => {
  let testPrivateKey: string;
  let testPublicKey: string;
  const testEnvKey = 'NETSUITE_TEST_KEY_REF_123';

  beforeAll(() => {
    // Generate valid RSA keypair for testing
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    testPrivateKey = privateKey;
    testPublicKey = publicKey;
    process.env[testEnvKey] = testPrivateKey;
  });

  afterAll(() => {
    delete process.env[testEnvKey];
  });

  describe('JWT Generation & Signature Verification', () => {
    it('should generate valid PS256 signed JWT with correct header and claims', () => {
      const jwt = NetSuiteJwtHelper.generateClientAssertion({
        accountId: '1234567_SB1',
        clientId: 'mock-client-id-abc',
        certificateId: 'cert-kid-456',
        keyReference: testEnvKey,
        algorithm: 'PS256',
      });

      expect(typeof jwt).toBe('string');
      const parts = jwt.split('.');
      expect(parts.length).toBe(3);

      // Verify Header
      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      expect(header).toEqual({
        alg: 'PS256',
        typ: 'JWT',
        kid: 'cert-kid-456',
      });

      // Verify Payload Claims
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      expect(payload.iss).toBe('mock-client-id-abc');
      expect(payload.scope).toBe('rest_webservices');
      expect(payload.aud).toBe(
        'https://1234567-sb1.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token',
      );
      expect(typeof payload.iat).toBe('number');
      expect(payload.exp).toBe(payload.iat + 60);

      // Verify cryptographic signature with public key
      const verifier = crypto.createVerify('RSA-SHA256');
      verifier.update(`${parts[0]}.${parts[1]}`);
      verifier.end();
      const verified = verifier.verify(
        {
          key: testPublicKey,
          padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
          saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
        },
        Buffer.from(parts[2], 'base64url'),
      );
      expect(verified).toBe(true);
    });

    it('should also support RS256 algorithm', () => {
      const jwt = NetSuiteJwtHelper.generateClientAssertion({
        accountId: '1234567',
        clientId: 'client-id-xyz',
        certificateId: 'cert-789',
        keyReference: testEnvKey,
        algorithm: 'RS256',
      });

      const parts = jwt.split('.');
      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      expect(header.alg).toBe('RS256');

      const verifier = crypto.createVerify('RSA-SHA256');
      verifier.update(`${parts[0]}.${parts[1]}`);
      verifier.end();
      const verified = verifier.verify(testPublicKey, Buffer.from(parts[2], 'base64url'));
      expect(verified).toBe(true);
    });
  });

  describe('Security & Secret Leakage Prevention (§5.2)', () => {
    it('should throw clean exception if keyReference is not found without leaking environment details', () => {
      expect(() =>
        NetSuiteJwtHelper.generateClientAssertion({
          accountId: '1234567',
          clientId: 'client-1',
          certificateId: 'cert-1',
          keyReference: 'NON_EXISTENT_KEY_VAR_XYZ',
        }),
      ).toThrow(BadRequestException);

      try {
        NetSuiteJwtHelper.generateClientAssertion({
          accountId: '1234567',
          clientId: 'client-1',
          certificateId: 'cert-1',
          keyReference: 'NON_EXISTENT_KEY_VAR_XYZ',
        });
      } catch (err: any) {
        expect(err.message).toContain('NON_EXISTENT_KEY_VAR_XYZ');
        expect(err.message).not.toContain(testPrivateKey);
      }
    });

    it('should never include private key in generated JWT header or payload', () => {
      const jwt = NetSuiteJwtHelper.generateClientAssertion({
        accountId: '1234567',
        clientId: 'client-abc',
        certificateId: 'cert-xyz',
        keyReference: testEnvKey,
      });

      expect(jwt).not.toContain('PRIVATE KEY');
      expect(jwt).not.toContain('BEGIN RSA PRIVATE KEY');
    });
  });

  describe('Certificate Expiration Monitoring (§5.2)', () => {
    it('should return NOT_SET if certificate expiration is undefined or empty', () => {
      const result = NetSuiteJwtHelper.checkCertificateStatus(undefined);
      expect(result.status).toBe('NOT_SET');
      expect(result.isExpired).toBe(false);
    });

    it('should return VALID for certificates with > 30 days remaining', () => {
      const future = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
      const result = NetSuiteJwtHelper.checkCertificateStatus(future);
      expect(result.status).toBe('VALID');
      expect(result.isExpired).toBe(false);
      expect(result.isExpiringSoon).toBe(false);
      expect(result.isCritical).toBe(false);
    });

    it('should warn with EXPIRING_SOON for certificates with <= 30 days remaining', () => {
      const future20 = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();
      const result = NetSuiteJwtHelper.checkCertificateStatus(future20);
      expect(result.status).toBe('EXPIRING_SOON');
      expect(result.isExpiringSoon).toBe(true);
      expect(result.isCritical).toBe(false);
      expect(result.isExpired).toBe(false);
      expect(result.warningMessage).toContain('gün içinde dolacak');
    });

    it('should warn with critical alert for certificates with <= 7 days remaining', () => {
      const future5 = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
      const result = NetSuiteJwtHelper.checkCertificateStatus(future5);
      expect(result.status).toBe('EXPIRING_SOON');
      expect(result.isExpiringSoon).toBe(true);
      expect(result.isCritical).toBe(true);
      expect(result.isExpired).toBe(false);
      expect(result.warningMessage).toContain('KRİTİK UYARI');
    });

    it('should mark EXPIRED when expiration date is in the past', () => {
      const past = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      const result = NetSuiteJwtHelper.checkCertificateStatus(past);
      expect(result.status).toBe('EXPIRED');
      expect(result.isExpired).toBe(true);
      expect(result.isExpiringSoon).toBe(true);
      expect(result.warningMessage).toContain('DOLDU');
    });
  });
});
