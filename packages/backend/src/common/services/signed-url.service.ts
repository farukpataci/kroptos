import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import * as crypto from 'crypto';

export interface SignedUrlPayload {
  tenantPublicId: string;
  filePublicId: string;
  purpose: 'shipping-label' | 'invoice-pdf' | 'export-csv';
  expiresAt: number; // Unix timestamp in milliseconds
}

@Injectable()
export class SignedUrlService {
  private readonly secretKey = process.env.JWT_SECRET || 'kroptos-super-secret-key-12903';

  /**
   * Generates a secure HMAC-signed base64 token with specific limits
   */
  generateSignedToken(tenantPublicId: string, filePublicId: string, purpose: SignedUrlPayload['purpose']): string {
    let durationMinutes = 10;
    if (purpose === 'invoice-pdf') durationMinutes = 15;
    if (purpose === 'export-csv') durationMinutes = 30;

    const expiresAt = Date.now() + durationMinutes * 60 * 1000;
    const payload: SignedUrlPayload = {
      tenantPublicId,
      filePublicId,
      purpose,
      expiresAt,
    };

    const payloadStr = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', this.secretKey)
      .update(payloadStr)
      .digest('hex');

    const tokenData = {
      payloadStr,
      signature,
    };

    return Buffer.from(JSON.stringify(tokenData)).toString('base64');
  }

  /**
   * Decodes, verifies signature, and checks expiration of signed token
   */
  validateToken(token: string): SignedUrlPayload {
    try {
      const decodedStr = Buffer.from(token, 'base64').toString('utf-8');
      const decoded = JSON.parse(decodedStr);
      const { payloadStr, signature } = decoded;

      // Verify signature integrity
      const expectedSignature = crypto
        .createHmac('sha256', this.secretKey)
        .update(payloadStr)
        .digest('hex');

      if (signature !== expectedSignature) {
        throw new ForbiddenException('Invalid token signature');
      }

      const payload: SignedUrlPayload = JSON.parse(payloadStr);

      // Verify expiration window
      if (Date.now() > payload.expiresAt) {
        throw new ForbiddenException('Signed URL token has expired');
      }

      return payload;
    } catch (err) {
      if (err instanceof ForbiddenException) throw err;
      throw new BadRequestException('Malformed signed URL token');
    }
  }
}
