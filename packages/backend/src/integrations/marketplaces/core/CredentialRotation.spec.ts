import { MarketplaceCredentialService } from './MarketplaceCredentialService';
import { MarketplaceSettingsRegistry } from '../settings/manifest.registry';
import { MarketplaceConnector } from './MarketplaceConnector';
import { encrypt, decrypt } from '../../../common/utils/encryption.util';
import { ConnectionTestResult, MarketplaceOrder, MarketplaceProduct, StockUpdateResult } from './MarketplaceTypes';

/**
 * An OAuth marketplace can replace the refresh token while a call is in flight.
 * Holding that value only in memory means the integration authenticates fine
 * until the process restarts and then fails for good, with nothing the seller
 * did to cause it. These cover the channel that carries the new value out of
 * the connector and onto the row.
 */

class RotatingConnector extends MarketplaceConnector {
  constructor() {
    super('TEST', {}, {} as any, {} as any, {});
  }
  rotate(patch: Record<string, string>) {
    this.recordRotatedCredentials(patch);
  }
  async testConnection(): Promise<ConnectionTestResult> {
    return { success: true, message: '', durationMs: 0 };
  }
  async getOrders(): Promise<MarketplaceOrder[]> {
    return [];
  }
  async getProducts(): Promise<MarketplaceProduct[]> {
    return [];
  }
  async updateStock(): Promise<StockUpdateResult> {
    return { sku: '', quantity: 0, success: true };
  }
  async getCategories(): Promise<any[]> {
    return [];
  }
  async getCategoryAttributes(): Promise<any> {
    return {};
  }
}

describe('connector rotated-credential channel', () => {
  it('reports nothing when no credential rotated', () => {
    expect(new RotatingConnector().consumeRotatedCredentials()).toBeUndefined();
  });

  it('hands the new value to the caller', () => {
    const connector = new RotatingConnector();
    connector.rotate({ refreshToken: 'new-token' });

    expect(connector.consumeRotatedCredentials()).toEqual({ refreshToken: 'new-token' });
  });

  it('clears on read so the same rotation is not persisted twice', () => {
    const connector = new RotatingConnector();
    connector.rotate({ refreshToken: 'new-token' });

    connector.consumeRotatedCredentials();
    expect(connector.consumeRotatedCredentials()).toBeUndefined();
  });

  it('merges successive rotations rather than dropping the earlier one', () => {
    const connector = new RotatingConnector();
    connector.rotate({ refreshToken: 'a' });
    connector.rotate({ accessSecret: 'b' });

    expect(connector.consumeRotatedCredentials()).toEqual({ refreshToken: 'a', accessSecret: 'b' });
  });
});

describe('MarketplaceCredentialService.persistRotatedCredentials', () => {
  const build = (stored: Record<string, unknown>) => {
    const row = { credentialsEncrypted: encrypt(JSON.stringify(stored)) };
    const prisma: any = {
      integration: {
        findUnique: jest.fn().mockResolvedValue(row),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    return {
      prisma,
      service: new MarketplaceCredentialService(new MarketplaceSettingsRegistry(), prisma),
    };
  };

  it('keeps the credentials that did not rotate', async () => {
    const { prisma, service } = build({
      sellerId: '42',
      apiKey: 'key',
      refreshToken: 'old',
    });

    await service.persistRotatedCredentials('int-1', { refreshToken: 'new' });

    const written = prisma.integration.update.mock.calls[0][0].data.credentialsEncrypted;
    expect(JSON.parse(decrypt(written))).toEqual({
      sellerId: '42',
      apiKey: 'key',
      refreshToken: 'new',
    });
  });

  it('stores the value encrypted, never in plain text', async () => {
    const { prisma, service } = build({ refreshToken: 'old' });

    await service.persistRotatedCredentials('int-1', { refreshToken: 'super-secret-value' });

    const written = prisma.integration.update.mock.calls[0][0].data.credentialsEncrypted;
    expect(written).not.toContain('super-secret-value');
    expect(JSON.parse(decrypt(written)).refreshToken).toBe('super-secret-value');
  });

  it('does not touch the row when nothing rotated', async () => {
    const { prisma, service } = build({ refreshToken: 'old' });

    await service.persistRotatedCredentials('int-1', {});

    expect(prisma.integration.findUnique).not.toHaveBeenCalled();
    expect(prisma.integration.update).not.toHaveBeenCalled();
  });

  it('ignores an integration that no longer exists', async () => {
    const prisma: any = {
      integration: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() },
    };
    const service = new MarketplaceCredentialService(new MarketplaceSettingsRegistry(), prisma);

    await expect(service.persistRotatedCredentials('gone', { refreshToken: 'x' })).resolves.toBeUndefined();
    expect(prisma.integration.update).not.toHaveBeenCalled();
  });

  it('does not fail the surrounding operation when the write fails', async () => {
    // The sync that triggered the rotation already succeeded; turning a
    // bookkeeping failure into a failed sync would be the worse outcome.
    const prisma: any = {
      integration: {
        findUnique: jest.fn().mockResolvedValue({ credentialsEncrypted: encrypt('{}') }),
        update: jest.fn().mockRejectedValue(new Error('db down')),
      },
    };
    const service = new MarketplaceCredentialService(new MarketplaceSettingsRegistry(), prisma);
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(service.persistRotatedCredentials('int-1', { refreshToken: 'x' })).resolves.toBeUndefined();

    // The log names the keys but must never carry the values.
    const logged = spy.mock.calls.map((c) => c.join(' ')).join(' ');
    expect(logged).toContain('refreshToken');
    expect(logged).not.toContain('"x"');
    spy.mockRestore();
  });
});
