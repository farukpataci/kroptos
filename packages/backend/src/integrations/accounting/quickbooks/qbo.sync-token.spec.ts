import { QBOSyncTokenManager } from './qbo.sync-token';

describe('QBOSyncTokenManager (§4.2 & §7.2.9, §7.2.10)', () => {
  it('reads current SyncToken and succeeds on first attempt', async () => {
    const fetchMock = jest.fn(async () => ({ Id: 'inv-1', SyncToken: '0' }));
    const mutateMock = jest.fn(async (entity) => ({ success: true, token: entity.SyncToken }));

    const result = await QBOSyncTokenManager.executeWithSyncToken(fetchMock, mutateMock);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mutateMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ success: true, token: '0' });
  });

  it('retries once if first mutation fails with 5010 Stale Object Error', async () => {
    let fetchCount = 0;
    const fetchMock = jest.fn(async () => {
      fetchCount++;
      return { Id: 'inv-2', SyncToken: String(fetchCount - 1) };
    });

    let mutateCount = 0;
    const mutateMock = jest.fn(async (entity) => {
      mutateCount++;
      if (mutateCount === 1) {
        const err: any = new Error('Stale Object Error');
        err.code = '5010';
        throw err;
      }
      return { success: true, updatedToken: entity.SyncToken };
    });

    const result = await QBOSyncTokenManager.executeWithSyncToken(fetchMock, mutateMock);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(mutateMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ success: true, updatedToken: '1' });
  });

  it('aborts without infinite loop if second attempt also returns 5010', async () => {
    const fetchMock = jest.fn(async () => ({ Id: 'inv-3', SyncToken: '0' }));
    const mutateMock = jest.fn(async () => {
      const err: any = new Error('Stale Object Error');
      err.code = '5010';
      throw err;
    });

    await expect(
      QBOSyncTokenManager.executeWithSyncToken(fetchMock, mutateMock, 1),
    ).rejects.toThrow('Stale Object Error');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(mutateMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry for non-5010 errors', async () => {
    const fetchMock = jest.fn(async () => ({ Id: 'inv-4', SyncToken: '0' }));
    const mutateMock = jest.fn(async () => {
      throw new Error('Validation error: Customer not found');
    });

    await expect(
      QBOSyncTokenManager.executeWithSyncToken(fetchMock, mutateMock),
    ).rejects.toThrow('Validation error: Customer not found');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mutateMock).toHaveBeenCalledTimes(1);
  });
});
