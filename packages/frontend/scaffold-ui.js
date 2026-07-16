const fs = require('fs');
const path = require('path');

const compDir = 'c:/Users/Administrator/Desktop/kroptos/packages/frontend/src/app/(dashboard)/system/settings/components';

fs.mkdirSync(compDir, { recursive: true });

const components = [
  'GeneralSettingsForm',
  'UsersTable',
  'RoleList',
  'TenantSettingsForm',
  'IntegrationSettingsGrid',
  'OrderSettingsForm',
  'WarehouseSettingsForm',
  'ShippingSettingsForm',
  'AccountingSettingsForm',
  'NotificationSettingsForm',
  'SecuritySettingsForm',
  'AuditLogsShortcutPanel'
];

for (const comp of components) {
  const compCode = `export function ${comp}() {
  return (
    <div>
      <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">${comp.replace(/([A-Z])/g, ' $1').trim()}</h3>
      <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
        This section is under construction. API integration is required.
      </div>
    </div>
  );
}
`;
  fs.writeFileSync(path.join(compDir, `${comp}.tsx`), compCode);
}
console.log('UI Scaffolded successfully.');
