'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

const fetcher = (url: string) => apiFetch(url);

export function GeneralWarehouseSettingsForm() {
  const toast = useToast();
  const { data: settings, error, mutate } = useSWR('/system/warehouse-settings', fetcher, {
    fallbackData: {
      multiWarehouse: true,
      defaultWarehouse: 'Main Warehouse',
      defaultSource: 'hybrid',
      stockReservation: true,
      allowNegativeStock: false,
      barcodeRequired: true,
      packagingControl: true,
      autoStockDrop: 'order_received',
      reAddOnReturn: true
    }
  });

  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<any>(null);

  if (settings && !formData) setFormData(settings);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev: any) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await apiFetch('/system/warehouse-settings', {
        method: 'PUT',
        body: JSON.stringify(formData)
      });
      mutate(formData);
      toast.success('General warehouse settings saved successfully.');
    } catch (err: any) {
      toast.error(err.message || 'An error occurred.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!formData) return <div className="animate-pulse h-64 bg-gray-50 rounded-lg"></div>;

  return (
    <form onSubmit={handleSave} className="space-y-6 w-full">
      <div>
        <h3 className="text-lg font-medium leading-6 text-gray-900">General Warehouse Settings</h3>
        <p className="mt-1 text-sm text-gray-500">Configure how warehouses operate and their default stock statuses in the system.</p>
      </div>

      <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
        <div className="flex items-center">
          <input type="checkbox" name="multiWarehouse" checked={formData.multiWarehouse} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
          <label className="ml-2 block text-sm text-gray-900">Multi-Warehouse Management Active</label>
        </div>

        <div className="flex items-center">
          <input type="checkbox" name="stockReservation" checked={formData.stockReservation} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
          <label className="ml-2 block text-sm text-gray-900">Enable Stock Reservation on Orders</label>
        </div>

        <div className="flex items-center">
          <input type="checkbox" name="allowNegativeStock" checked={formData.allowNegativeStock} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
          <label className="ml-2 block text-sm text-gray-900">Allow Negative Stock Sales</label>
        </div>

        <div className="flex items-center">
          <input type="checkbox" name="barcodeRequired" checked={formData.barcodeRequired} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
          <label className="ml-2 block text-sm text-gray-900">Barcode Scanning Required</label>
        </div>

        <div className="flex items-center">
          <input type="checkbox" name="packagingControl" checked={formData.packagingControl} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
          <label className="ml-2 block text-sm text-gray-900">Packaging Control Active</label>
        </div>

        <div className="flex items-center">
          <input type="checkbox" name="reAddOnReturn" checked={formData.reAddOnReturn} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
          <label className="ml-2 block text-sm text-gray-900">Restock Returned Items</label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Default Warehouse</label>
          <div className="mt-1">
            <select name="defaultWarehouse" value={formData.defaultWarehouse} onChange={handleChange} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
              <option value="Main Warehouse">Main Warehouse</option>
              <option value="Virtual Depot">Virtual Depot</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Stock Deduction Trigger</label>
          <div className="mt-1">
            <select name="autoStockDrop" value={formData.autoStockDrop} onChange={handleChange} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
              <option value="order_received">On Order Received</option>
              <option value="packed">On Packaging Completed</option>
              <option value="invoiced">On Invoice Created</option>
              <option value="shipped">On Shipped</option>
              <option value="manual">Manual Approval</option>
            </select>
          </div>
        </div>
      </div>

      <div className="pt-5 border-t border-gray-200 flex justify-end gap-3">
        <button type="submit" disabled={isSaving} className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50">
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
