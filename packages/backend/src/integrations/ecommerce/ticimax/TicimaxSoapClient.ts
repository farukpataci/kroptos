import { XMLParser } from 'fast-xml-parser';
import { BadRequestException, GatewayTimeoutException, HttpException, HttpStatus } from '@nestjs/common';
import { EcommerceHttpClient, EcommerceHttpError } from '../core/EcommerceHttpClient';

export class TicimaxSoapClient {
  private readonly parser: XMLParser;

  constructor(private readonly httpClient: EcommerceHttpClient) {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      removeNSPrefix: true,
      parseTagValue: false, // Keep values as strings/intact for precise parsing
    });
  }

  /**
   * Builds and executes a SOAP call against a Ticimax WCF endpoint.
   */
  async call<T = any>(
    serviceUrl: string,
    action: string,
    methodName: string,
    bodyXml: string,
    timeoutMs: number = 25000,
  ): Promise<T> {
    const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
  <soap:Header/>
  <soap:Body>
    <tem:${methodName}>
      ${bodyXml}
    </tem:${methodName}>
  </soap:Body>
</soap:Envelope>`;

    try {
      const responseXml = await this.httpClient.request(serviceUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: `"${action}"`,
        },
        body: envelope,
        timeoutMs,
      });

      return this.parseSoapResponse<T>(responseXml, methodName);
    } catch (err: any) {
      if (err instanceof EcommerceHttpError) {
        if (err.upstreamBody) {
          try {
            // Try extracting SOAP Fault details if available in upstream response body
            return this.parseSoapResponse<T>(err.upstreamBody, methodName);
          } catch (parseErr: any) {
            // Throw original error with descriptive message
            throw new HttpException(
              `Ticimax SOAP Servis Hatası (${serviceUrl}): ${err.message}`,
              err.getStatus(),
            );
          }
        }
        throw err;
      }
      throw err;
    }
  }

  /**
   * Parses XML and unwraps the SOAP Body and MethodResult.
   */
  public parseSoapResponse<T = any>(xmlText: string, methodName: string): T {
    if (!xmlText || typeof xmlText !== 'string') {
      throw new BadRequestException('Ticimax SOAP yanıtı boş veya geçersiz.');
    }

    const parsed = this.parser.parse(xmlText);
    const body = parsed?.Envelope?.Body || parsed?.Body;

    if (!body) {
      throw new BadRequestException('Ticimax SOAP yanıt gövdesi okunamadı.');
    }

    if (body.Fault) {
      const faultStr =
        body.Fault.faultstring ||
        body.Fault.faultcode ||
        'Bilinmeyen Ticimax SOAP Fault';
      throw new BadRequestException(`Ticimax SOAP Hatası: ${faultStr}`);
    }

    const responseWrapper =
      body[`${methodName}Response`] ||
      body[`${methodName}Result`] ||
      body;

    const result =
      responseWrapper[`${methodName}Result`] !== undefined
        ? responseWrapper[`${methodName}Result`]
        : responseWrapper;

    return result as T;
  }
}
