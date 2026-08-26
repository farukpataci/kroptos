'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

const fetcher = (url: string) => apiFetch(url);

export function LogoStockSettingsForm() {
  const toast = useToast();
  const { data: settings, error, mutate } = useSWR('/logo-stock/settings', fetcher, {
    fallbackData: {
      isActive: true,
      connectionType: 'SQL',
      companyNo: '001',
      periodNo: '01',
      erpDepotCodes: ['0', '1', '2'],
      erpStockCardField: 'CODE',
      erpBarcodeField: 'BARCODE',
      variantTracking: false,
      lotTracking: false,
      syncPeriodMinutes: 30,
      syncDirection: 'READ'
    }
  });

  const [formData, setFormData] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

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
      await apiFetch('/logo-stock/settings', {
        method: 'PUT',
        body: JSON.stringify(formData)
      });
      mutate(formData);
      toast.success('Logo ERP stock integration settings updated successfully.');
    } catch (err: any) {
      toast.error(err.message || 'Update error.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!formData) return <div className="animate-pulse h-64 bg-gray-50 rounded-lg"></div>;

  return (
    <form onSubmit={handleSave} className="space-y-6 w-full">
      <div>
        <h3 className="text-lg font-medium leading-6 text-gray-900">Logo / ERP Stock Integration</h3>
        <p className="mt-1 text-sm text-gray-500">Configure Logo ERP stock card synchronization and warehouse mappings here.</p>
      </div>

      <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
        <div className="flex items-center">
          <input type="checkbox" name="isActive" checked={formData.isActive} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
          <label className="ml-2 block text-sm text-gray-900">Enable Logo Integration</label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Connection Type</label>
          <div className="mt-1">
            <select name="connectionType" value={formData.connectionType} onChange={handleChange} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
              <option value="SQL">SQL Read Only</option>
              <option value="REST">REST API</option>
              <option value="UnityObjects">UnityObjects Worker</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Company Number</label>
          <div className="mt-1">
            <input type="text" name="companyNo" value={formData.companyNo} onChange={handleChange} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Period Number</label>
          <div className="mt-1">
            <input type="text" name="periodNo" value={formData.periodNo} onChange={handleChange} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Logo Stock Card Code Field</label>
          <div className="mt-1">
            <select name="erpStockCardField" value={formData.erpStockCardField} onChange={handleChange} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
              <option value="CODE">CODE (Stock Code)</option>
              <option value="BARCODE">BARCODE</option>
              <option value="SPECODE">SPECODE (Special Code)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Stock Reading Period (Minutes)</label>
          <div className="mt-1">
            <input type="number" name="syncPeriodMinutes" value={formData.syncPeriodMinutes} onChange={handleChange} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
          </div>
        </div>

        <div className="flex items-center">
          <input type="checkbox" name="variantTracking" checked={formData.variantTracking} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
          <label className="ml-2 block text-sm text-gray-900">Enable Variant Tracking</label>
        </div>

        <div className="flex items-center">
          <input type="checkbox" name="lotTracking" checked={formData.lotTracking} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
          <label className="ml-2 block text-sm text-gray-900">Lot / Serial Number Tracking</label>
        </div>
      </div>

      <div className="pt-5 border-t border-gray-200 flex justify-end gap-3">
        <button type="submit" disabled={isSaving} className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50">
          {isSaving ? 'Saving...' : 'Update Integration'}
        </button>
      </div>
    </form>
  );
}
