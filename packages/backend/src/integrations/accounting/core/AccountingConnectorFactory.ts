import { BadRequestException, Injectable } from '@nestjs/common';
import { AccountingConnector } from './AccountingConnector';
import { AccountingEnvironment } from './AccountingTypes';
import { ParasutConnector } from '../parasut/parasut.connector';

@Injectable()
export class AccountingConnectorFactory {
  create(
    provider: string,
    credentials: Record<string, any>,
    environment: AccountingEnvironment = 'MOCK',
  ): AccountingConnector {
    const p = provider.toUpperCase();
    switch (p) {
      case 'PARASUT':
        return new ParasutConnector(credentials, environment);
      default:
        throw new BadRequestException(`Desteklenmeyen muhasebe sağlayıcısı: ${provider}`);
    }
  }
}
