import { Injectable } from '@nestjs/common';
import { AccountingConnector } from './AccountingConnector';
import { AccountingEnvironment } from './AccountingTypes';
import { AccountingProviderRegistry } from './AccountingProviderRegistry';

@Injectable()
export class AccountingConnectorFactory {
  create(
    provider: string,
    credentials: Record<string, any>,
    environment: AccountingEnvironment = 'MOCK',
  ): AccountingConnector {
    const descriptor = AccountingProviderRegistry.get(provider);
    const ConnectorClass = descriptor.connectorClass;
    return new ConnectorClass(credentials, environment);
  }
}
