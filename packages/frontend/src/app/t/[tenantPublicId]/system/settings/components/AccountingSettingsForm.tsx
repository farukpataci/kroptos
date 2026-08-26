'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

const fetcher = (url: string) => apiFetch(url);

export function AccountingSettingsForm() {
  const { data: tenantSettings, error, mutate } = useSWR<any>('/system/tenant-settings', fetcher);
  const toast = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<any>(null);

  // Sync state when data loads
  if (tenantSettings && !formData) {
    setFormData({
      defaultInvoiceType: tenantSettings.defaultInvoiceType || 'e-archive',
      defaultAccountingId: tenantSettings.defaultAccountingId || '',
      autoInvoice: tenantSettings.settings?.accounting?.autoInvoice || false,
      vatRate: tenantSettings.settings?.accounting?.vatRate || 20,
    });
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev: any) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        ...tenantSettings,
        defaultInvoiceType: formData.defaultInvoiceType,
        defaultAccountingId: formData.defaultAccountingId,
        settings: {
          ...(tenantSettings.settings || {}),
          accounting: {
            autoInvoice: formData.autoInvoice,
            vatRate: Number(formData.vatRate),
          },
        },
      };
      await apiFetch('/system/tenant-settings', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      mutate(payload);
      toast.success('Accounting settings saved.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  if (error) return <div className="text-red-500">Failed to load accounting settings.</div>;
  if (!formData) return <div className="animate-pulse h-64 bg-gray-100 rounded-lg"></div>;

  return (
    <form onSubmit={handleSave} className="space-y-6 w-full">
      <div>
        <h3 className="text-lg font-medium leading-6 text-gray-900">Accounting & Invoice Settings</h3>
        <p className="mt-1 text-sm text-gray-500">Manage ERP tax synchronization, E-Archive/E-Invoice options, and tax buffer rules.</p>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Default Invoice Type</label>
            <select
              name="defaultInvoiceType"
              value={formData.defaultInvoiceType || 'e-archive'}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="e-archive">E-Archive Invoice (E-Arşiv Fatura)</option>
              <option value="e-invoice">E-Invoice (E-Fatura)</option>
              <option value="printed">Printed Invoice (Kağıt Fatura)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">ERP Accounting ID / Company No</label>
            <input
              type="text"
              name="defaultAccountingId"
              value={formData.defaultAccountingId || ''}
              onChange={handleChange}
              placeholder="e.g. 001, 100"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
        </div>

        <div className="flex items-start pt-2">
          <div className="flex h-5 items-center">
            <input
              id="autoInvoice"
              name="autoInvoice"
              type="checkbox"
              checked={formData.autoInvoice || false}
              onChange={handleChange}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
          </div>
          <div className="ml-3 text-sm">
            <label htmlFor="autoInvoice" className="font-medium text-gray-700">Automatic E-Invoice Issue</label>
            <p className="text-gray-500">Instantly issue official e-invoice/e-archive document once the order status is marked as Dispatched.</p>
          </div>
        </div>

        <div className="w-1/2">
          <label className="block text-sm font-medium text-gray-700">Default VAT Rate (%)</label>
          <select
            name="vatRate"
            value={formData.vatRate || 20}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value={0}>0% (Tax Exempt)</option>
            <option value={1}>1%</option>
            <option value={10}>10%</option>
            <option value={20}>20% (Standard)</option>
          </select>
        </div>
      </div>

      <div className="pt-5 border-t border-gray-200 flex justify-end gap-3">
        <button
          type="button"
          onClick={() => setFormData(null)}
          className="rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        >
          Reset
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </form>
  );
}
