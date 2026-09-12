/**
 * Fatture in Cloud (TeamSystem) Error Mapper
 */

import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AccountingAuthError, AccountingRateLimitError } from '../core/AccountingErrors';
import { FIC_PROVIDER_NAME } from './fic.types';

export class FicErrorMapper {
  static mapError(error: any, context?: string): Error {
    const prefix = context ? `[FIC - ${context}] ` : '[FIC] ';
    const message = error?.message || 'Bilinmeyen Fatture in Cloud hatası';

    if (error instanceof AccountingRateLimitError || error instanceof AccountingAuthError) {
      return error;
    }

    if (error instanceof BadRequestException || error instanceof NotFoundException) {
      return error;
    }

    if (message.includes('429') || message.toLowerCase().includes('too many requests')) {
      return new AccountingRateLimitError(FIC_PROVIDER_NAME, 60);
    }

    if (message.includes('401') || message.includes('Unauthorized')) {
      return new UnauthorizedException(
        `${prefix}Yetkilendirme hatası (401). Access token geçersiz veya süresi dolmuş olabilir.`,
      );
    }

    if (message.includes('403') || message.includes('Forbidden')) {
      return new UnauthorizedException(
        `${prefix}Erişim engellendi (403). İlgili companyId için erişim izni bulunmuyor.`,
      );
    }

    if (message.includes('404') || message.includes('Not Found')) {
      return new NotFoundException(`${prefix}İstenen kaynak Fatture in Cloud üzerinde bulunamadı.`);
    }

    if (message.includes('409') || message.includes('Conflict')) {
      return new BadRequestException(
        `${prefix}Fatura tutarları uyuşmazlığı veya çakışma (409 Conflict): ${message}`,
      );
    }

    return new InternalServerErrorException(`${prefix}${message}`);
  }
}
