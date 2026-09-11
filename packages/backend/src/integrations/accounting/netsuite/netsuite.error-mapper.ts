import { HttpException, ForbiddenException } from '@nestjs/common';
import {
  AccountingApiError,
  AccountingAuthError,
  AccountingRateLimitError,
} from '../core/AccountingErrors';

export interface NetSuiteApiErrorDetail {
  code?: string;
  message?: string;
  'o:errorDetails'?: Array<{
    'o:errorCode'?: string;
    'o:errorPath'?: string;
    detail?: string;
  }>;
  title?: string;
  status?: number;
  [key: string]: any;
}

/**
 * NetSuite Hata Eşleyicisi (§5.3, §5.10)
 *
 * KRİTİK AYRIMLAR (§5.10):
 * - 401 Unauthorized: Bizim tarafımızdaki kimlik hatası (JWT, Client ID, Sertifika veya imza sorunu).
 * - 403 Forbidden: Müşteri tarafındaki NetSuite rol izni hatası (Entegrasyona atanan NetSuite rolünün izni eksik).
 * - 429 Too Many Requests / SSS_REQUEST_LIMIT_EXCEEDED: Hesap genelinde paylaşılan eşzamanlılık havuzu doldu (§5.3).
 */
export class NetSuiteErrorMapper {
  static map(
    status: number,
    errorBody?: NetSuiteApiErrorDetail | any,
    retryAfterHeader?: string | number | null,
  ): HttpException {
    let rawMsg = 'NetSuite API Hatası';
    let errorCode = '';

    if (errorBody) {
      if (typeof errorBody === 'string') {
        rawMsg = errorBody;
      } else if (errorBody['o:errorDetails'] && Array.isArray(errorBody['o:errorDetails'])) {
        const details = errorBody['o:errorDetails']
          .map((d: any) => d.detail || d['o:errorCode'] || '')
          .filter(Boolean);
        rawMsg = details.join('; ') || errorBody.title || rawMsg;
        errorCode = errorBody['o:errorDetails'][0]?.['o:errorCode'] || '';
      } else if (errorBody.message) {
        rawMsg = String(errorBody.message);
        errorCode = errorBody.code || '';
      } else if (errorBody.title) {
        rawMsg = String(errorBody.title);
      }
    }

    switch (status) {
      // 401 = Kimlik Doğrulama Hatası (Bizim Tarafımız - §5.10)
      case 401:
        return new AccountingAuthError(
          'netsuite',
          `NetSuite kimlik doğrulama başarısız (HTTP 401). İmzalı JWT assertion, Client ID veya Sertifika (kid) geçersiz/uyumsuz. Lütfen entegrasyon kimlik ayarlarını kontrol ediniz. Detay: ${rawMsg}`,
        );

      // 403 = NetSuite Rol İzni Eksikliği (Müşteri Tarafı - §5.10)
      case 403:
        return new ForbiddenException(
          `[NetSuite Rol İzni Eksik] Erişim engellendi (HTTP 403). NetSuite'te bu entegrasyona atanan ROLÜN ilgili kayda (Customer/Invoice vb.) okuma/yazma izni bulunmuyor. Müşteri sistem yöneticisinin Setup > Integration > Manage Integrations altından rol izinlerini genişletmesi gerekir. Detay: ${rawMsg}`,
        );

      // 429 = Hesap Genelinde Paylaşılan Eşzamanlılık Havuzu Aşımı (§5.3)
      case 429: {
        let retryAfterSeconds: number | undefined;
        if (retryAfterHeader !== undefined && retryAfterHeader !== null) {
          const seconds = parseInt(String(retryAfterHeader), 10);
          if (!isNaN(seconds) && seconds > 0) {
            retryAfterSeconds = seconds;
          }
        }
        return new AccountingRateLimitError('netsuite', retryAfterSeconds);
      }

      default:
        // Eşzamanlılık hatası SuiteScript kodundan dönmüşse (SSS_REQUEST_LIMIT_EXCEEDED)
        if (
          errorCode === 'SSS_REQUEST_LIMIT_EXCEEDED' ||
          rawMsg.includes('SSS_REQUEST_LIMIT_EXCEEDED') ||
          rawMsg.includes('concurrency')
        ) {
          return new AccountingRateLimitError('netsuite', 5);
        }

        return new AccountingApiError('netsuite', status, rawMsg, errorBody);
    }
  }
}
