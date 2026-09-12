import {
  ERP_API_BACKGROUND_HEADER,
  ERP_API_BACKGROUND_MODE_NONE,
  VismaBackgroundManager,
} from './visma.background';
import { VismaBackgroundJobResponse } from './visma.types';

describe('VismaBackgroundManager (§3, §5.1, §5.2, §9.1)', () => {
  let manager: VismaBackgroundManager;
  let sleepLog: number[];
  const mockSleep = async (ms: number) => {
    sleepLog.push(ms);
  };

  beforeEach(() => {
    sleepLog = [];
    manager = new VismaBackgroundManager({
      initialDelayMs: 100,
      backoffMultiplier: 2,
      maxDelayMs: 1000,
      maxAttempts: 4,
      sleepFn: mockSleep,
    });
  });

  it('1 & 2. Should use erp-api-background: none and never include webhook URL (§3.3, §9.1 #1, #2)', () => {
    expect(ERP_API_BACKGROUND_HEADER).toBe('erp-api-background');
    expect(ERP_API_BACKGROUND_MODE_NONE).toBe('none');
    expect(ERP_API_BACKGROUND_MODE_NONE).not.toContain('http');
    expect(ERP_API_BACKGROUND_MODE_NONE).not.toContain('subscription');
  });

  it('3. Should commit operationId BEFORE polling starts (call sequence verified) (§9.1 #3)', async () => {
    const callOrder: string[] = [];

    const requestFn = jest.fn().mockImplementation(async () => {
      callOrder.push('requestFn');
      return {
        jobId: 'job-12345',
        stateLocation: '/api/v1/background/job-12345',
        contentLocation: '/api/v1/background/job-12345/content',
        status: 'Queued',
      } as VismaBackgroundJobResponse;
    });

    const onOperationCommitted = jest.fn().mockImplementation(async (opId: string) => {
      callOrder.push(`commit:${opId}`);
    });

    const pollStatusFn = jest.fn().mockImplementation(async () => {
      callOrder.push('pollStatus');
      return {
        jobId: 'job-12345',
        stateLocation: '/api/v1/background/job-12345',
        contentLocation: '/api/v1/background/job-12345/content',
        status: 'Completed',
      } as VismaBackgroundJobResponse;
    });

    const fetchContentFn = jest.fn().mockImplementation(async () => {
      callOrder.push('fetchContent');
      return { invoiceNumber: 'INV-1001' };
    });

    const result = await manager.executeBackgroundOperation({
      requestFn,
      onOperationCommitted,
      pollStatusFn,
      fetchContentFn,
    });

    expect(callOrder).toEqual([
      'requestFn',
      'commit:op:job-12345',
      'pollStatus',
      'fetchContent',
    ]);
    expect(result.status).toBe('completed');
    expect(result.operationId).toBe('op:job-12345');
    expect(result.data).toEqual({ invoiceNumber: 'INV-1001' });
  });

  it('4. If commit fails, polling MUST NOT start and error must bubble up (§9.1 #4)', async () => {
    const requestFn = jest.fn().mockResolvedValue({
      jobId: 'job-err-commit',
      stateLocation: '/api/v1/background/job-err-commit',
      status: 'Queued',
    });

    const onOperationCommitted = jest.fn().mockRejectedValue(new Error('DB connection failed during commit'));
    const pollStatusFn = jest.fn();
    const fetchContentFn = jest.fn();

    await expect(
      manager.executeBackgroundOperation({
        requestFn,
        onOperationCommitted,
        pollStatusFn,
        fetchContentFn,
      }),
    ).rejects.toThrow('DB connection failed during commit');

    // Crucial check: polling never executed!
    expect(pollStatusFn).not.toHaveBeenCalled();
    expect(fetchContentFn).not.toHaveBeenCalled();
  });

  it('5. Should poll with exponential backoff intervals and enforce max attempts (§9.1 #5)', async () => {
    let polls = 0;
    const pollStatusFn = jest.fn().mockImplementation(async () => {
      polls++;
      if (polls < 3) {
        return { jobId: 'job-exp', stateLocation: '/loc', status: 'Running' };
      }
      return { jobId: 'job-exp', stateLocation: '/loc', contentLocation: '/content', status: 'Completed' };
    });

    const result = await manager.executeBackgroundOperation({
      requestFn: async () => ({ jobId: 'job-exp', stateLocation: '/loc', status: 'Queued' }),
      onOperationCommitted: async () => {},
      pollStatusFn,
      fetchContentFn: async () => ({ success: true }),
    });

    expect(result.status).toBe('completed');
    expect(pollStatusFn).toHaveBeenCalledTimes(3);
    // Backoff delays: 100, 200, 400
    expect(sleepLog).toEqual([100, 200, 400]);
  });

  it('6. When max attempts reached, should defer job, keep status pending without swallowing (§9.1 #6)', async () => {
    const pollStatusFn = jest.fn().mockResolvedValue({
      jobId: 'job-slow',
      stateLocation: '/loc',
      status: 'Running',
    });

    const result = await manager.executeBackgroundOperation({
      requestFn: async () => ({ jobId: 'job-slow', stateLocation: '/loc', status: 'Queued' }),
      onOperationCommitted: async () => {},
      pollStatusFn,
      fetchContentFn: async () => ({}),
    });

    expect(result.status).toBe('pending');
    expect(result.deferred).toBe(true);
    expect(result.operationId).toBe('op:job-slow');
    expect(result.errorMessage).toContain('azami yoklama sınırına (4 deneme) ulaştı');
    expect(pollStatusFn).toHaveBeenCalledTimes(4);
  });

  it('7. Resume polling on process restart from existing operationId WITHOUT new POST (§9.1 #7)', async () => {
    const pollStatusFn = jest.fn().mockResolvedValue({
      jobId: 'restarted-job',
      stateLocation: '/state',
      contentLocation: '/content',
      status: 'Completed',
    });
    const fetchContentFn = jest.fn().mockResolvedValue({ restored: true });

    const result = await manager.resumePolling({
      operationId: 'op:restarted-job',
      stateLocation: '/state',
      contentLocation: '/content',
      pollStatusFn,
      fetchContentFn,
    });

    expect(result.status).toBe('completed');
    expect(result.operationId).toBe('op:restarted-job');
    expect(result.data).toEqual({ restored: true });
    expect(pollStatusFn).toHaveBeenCalledTimes(1);
  });

  it('8. If operation finishes with error on server, status must be failed with message (§9.1 #8)', async () => {
    const pollStatusFn = jest.fn().mockResolvedValue({
      jobId: 'job-failed',
      stateLocation: '/state',
      status: 'Failed',
      errorMessage: 'Account code 3000 is inactive',
    });

    const result = await manager.executeBackgroundOperation({
      requestFn: async () => ({ jobId: 'job-failed', stateLocation: '/state', status: 'Queued' }),
      onOperationCommitted: async () => {},
      pollStatusFn,
      fetchContentFn: async () => ({}),
    });

    expect(result.status).toBe('failed');
    expect(result.operationId).toBe('op:job-failed');
    expect(result.errorMessage).toBe('Account code 3000 is inactive');
  });

  it('9. If timeout occurs before 202 is received, blind retry is FORBIDDEN (§9.1 #9)', async () => {
    let postAttempts = 0;
    const requestFn = jest.fn().mockImplementation(async () => {
      postAttempts++;
      throw new Error('ETIMEDOUT: Connection timed out before 202 response');
    });

    const onOperationCommitted = jest.fn();
    const pollStatusFn = jest.fn();
    const fetchContentFn = jest.fn();

    await expect(
      manager.executeBackgroundOperation({
        requestFn,
        onOperationCommitted,
        pollStatusFn,
        fetchContentFn,
      }),
    ).rejects.toThrow('ETIMEDOUT: Connection timed out before 202 response');

    expect(postAttempts).toBe(1);
    expect(onOperationCommitted).not.toHaveBeenCalled();
    expect(pollStatusFn).not.toHaveBeenCalled();
  });

  it('10. Operation ID format and parsing helpers must be consistent (§6.1)', () => {
    expect(VismaBackgroundManager.formatOperationId('abc-123')).toBe('op:abc-123');
    expect(VismaBackgroundManager.formatOperationId('op:abc-123')).toBe('op:abc-123');
    expect(VismaBackgroundManager.parseOperationId('op:abc-123')).toBe('abc-123');
    expect(VismaBackgroundManager.parseOperationId('INV-1001')).toBeNull();
    expect(VismaBackgroundManager.isOperationId('op:abc-123')).toBe(true);
    expect(VismaBackgroundManager.isOperationId('INV-1001')).toBe(false);
  });
});
