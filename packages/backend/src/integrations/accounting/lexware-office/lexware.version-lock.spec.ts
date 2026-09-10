import { LexwareVersionLock } from './lexware.version-lock';
import { LexwareVersionConflictError } from './lexware.error-mapper';

describe('LexwareVersionLock (§3.4, §5.8)', () => {
  it('executes mutation on first try when no conflict occurs', async () => {
    let reads = 0;
    let mutations = 0;

    const fetchEntity = async () => {
      reads++;
      return { id: 'inv-1', version: 1 };
    };

    const mutateEntity = async (e: { id: string; version: number }) => {
      mutations++;
      return { success: true, version: e.version + 1 };
    };

    const result = await LexwareVersionLock.executeWithVersion(fetchEntity, mutateEntity);
    expect(result.success).toBe(true);
    expect(reads).toBe(1);
    expect(mutations).toBe(1);
  });

  it('re-reads entity and succeeds on single 409 version conflict (§5.8)', async () => {
    let reads = 0;
    let mutations = 0;

    const fetchEntity = async () => {
      reads++;
      return { id: 'inv-1', version: reads }; // version updates on second read
    };

    const mutateEntity = async (e: { id: string; version: number }) => {
      mutations++;
      if (mutations === 1) {
        throw new LexwareVersionConflictError('Version conflict on first attempt');
      }
      return { success: true, finalVersion: e.version };
    };

    const result = await LexwareVersionLock.executeWithVersion(fetchEntity, mutateEntity);
    expect(result.success).toBe(true);
    expect(result.finalVersion).toBe(2);
    expect(reads).toBe(2);
    expect(mutations).toBe(2);
  });

  it('aborts immediately and stops at maximum 1 retry on repeated 409 conflict (no infinite loop)', async () => {
    let reads = 0;
    let mutations = 0;

    const fetchEntity = async () => {
      reads++;
      return { id: 'inv-1', version: reads };
    };

    const mutateEntity = async (_e: { id: string; version: number }) => {
      mutations++;
      throw new LexwareVersionConflictError('Repeated 409');
    };

    await expect(
      LexwareVersionLock.executeWithVersion(fetchEntity, mutateEntity),
    ).rejects.toThrow(LexwareVersionConflictError);

    // Initial attempt (1) + single retry (1) = 2 reads & 2 mutations
    expect(reads).toBe(2);
    expect(mutations).toBe(2);
  });

  it('does not retry non-409 errors', async () => {
    let reads = 0;
    let mutations = 0;

    const fetchEntity = async () => {
      reads++;
      return { id: 'inv-1', version: 1 };
    };

    const mutateEntity = async () => {
      mutations++;
      throw new Error('Generic database error');
    };

    await expect(
      LexwareVersionLock.executeWithVersion(fetchEntity, mutateEntity),
    ).rejects.toThrow('Generic database error');

    expect(reads).toBe(1);
    expect(mutations).toBe(1);
  });
});
