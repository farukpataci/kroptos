import { Injectable, HttpException, HttpStatus } from '@nestjs/common';

@Injectable()
export class MarketplaceHttpClient {
  private defaultTimeoutMs = 10000;

  async request<T>(
    url: string,
    options: RequestInit & { timeout?: number; retries?: number } = {},
  ): Promise<T> {
    const { timeout = this.defaultTimeoutMs, retries = 3, ...fetchOptions } = options;

    let attempt = 0;
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
          throw new HttpException(
            `Marketplace HTTP Request failed with status ${response.status}: ${response.statusText}`,
            HttpStatus.BAD_GATEWAY,
          );
        }

        return (await response.json()) as T;
      } catch (error: any) {
        clearTimeout(id);
        if (attempt >= retries) {
          if (error.name === 'AbortError') {
            throw new HttpException('Marketplace Request Timeout', HttpStatus.GATEWAY_TIMEOUT);
          }
          throw new HttpException(
            `Marketplace request error: ${error.message || error}`,
            HttpStatus.BAD_GATEWAY,
          );
        }
        // Exponential backoff delay
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 100));
      }
    }

    throw new HttpException('Marketplace HTTP Request failed after retries', HttpStatus.BAD_GATEWAY);
  }
}
