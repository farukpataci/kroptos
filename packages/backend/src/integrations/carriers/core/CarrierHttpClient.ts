import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import {
  classifyTransportFailure,
  TransportFailure,
} from '../../marketplaces/core/MarketplaceHttpClient';

/**
 * Carries the upstream answer to the connector. A carrier's 401 (wrong
 * customer code), 429 (quota) and 500 (their gateway is down) need three
 * different sentences in the UI, so the status survives the throw.
 */
export class CarrierHttpError extends HttpException {
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

/** Path only: a query string can carry a customer code into the logs. */
function describeTarget(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return url.split('?')[0];
  }
}

export interface CarrierRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  /** Per-attempt timeout. Public carriers (PTT) answer slowly; raise it there. */
  timeoutMs?: number;
}

/**
 * Transport for carrier APIs.
 *
 * Deliberately thinner than the marketplace client and split in two: half the
 * Turkish carriers still speak SOAP, and a client that JSON-parses every answer
 * cannot talk to them at all. Both paths share one fetch so timeout handling
 * and failure classification exist once.
 *
 * No retry. A shipment creation is not idempotent unless the carrier honours a
 * reference code, and replaying it is how one order gets two barcodes; the
 * retry policy belongs to the caller that knows which of the two it is.
 */
@Injectable()
export class CarrierHttpClient {
  private readonly defaultTimeoutMs = 15000;

  /** Raw text response — the SOAP/XML path, and the base for `json`. */
  async request(url: string, options: CarrierRequestOptions = {}): Promise<string> {
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

      const text = await response.text().catch(() => '');
      if (!response.ok) {
        throw new CarrierHttpError(
          `${label} → ${response.status} ${response.statusText}`.trim(),
          HttpStatus.BAD_GATEWAY,
          response.status,
          text.slice(0, 2000),
        );
      }
      return text;
    } catch (error: any) {
      if (error instanceof CarrierHttpError) throw error;

      const failure = classifyTransportFailure(error);
      throw new CarrierHttpError(
        `${label} → ${failure === 'timeout' ? 'istek zaman aşımına uğradı' : 'bağlantı kurulamadı'} (${
          error?.cause?.message || error?.message || failure
        })`,
        failure === 'timeout' ? HttpStatus.GATEWAY_TIMEOUT : HttpStatus.BAD_GATEWAY,
        undefined,
        undefined,
        failure,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  /** REST path. An empty body is a valid answer for write endpoints. */
  async json<T>(url: string, options: CarrierRequestOptions = {}): Promise<T> {
    const text = await this.request(url, {
      ...options,
      headers: { Accept: 'application/json', ...(options.headers ?? {}) },
    });
    if (!text) return undefined as T;

    try {
      return JSON.parse(text) as T;
    } catch {
      // A login page or WAF answering 200 with HTML: saying so beats a raw
      // SyntaxError that reads like a bug in our own parser.
      throw new CarrierHttpError(
        `${describeTarget(url)} → yanıt JSON değil: ${text.trim().replace(/\s+/g, ' ').slice(0, 200)}`,
        HttpStatus.BAD_GATEWAY,
        200,
        text.slice(0, 2000),
      );
    }
  }

  /**
   * SOAP path: posts an envelope and hands back the raw XML. Parsing is the
   * connector's job — each carrier's WSDL nests its payload differently, and a
   * generic XML-to-object step would only hide that.
   */
  async soap(
    url: string,
    envelope: string,
    options: { soapAction?: string; timeoutMs?: number } = {},
  ): Promise<string> {
    return this.request(url, {
      method: 'POST',
      body: envelope,
      timeoutMs: options.timeoutMs,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        ...(options.soapAction ? { SOAPAction: `"${options.soapAction}"` } : {}),
      },
    });
  }
}
