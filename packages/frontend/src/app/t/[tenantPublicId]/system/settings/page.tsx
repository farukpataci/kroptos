'use client';

import { useState } from 'react';
import { GeneralSettingsForm } from './components/GeneralSettingsForm';
import { UsersTable } from './components/UsersTable';
import { RoleList } from './components/RoleList';
import { TenantSettingsForm } from './components/TenantSettingsForm';
import { OrderSettingsForm } from './components/OrderSettingsForm';
import { WarehouseSettingsForm } from './components/WarehouseSettingsForm';
import { ShippingSettingsForm } from './components/ShippingSettingsForm';
import { AccountingSettingsForm } from './components/AccountingSettingsForm';
import { NotificationSettingsForm } from './components/NotificationSettingsForm';
import { SecuritySettingsForm } from './components/SecuritySettingsForm';
import { AuditLogsShortcutPanel } from './components/AuditLogsShortcutPanel';

const tabs = [
  { id: 'general', label: 'Genel Ayarlar' },
  { id: 'users', label: 'Kullanıcılar' },
  { id: 'roles', label: 'Roller & Yetkiler' },
  { id: 'tenant', label: 'Firma / Bayi Ayarları' },
  { id: 'orders', label: 'Sipariş Ayarları' },
  { id: 'warehouse', label: 'Depo Ayarları' },
  { id: 'shipping', label: 'Kargo Ayarları' },
  { id: 'accounting', label: 'Muhasebe Ayarları' },
  { id: 'notifications', label: 'Bildirim Ayarları' },
  { id: 'security', label: 'Güvenlik Ayarları' },
  { id: 'audit', label: 'Denetim & Günlükler' },
];

export default function SystemSettingsPage() {
  const [activeTab, setActiveTab] = useState('general');

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex flex-col space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Sistem Ayarları</h2>
        <p className="text-gray-500">Kullanıcıları, rolleri, yetkileri ve sistem tercihlerini yapılandırın.</p>
      </div>

      <div className="flex flex-col gap-6 mt-6">
        {/* Horizontal Tab Bar */}
        <div className="border-b border-gray-200">
          {/* Eleven tabs do not fit a narrow viewport; they scroll sideways
              rather than wrapping into a block that pushes the form down. */}
          <nav className="flex gap-1 overflow-x-auto -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content Area */}
        <div className="w-full bg-white p-6 rounded-2xl shadow-sm border border-gray-100 min-h-[500px]">
          {activeTab === 'general' && <GeneralSettingsForm />}
          {activeTab === 'users' && <UsersTable />}
          {activeTab === 'roles' && <RoleList />}
          {activeTab === 'tenant' && <TenantSettingsForm />}
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
