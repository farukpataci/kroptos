import { LexwareVersionConflictError } from './lexware.error-mapper';

export interface ILexwareEntityWithVersion {
  id?: string;
  version: number;
  [key: string]: any;
}

export class LexwareVersionLock {
  /**
   * §3.4, §5.8: Read-then-mutate optimistic locking pattern.
   * Reads entity immediately before mutation.
   * If HTTP 409 occurs, re-reads and retries at most once.
   * If second 409 occurs, aborts immediately without infinite retry.
   */
  static async executeWithVersion<T extends ILexwareEntityWithVersion, R>(
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
        const isConflict =
          err instanceof LexwareVersionConflictError ||
          err?.statusCode === 409 ||
          err?.status === 409 ||
          String(err?.message || '').includes('409') ||
          String(err?.message || '').toLowerCase().includes('sürüm çakışması');

        if (isConflict && attempts <= maxRetries) {
          // Retry exactly once with freshly re-read entity
          continue;
        }

        // Exhausted or not a version conflict
        throw err;
      }
    }

    throw new LexwareVersionConflictError(
      'Lexware Office sürüm çakışması (HTTP 409): Yeniden okuma sonrası ikinci deneme de başarısız oldu.',
    );
  }
}
