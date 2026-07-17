'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { apiFetch } from '@/lib/api';

const fetcher = (url: string) => apiFetch(url);

export function OrderSettingsForm() {
  const { data: tenantSettings, error, mutate } = useSWR<any>('/system/tenant-settings', fetcher);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<any>(null);

  // Sync state when data loads
  if (tenantSettings && !formData) {
    setFormData(tenantSettings.settings?.orders || {
      autoApprove: false,
      defaultStatus: 'pending',
      syncInterval: 15,
      autoRoutingEnabled: false,
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
        settings: {
          ...(tenantSettings.settings || {}),
          orders: formData,
        },
      };
      await apiFetch('/system/tenant-settings', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      mutate(payload);
      alert('Order settings saved.');
    } catch (err: any) {
      alert(err.message || 'Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  if (error) return <div className="text-red-500">Failed to load order settings.</div>;
  if (!formData) return <div className="animate-pulse h-64 bg-gray-100 rounded-lg"></div>;

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-lg font-medium leading-6 text-gray-900">Order Settings</h3>
        <p className="mt-1 text-sm text-gray-500">Configure order status workflows, synchronization, and approval mechanisms.</p>
      </div>

      <div className="space-y-4">
        <div className="flex items-start">
          <div className="flex h-5 items-center">
            <input
              id="autoApprove"
              name="autoApprove"
              type="checkbox"
              checked={formData.autoApprove || false}
              onChange={handleChange}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
          </div>
          <div className="ml-3 text-sm">
            <label htmlFor="autoApprove" className="font-medium text-gray-700">Auto-Approve Orders</label>
            <p className="text-gray-500">Automatically accept imported marketplace orders without manual review.</p>
          </div>
        </div>

        <div className="flex items-start">
          <div className="flex h-5 items-center">
            <input
              id="autoRoutingEnabled"
              name="autoRoutingEnabled"
              type="checkbox"
              checked={formData.autoRoutingEnabled || false}
              onChange={handleChange}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
          </div>
          <div className="ml-3 text-sm">
            <label htmlFor="autoRoutingEnabled" className="font-medium text-gray-700">Smart Order Routing</label>
            <p className="text-gray-500">Automatically assign orders to the nearest warehouse with available stock.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Default Order Import Status</label>
            <select
              name="defaultStatus"
              value={formData.defaultStatus || 'pending'}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="pending">Pending Review</option>
              <option value="processing">Approved / Processing</option>
              <option value="hold">On Hold</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Order Sync Interval (Minutes)</label>
            <select
              name="syncInterval"
              value={formData.syncInterval || 15}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value={5}>Every 5 Minutes</option>
              <option value={15}>Every 15 Minutes</option>
              <option value={30}>Every 30 Minutes</option>
              <option value={60}>Every Hour</option>
            </select>
          </div>
        </div>
      </div>

      <div className="pt-5 border-t border-gray-200 flex justify-end gap-3">
        <button
          type="button"
          onClick={() => setFormData(tenantSettings.settings?.orders || {})}
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
