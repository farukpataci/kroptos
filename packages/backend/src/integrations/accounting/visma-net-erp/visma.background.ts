/**
 * Visma.net ERP Background Operation Manager (§3, §5.1, §5.2, §6.1)
 *
 * Implements asynchronous background execution via `erp-api-background: none`.
 * Prevents POST timeouts on long-running ERP operations.
 *
 * Sequence:
 * 1. POST ... + erp-api-background: none
 * 2. 202 Accepted -> extracts jobId & stateLocation
 * 3. Commit operation ID (op:<jobId>) to claim row BEFORE polling starts (§3.2, §6.1)
 * 4. Exponential backoff polling on stateLocation until Completed / Failed / MaxAttempts
 * 5. Fetch content from contentLocation upon completion
 */

import {
  VISMA_OP_PREFIX,
  VismaBackgroundJobResponse,
  VismaBackgroundStatus,
} from './visma.types';

export const ERP_API_BACKGROUND_HEADER = 'erp-api-background';
export const ERP_API_BACKGROUND_MODE_NONE = 'none';

export interface VismaBackgroundOptions {
  initialDelayMs?: number;
  backoffMultiplier?: number;
  maxDelayMs?: number;
  maxAttempts?: number;
  sleepFn?: (ms: number) => Promise<void>;
}

export interface VismaBackgroundResult<T> {
  status: 'completed' | 'pending' | 'failed';
  operationId: string;
  data?: T;
  errorMessage?: string;
  deferred?: boolean;
}

export class VismaBackgroundManager {
  private readonly defaultOptions: Required<VismaBackgroundOptions>;

  constructor(options?: VismaBackgroundOptions) {
    this.defaultOptions = {
      initialDelayMs: options?.initialDelayMs ?? 1000,
      backoffMultiplier: options?.backoffMultiplier ?? 1.5,
      maxDelayMs: options?.maxDelayMs ?? 8000,
      maxAttempts: options?.maxAttempts ?? 6,
      sleepFn: options?.sleepFn ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
    };
  }

  /**
   * Format a raw jobId into the standard `op:<jobId>` externalId representation (§6.1)
   */
  static formatOperationId(jobId: string): string {
    if (!jobId) throw new Error('Visma jobId boş olamaz.');
    return jobId.startsWith(VISMA_OP_PREFIX) ? jobId : `${VISMA_OP_PREFIX}${jobId}`;
  }

  /**
   * Extract raw jobId from `op:<jobId>` string
   */
  static parseOperationId(externalId?: string | null): string | null {
    if (!externalId || !externalId.startsWith(VISMA_OP_PREFIX)) return null;
    return externalId.slice(VISMA_OP_PREFIX.length);
  }

  /**
   * Check if a given string is an in-flight operation ID
   */
  static isOperationId(val?: string | null): boolean {
    return Boolean(val && val.startsWith(VISMA_OP_PREFIX));
  }

  /**
   * Execute an asynchronous background write operation (§3.2).
   *
   * @param requestFn Function that performs the initial POST request with `erp-api-background: none`.
   *                  MUST return 202 + VismaBackgroundJobResponse.
   * @param onOperationCommitted Mandatory callback to persist `op:<jobId>` BEFORE polling starts.
   *                             If this callback fails, polling is aborted (§3.2, §5.2).
   * @param pollStatusFn Function to query `stateLocation` for current job status.
   * @param fetchContentFn Function to query `contentLocation` once status is 'Completed'.
   * @param customOptions Optional override for polling intervals and attempts.
   */
  async executeBackgroundOperation<T>(params: {
    requestFn: () => Promise<VismaBackgroundJobResponse>;
    onOperationCommitted: (operationId: string) => Promise<void>;
    pollStatusFn: (jobId: string, stateLocation: string) => Promise<VismaBackgroundJobResponse>;
    fetchContentFn: (contentLocation: string) => Promise<T>;
    options?: VismaBackgroundOptions;
  }): Promise<VismaBackgroundResult<T>> {
    const opts = { ...this.defaultOptions, ...params.options };

    // 1. Initial POST request
    // CRITICAL (§5.2, §9.1 #9): If requestFn times out or throws before 202 is received,
    // blind retry is STRICTLY FORBIDDEN. The error must bubble up directly.
    const initialJob = await params.requestFn();

    const jobId = initialJob.jobId;
    if (!jobId) {
      throw new Error('Visma.net ERP arka plan operasyon kimliği (jobId) alınamadı.');
    }

    const operationId = VismaBackgroundManager.formatOperationId(jobId);

    // 2. Commit operation ID BEFORE polling starts (§3.2 Step 3, §5.2, §9.1 #3, #4)
    // Sage rule: write-then-use. If commit fails, we do NOT poll.
    await params.onOperationCommitted(operationId);

    // 3. If initial response already has completed content
    if (initialJob.status === 'Completed' && initialJob.contentLocation) {
      const data = await params.fetchContentFn(initialJob.contentLocation);
      return { status: 'completed', operationId, data };
    }

    // 4. Poll stateLocation with exponential backoff (§3.2 Step 4, §5.7)
    return this.pollOperation<T>({
      jobId,
      stateLocation: initialJob.stateLocation,
      contentLocation: initialJob.contentLocation,
      pollStatusFn: params.pollStatusFn,
      fetchContentFn: params.fetchContentFn,
      options: opts,
    });
  }

  /**
   * Resume polling an existing in-flight operation without re-issuing POST (§5.2, §9.1 #7).
   */
  async resumePolling<T>(params: {
    operationId: string;
    stateLocation: string;
    contentLocation?: string;
    pollStatusFn: (jobId: string, stateLocation: string) => Promise<VismaBackgroundJobResponse>;
    fetchContentFn: (contentLocation: string) => Promise<T>;
    options?: VismaBackgroundOptions;
  }): Promise<VismaBackgroundResult<T>> {
    const rawJobId = VismaBackgroundManager.parseOperationId(params.operationId) || params.operationId;
    const opts = { ...this.defaultOptions, ...params.options };

    return this.pollOperation<T>({
      jobId: rawJobId,
      stateLocation: params.stateLocation,
      contentLocation: params.contentLocation,
      pollStatusFn: params.pollStatusFn,
      fetchContentFn: params.fetchContentFn,
      options: opts,
    });
  }

  /**
   * Internal polling loop with exponential backoff and max attempts limit (§5.7).
   */
  private async pollOperation<T>(params: {
    jobId: string;
    stateLocation: string;
    contentLocation?: string;
    pollStatusFn: (jobId: string, stateLocation: string) => Promise<VismaBackgroundJobResponse>;
    fetchContentFn: (contentLocation: string) => Promise<T>;
    options: Required<VismaBackgroundOptions>;
  }): Promise<VismaBackgroundResult<T>> {
    const { jobId, stateLocation, pollStatusFn, fetchContentFn, options } = params;
    const operationId = VismaBackgroundManager.formatOperationId(jobId);

    let currentDelay = options.initialDelayMs;
    let attempts = 0;

    while (attempts < options.maxAttempts) {
      attempts++;

      // Wait backoff interval
      await options.sleepFn(currentDelay);

      // Query current status
      const jobStatus = await pollStatusFn(jobId, stateLocation);

      if (jobStatus.status === 'Completed') {
        const targetContent = jobStatus.contentLocation || params.contentLocation;
        if (!targetContent) {
          throw new Error(`Visma arka plan operasyonu (${jobId}) tamamlandı ancak contentLocation eksik.`);
        }
        const data = await fetchContentFn(targetContent);
        return {
          status: 'completed',
          operationId,
          data,
        };
      }

      if (jobStatus.status === 'Failed') {
        return {
          status: 'failed',
          operationId,
          errorMessage:
            jobStatus.errorMessage || `Visma arka plan operasyonu (${jobId}) sunucuda hata ile sonuçlandı.`,
        };
      }

      // Still 'Queued' or 'Running': compute next backoff delay
      currentDelay = Math.min(currentDelay * options.backoffMultiplier, options.maxDelayMs);
    }

    // Max attempts reached without completion:
    // DO NOT CRASH or tight-loop (§3.2, §5.7). Defer job and keep status 'pending'.
    return {
      status: 'pending',
      operationId,
      deferred: true,
      errorMessage: `Visma operasyonu (${jobId}) azami yoklama sınırına (${options.maxAttempts} deneme) ulaştı. Belge uçuşta (pending) bırakıldı ve kuyrukta ertelendi.`,
    };
  }
}
