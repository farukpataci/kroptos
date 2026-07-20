'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

const fetcher = (url: string) => apiFetch(url);

export function TenantSettingsForm() {
  const { data: tenantSettings, error, mutate } = useSWR('/system/tenant-settings', fetcher);
  const toast = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<any>(null);

  if (tenantSettings && !formData) setFormData(tenantSettings);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await apiFetch('/system/tenant-settings', {
        method: 'PUT',
        body: JSON.stringify(formData),
      });
      mutate(formData);
      toast.success('Firma ayarları başarıyla kaydedildi.');
    } catch (err: any) {
      toast.error(err.message || 'Kaydedilirken bir hata oluştu.');
    } finally {
      setIsSaving(false);
    }
  };

  if (error) return <div className="text-red-500">Failed to load tenant settings.</div>;
  if (!formData) return <div className="animate-pulse h-64 bg-gray-100 rounded-lg"></div>;

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-4xl">
      <div>
        <h3 className="text-lg font-medium leading-6 text-gray-900">Firma / Tenant Ayarları</h3>
        <p className="mt-1 text-sm text-gray-500">İçinde bulunduğunuz çalışma alanına (Firma) ait yasal ve operasyonel ayarlar.</p>
      </div>

      <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700">Firma Unvanı (Yasal Ad)</label>
          <div className="mt-1">
            <input type="text" name="companyName" value={formData.companyName || ''} onChange={handleChange} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Vergi Dairesi</label>
          <div className="mt-1">
            <input type="text" name="taxOffice" value={formData.taxOffice || ''} onChange={handleChange} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Vergi Numarası / TCKN</label>
          <div className="mt-1">
            <input type="text" name="taxNumber" value={formData.taxNumber || ''} onChange={handleChange} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Telefon</label>
          <div className="mt-1">
            <input type="text" name="phone" value={formData.phone || ''} onChange={handleChange} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">E-posta</label>
          <div className="mt-1">
            <input type="email" name="email" value={formData.email || ''} onChange={handleChange} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
          </div>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700">Firma Adresi</label>
          <div className="mt-1">
            <input type="text" name="address" value={formData.address || ''} onChange={handleChange} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Varsayılan Kargo Firması</label>
          <div className="mt-1">
            <select name="defaultShippingCarrier" value={formData.defaultShippingCarrier || ''} onChange={handleChange} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
              <option value="">Seçiniz...</option>
              <option value="yurtici">Yurtiçi Kargo</option>
              <option value="aras">Aras Kargo</option>
              <option value="mng">MNG Kargo</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Varsayılan Fatura Tipi</label>
          <div className="mt-1">
            <select name="defaultInvoiceType" value={formData.defaultInvoiceType || 'e-archive'} onChange={handleChange} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
              <option value="e-archive">E-Arşiv Fatura</option>
              <option value="e-invoice">E-Fatura</option>
              <option value="printed">Kağıt Fatura</option>
            </select>
          </div>
        </div>
      </div>

      <div className="pt-5 border-t border-gray-200 flex justify-end gap-3">
        <button type="submit" disabled={isSaving} className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50">
          {isSaving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
        </button>
      </div>
    </form>
  );
}
