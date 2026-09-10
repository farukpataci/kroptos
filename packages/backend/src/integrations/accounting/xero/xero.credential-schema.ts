import { AccountingProviderSchema } from '../core/AccountingTypes';

export const XERO_CREDENTIAL_SCHEMA: AccountingProviderSchema = {
  provider: 'xero',
  name: 'Xero',
  fields: [
    {
      key: 'clientId',
      label: 'Client ID',
      type: 'text',
      required: true,
      description: 'Xero Developer App Client ID',
    },
    {
      key: 'clientSecret',
      label: 'Client Secret',
      type: 'password',
      required: true,
      description: 'Xero Developer App Client Secret',
    },
    {
      key: 'tenantId',
      label: 'Tenant ID (Organization)',
      type: 'text',
      required: true,
      description: 'Connected Xero Organization Tenant ID',
    },
    {
      key: 'tenantName',
      label: 'Organization Name',
      type: 'text',
      required: false,
      description: 'Connected Xero Organization Name',
    },
    {
      key: 'accountCode',
      label: 'Sales Account Code',
      type: 'text',
      required: false,
      defaultValue: '200',
      description: 'General Ledger sales account code (default: 200)',
    },
    {
      key: 'bankAccountCode',
      label: 'Bank Account Code',
      type: 'text',
      required: false,
      defaultValue: '090',
      description: 'General Ledger bank account code for payments (default: 090)',
    },
  ],
};
