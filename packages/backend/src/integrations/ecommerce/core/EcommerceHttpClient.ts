import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import {
  classifyTransportFailure,
  TransportFailure,
} from '../../marketplaces/core/MarketplaceHttpClient';

export class EcommerceHttpError extends HttpException {
  constructor(
    message: string,
    status: HttpStatus,
    readonly upstreamStatus?: number,
    readonly upstreamBody?: string,
    readonly failureKind: TransportFailure = 'http',
  ) {
    super(message, status);
  }
}

function describeTarget(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return url.split('?')[0];
  }
}

export interface EcommerceRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

@Injectable()
export class EcommerceHttpClient {
  private readonly defaultTimeoutMs = 20000;

  async request(url: string, options: EcommerceRequestOptions = {}): Promise<string> {
    const method = String(options.method ?? 'GET').toUpperCase();
    const label = `${method} ${describeTarget(url)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? this.defaultTimeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers: options.headers,
        body: options.body,
        signal: controller.signal,
      });

      const text = await response.text();

      if (!response.ok) {
        const failureKind = classifyTransportFailure(response.status);
        throw new EcommerceHttpError(
          `${label} çağrısı ${response.status} koduyla başarısız oldu`,
          response.status >= 500 ? HttpStatus.BAD_GATEWAY : HttpStatus.BAD_REQUEST,
          response.status,
          text,
          failureKind,
        );
      }

      return text;
    } catch (err: any) {
      if (err instanceof EcommerceHttpError) throw err;
      if (err?.name === 'AbortError') {
        throw new EcommerceHttpError(
          `${label} zaman aşımına uğradı (${options.timeoutMs ?? this.defaultTimeoutMs}ms)`,
          HttpStatus.GATEWAY_TIMEOUT,
          undefined,
          undefined,
          'timeout',
        );
      }
      const failureKind = classifyTransportFailure(err);
      throw new EcommerceHttpError(
        `${label} ağ bağlantı hatası: ${err?.message || 'Bilinmeyen hata'}`,
        HttpStatus.BAD_GATEWAY,
        undefined,
        undefined,
        failureKind,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async json<T = any>(url: string, options: EcommerceRequestOptions = {}): Promise<T> {
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    };
    const text = await this.request(url, { ...options, headers });
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new EcommerceHttpError(
        `E-Ticaret servisi geçersiz JSON yanıtı döndürdü (${describeTarget(url)})`,
        HttpStatus.BAD_GATEWAY,
        200,
        text.slice(0, 500),
      );
    }
  }
}
