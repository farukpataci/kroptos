/**
 * Fatture in Cloud (TeamSystem) Electronic Invoicing Engine
 * Reference: §2.1, §3.2, §4, §5.1, §5.8
 *
 * CRITICAL LEGAL CONSTRAINTS:
 * 1. SdI SENDING ENDPOINT MUST NEVER BE CALLED IN THIS PHASE.
 * 2. ONLY DRY_RUN / XML VERIFICATION IS PERMITTED.
 * 3. ei_status polling uses exponential backoff with max 5 attempts and 60s cap.
 *    No tight loops!
 */

import { BadRequestException } from '@nestjs/common';
import { FicHttpClient } from './fic.client';
import { FicStatusMapper } from './fic.status-mapper';
import { FicEiStatus } from './fic.types';

export interface FicEInvoiceVerificationResult {
  verified: boolean;
  eiStatus: string;
  error?: string;
  rejectionReason?: string;
  details?: Record<string, any>;
}

export class FicEInvoiceService {
  /**
   * Strictly verifies electronic invoice XML via dry_run without transmitting to SdI (§5.8).
   * Calls GET /c/{company_id}/issued_documents/{document_id}/e_invoice/xml_verify
   */
  static async verifyXmlDryRun(
    client: FicHttpClient,
    companyId: string | number,
    documentId: string | number,
  ): Promise<FicEInvoiceVerificationResult> {
    try {
      const response = await client.verifyEInvoiceXml(companyId, documentId);
      const isSuccess = response?.data?.success === true;

      // Also read current ei_status
      const docRes = await client.getIssuedDocument(companyId, documentId, true);
      const eiStatus = FicStatusMapper.sanitizeEiStatus(docRes?.data?.ei_status);

      return {
        verified: isSuccess,
        eiStatus,
        error: isSuccess ? undefined : response?.data?.error || 'XML doğrulama başarısız oldu.',
        details: response?.data?.extra,
      };
    } catch (err: any) {
      return {
        verified: false,
        eiStatus: 'error',
        error: err.message || 'E-Fatura XML doğrulama servisi çağrılamadı.',
      };
    }
  }

  /**
   * Polls ei_status with strict exponential backoff and max attempts limit (§4).
   * Sıkı döngü (tight loop) kesinlikle yasaktır.
   */
  static async pollEiStatusWithBackoff(
    client: FicHttpClient,
    companyId: string | number,
    documentId: string | number,
    options: {
      maxAttempts?: number;
      initialDelayMs?: number;
      maxDelayMs?: number;
      targetStatuses?: FicEiStatus[];
    } = {},
  ): Promise<{ eiStatus: string; attempts: number; reachedTarget: boolean }> {
    const maxAttempts = options.maxAttempts ?? 5;
    const initialDelayMs = options.initialDelayMs ?? 2000;
    const maxDelayMs = options.maxDelayMs ?? 60000;
    const targetStatuses = options.targetStatuses ?? ['accepted', 'rejected', 'error', 'discarded'];

    let currentDelay = initialDelayMs;
    let attempts = 0;
    let latestStatus = 'not_sent';

    while (attempts < maxAttempts) {
      attempts++;

      // Wait before polling
      await new Promise((resolve) => setTimeout(resolve, currentDelay));

      const docRes = await client.getIssuedDocument(companyId, documentId, true);
      latestStatus = FicStatusMapper.sanitizeEiStatus(docRes?.data?.ei_status);

      if (targetStatuses.includes(latestStatus as FicEiStatus)) {
        return {
          eiStatus: latestStatus,
          attempts,
          reachedTarget: true,
        };
      }

      // Exponential backoff
      currentDelay = Math.min(currentDelay * 2, maxDelayMs);
    }

    return {
      eiStatus: latestStatus,
      attempts,
      reachedTarget: false,
    };
  }

  /**
   * Explicitly blocks any attempt to call the live SdI sending endpoint.
   * (§5.1: Pazarlığa kapalı kural)
   */
  static sendToSdi(): never {
    throw new BadRequestException(
      'YASAK: SdI e-fatura gönderme ucu bu fazda kesinlikle kapalıdır (§2.1, §5.1). Fatura verisi hazırlanmış olup resmi gönderim Fatture in Cloud portalı üzerinden yapılmalıdır.',
    );
  }
}
