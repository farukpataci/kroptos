import { Injectable, HttpException, HttpStatus } from '@nestjs/common';

/**
 * Carries the upstream response through to the caller. Connectors need to tell
 * "your API key is wrong" (401) apart from "you are going too fast" (429) and
 * "the marketplace is down" (5xx); a single BAD_GATEWAY collapses all three
 * into one unusable message.
 */
export class MarketplaceHttpError extends HttpException {
  constructor(
    message: string,
    status: HttpStatus,
    readonly upstreamStatus?: number,
    readonly upstreamBody?: string,
  ) {
    super(message, status);
  }
}

/** 4xx answers are the caller's fault and will fail identically on a retry. */
function isRetryable(upstreamStatus?: number): boolean {
  if (upstreamStatus === undefined) return true; // network error or timeout
  if (upstreamStatus === 429) return true; // throttled: backing off is the fix
  return upstreamStatus >= 500;
}

@Injectable()
export class MarketplaceHttpClient {
  private defaultTimeoutMs = 10000;

  async request<T>(
    url: string,
    options: RequestInit & { timeout?: number; retries?: number } = {},
  ): Promise<T> {
    const { timeout = this.defaultTimeoutMs, retries = 3, ...fetchOptions } = options;

    let attempt = 0;
    let lastError: MarketplaceHttpError | undefined;

    while (attempt < retries) {
      attempt++;
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          ...fetchOptions,
          signal: controller.signal,
        });

        clearTimeout(id);

        if (!response.ok) {
          // The body usually explains why far better than the status text does,
          // so it travels with the error instead of being discarded.
          const body = await response.text().catch(() => '');
          throw new MarketplaceHttpError(
            `Marketplace HTTP Request failed with status ${response.status}: ${response.statusText}`,
            HttpStatus.BAD_GATEWAY,
            response.status,
            body.slice(0, 2000),
          );
        }

        // A 204 or an empty body is a valid answer for write endpoints.
        const text = await response.text();
        return (text ? JSON.parse(text) : undefined) as T;
      } catch (error: any) {
        clearTimeout(id);

        if (error instanceof MarketplaceHttpError) {
          lastError = error;
        } else if (error.name === 'AbortError') {
          lastError = new MarketplaceHttpError(
            'Marketplace Request Timeout',
            HttpStatus.GATEWAY_TIMEOUT,
          );
        } else {
          lastError = new MarketplaceHttpError(
            `Marketplace request error: ${error.message || error}`,
            HttpStatus.BAD_GATEWAY,
          );
        }

        // Hammering a marketplace with a request it already rejected can get the
        // seller account rate-limited or blocked, so only retry what can heal.
        if (!isRetryable(lastError.upstreamStatus) || attempt >= retries) {
          throw lastError;
        }

        // Exponential backoff delay
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 100));
      }
    }

    throw (
      lastError ??
      new MarketplaceHttpError(
        'Marketplace HTTP Request failed after retries',
        HttpStatus.BAD_GATEWAY,
      )
    );
  }
}
