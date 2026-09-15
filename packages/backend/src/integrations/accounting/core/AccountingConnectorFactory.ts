import { Injectable } from '@nestjs/common';
import { AccountingConnector } from './AccountingConnector';
import { AccountingEnvironment } from './AccountingTypes';
import { AccountingProviderRegistry } from './AccountingProviderRegistry';

@Injectable()
export class AccountingConnectorFactory {
  /**
   * Registry tabanlı — SWITCH YOK. `ctx` (transport, companyKey, integrationId…) yalnızca
   * Agent rotasını destekleyen sağlayıcılara verilir; eski sağlayıcılarda 3. argüman mock override'ıdır.
   */
  create(
    provider: string,
    credentials: Record<string, any>,
    environment: AccountingEnvironment = 'MOCK',
    ctx?: Record<string, unknown>,
  ): AccountingConnector {
    const descriptor = AccountingProviderRegistry.get(provider);
    const ConnectorClass = descriptor.connectorClass;
    return descriptor.supportedRoutes?.length && ctx
      ? new ConnectorClass(credentials, environment, ctx)
      : new ConnectorClass(credentials, environment);
  }
}
