'use client';

import { useState } from 'react';
import { GeneralSettingsForm } from './components/GeneralSettingsForm';
import { UsersTable } from './components/UsersTable';
import { RoleList } from './components/RoleList';
import { TenantSettingsForm } from './components/TenantSettingsForm';
import { IntegrationSettingsGrid } from './components/IntegrationSettingsGrid';
import { OrderSettingsForm } from './components/OrderSettingsForm';
import { WarehouseSettingsForm } from './components/WarehouseSettingsForm';
import { ShippingSettingsForm } from './components/ShippingSettingsForm';
import { AccountingSettingsForm } from './components/AccountingSettingsForm';
import { NotificationSettingsForm } from './components/NotificationSettingsForm';
import { SecuritySettingsForm } from './components/SecuritySettingsForm';
import { AuditLogsShortcutPanel } from './components/AuditLogsShortcutPanel';

const tabs = [
  { id: 'general', label: 'General Settings' },
  { id: 'users', label: 'Users' },
  { id: 'roles', label: 'Roles & Permissions' },
  { id: 'tenant', label: 'Company / Tenant Settings' },
  { id: 'integrations', label: 'Integration Settings' },
  { id: 'orders', label: 'Order Settings' },
  { id: 'warehouse', label: 'Warehouse Settings' },
  { id: 'shipping', label: 'Shipping Settings' },
  { id: 'accounting', label: 'Accounting Settings' },
  { id: 'notifications', label: 'Notification Settings' },
  { id: 'security', label: 'Security Settings' },
  { id: 'audit', label: 'Audit & Logs' },
];

export default function SystemSettingsPage() {
  const [activeTab, setActiveTab] = useState('general');

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex flex-col space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">System Settings</h2>
        <p className="text-gray-500">Configure users, roles, permissions, and system preferences.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 mt-6">
        {/* Vertical Tabs Sidebar */}
        <div className="w-full lg:w-64 flex-shrink-0">
          <nav className="flex lg:flex-col space-x-2 lg:space-x-0 lg:space-y-1 overflow-x-auto pb-2 lg:pb-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap px-4 py-2 text-sm font-medium rounded-lg transition-colors text-left ${
                  activeTab === tab.id
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 min-h-[500px]">
          {activeTab === 'general' && <GeneralSettingsForm />}
          {activeTab === 'users' && <UsersTable />}
          {activeTab === 'roles' && <RoleList />}
          {activeTab === 'tenant' && <TenantSettingsForm />}
          {activeTab === 'integrations' && <IntegrationSettingsGrid />}
          {activeTab === 'orders' && <OrderSettingsForm />}
          {activeTab === 'warehouse' && <WarehouseSettingsForm />}
          {activeTab === 'shipping' && <ShippingSettingsForm />}
          {activeTab === 'accounting' && <AccountingSettingsForm />}
          {activeTab === 'notifications' && <NotificationSettingsForm />}
          {activeTab === 'security' && <SecuritySettingsForm />}
          {activeTab === 'audit' && <AuditLogsShortcutPanel />}
        </div>
      </div>
    </div>
  );
}
