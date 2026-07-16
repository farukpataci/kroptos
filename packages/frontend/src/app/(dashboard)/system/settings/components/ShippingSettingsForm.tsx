'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { apiFetch } from '@/lib/api';

const fetcher = (url: string) => apiFetch(url);

export function ShippingSettingsForm() {
  const { data: tenantSettings, error, mutate } = useSWR<any>('/system/tenant-settings', fetcher);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<any>(null);

  // Sync state when data loads
  if (tenantSettings && !formData) {
    setFormData({
      defaultShippingCarrier: tenantSettings.defaultShippingCarrier || '',
      autoLabelEnabled: tenantSettings.settings?.shipping?.autoLabelEnabled || false,
      trackingEmailEnabled: tenantSettings.settings?.shipping?.trackingEmailEnabled || false,
      shippingCarrierApiKeys: tenantSettings.settings?.shipping?.shippingCarrierApiKeys || {},
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
        defaultShippingCarrier: formData.defaultShippingCarrier,
        settings: {
          ...(tenantSettings.settings || {}),
          shipping: {
            autoLabelEnabled: formData.autoLabelEnabled,
            trackingEmailEnabled: formData.trackingEmailEnabled,
            shippingCarrierApiKeys: formData.shippingCarrierApiKeys,
          },
        },
      };
      await apiFetch('/system/tenant-settings', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      mutate(payload);
      alert('Shipping settings saved.');
    } catch (err: any) {
      alert(err.message || 'Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  if (error) return <div className="text-red-500">Failed to load shipping settings.</div>;
  if (!formData) return <div className="animate-pulse h-64 bg-gray-100 rounded-lg"></div>;

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-lg font-medium leading-6 text-gray-900">Shipping Settings</h3>
        <p className="mt-1 text-sm text-gray-500">Configure default shipping carriers, label printing automations, and tracking alerts.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Default Shipping Carrier</label>
          <select
            name="defaultShippingCarrier"
            value={formData.defaultShippingCarrier || ''}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="">Select a default carrier...</option>
            <option value="yurtici">Yurtiçi Kargo</option>
            <option value="aras">Aras Kargo</option>
            <option value="mng">MNG Kargo</option>
            <option value="dhl">DHL Express</option>
            <option value="fedex">FedEx</option>
            <option value="ups">UPS</option>
          </select>
        </div>

        <div className="flex items-start pt-2">
          <div className="flex h-5 items-center">
            <input
              id="autoLabelEnabled"
              name="autoLabelEnabled"
              type="checkbox"
              checked={formData.autoLabelEnabled || false}
              onChange={handleChange}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
          </div>
          <div className="ml-3 text-sm">
            <label htmlFor="autoLabelEnabled" className="font-medium text-gray-700">Auto-Generate Shipping Labels</label>
            <p className="text-gray-500">Generate shipping integration codes and print barcode slips immediately when order is approved.</p>
          </div>
        </div>

        <div className="flex items-start">
          <div className="flex h-5 items-center">
            <input
              id="trackingEmailEnabled"
              name="trackingEmailEnabled"
              type="checkbox"
              checked={formData.trackingEmailEnabled || false}
              onChange={handleChange}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
          </div>
          <div className="ml-3 text-sm">
            <label htmlFor="trackingEmailEnabled" className="font-medium text-gray-700">Send Tracking Codes to Clients</label>
            <p className="text-gray-500">Automatically send SMS/Email notifications to final customers once shipping label is active.</p>
          </div>
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
