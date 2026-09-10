import { AccountingApiError } from '../core/AccountingErrors';

export interface IQBOEntityWithSyncToken {
  Id?: string;
  SyncToken?: string;
  [key: string]: any;
}

export class QBOSyncTokenManager {
  /**
   * §4.2 Optimistic locking: Read-then-mutate with single retry on stale SyncToken (5010).
   * Never retains SyncToken across long periods; fetches immediately before mutation.
   */
  static async executeWithSyncToken<T extends IQBOEntityWithSyncToken, R>(
    fetchEntity: () => Promise<T>,
    mutateEntity: (entity: T) => Promise<R>,
    maxRetries: number = 1,
  ): Promise<R> {
    let attempts = 0;

    while (attempts <= maxRetries) {
      attempts++;
      const currentEntity = await fetchEntity();

      try {
        return await mutateEntity(currentEntity);
      } catch (err: any) {
        const isStaleObjectError =
          err?.code === '5010' ||
          err?.errorCode === '5010' ||
          String(err?.message || '').toLowerCase().includes('stale object error') ||
          String(err?.detail || '').toLowerCase().includes('stale object');

        if (isStaleObjectError && attempts <= maxRetries) {
          // Retry exactly once with refreshed entity
          continue;
        }

        // If not stale error or retry exhausted, abort immediately
        throw err;
      }
    }

    throw new AccountingApiError(
      'quickbooks',
      500,
      'QuickBooks Online SyncToken mutasyonu tekrarlanan bayat token hatası (5010) nedeniyle durduruldu.',
    );
  }
}
