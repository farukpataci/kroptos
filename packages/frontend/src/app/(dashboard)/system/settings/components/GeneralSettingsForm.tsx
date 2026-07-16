'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { apiFetch } from '@/lib/api';
import { useTranslations } from 'next-intl';

const fetcher = (url: string) => apiFetch<any>(url);

const languages = [
  { code: 'tr', name: 'Türkçe (Turkish)', flag: 'https://flagcdn.com/w20/tr.png' },
  { code: 'en', name: 'English', flag: 'https://flagcdn.com/w20/gb.png' },
  { code: 'pl', name: 'polski (Polish)', flag: 'https://flagcdn.com/w20/pl.png' },
  { code: 'en-GB', name: 'english (GB)', flag: 'https://flagcdn.com/w20/gb.png' },
  { code: 'en-US', name: 'english (US)', flag: 'https://flagcdn.com/w20/us.png' },
  { code: 'en-IN', name: 'english (IN)', flag: 'https://flagcdn.com/w20/in.png' },
  { code: 'ro', name: 'română (Romanian)', flag: 'https://flagcdn.com/w20/ro.png' },
  { code: 'cs', name: 'čeština (Czech)', flag: 'https://flagcdn.com/w20/cz.png' },
  { code: 'de', name: 'deutsch (German)', flag: 'https://flagcdn.com/w20/de.png' },
  { code: 'it', name: 'italiano (Italian)', flag: 'https://flagcdn.com/w20/it.png' },
  { code: 'pt-BR', name: 'português (BR)', flag: 'https://flagcdn.com/w20/br.png' },
  { code: 'zh', name: '中文 (Chinese)', flag: 'https://flagcdn.com/w20/cn.png' },
  { code: 'fr', name: 'français (French)', flag: 'https://flagcdn.com/w20/fr.png' },
  { code: 'es-AR', name: 'español (AR)', flag: 'https://flagcdn.com/w20/ar.png' },
  { code: 'es-MX', name: 'español (MX)', flag: 'https://flagcdn.com/w20/mx.png' },
  { code: 'es-CL', name: 'español (CL)', flag: 'https://flagcdn.com/w20/cl.png' },
];

export function GeneralSettingsForm() {
  const { data: settings, error, mutate } = useSWR('/system/settings', fetcher);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<any>(null);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const t = useTranslations('generalSettings');

  // Sync state when data loads
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
      await apiFetch('/system/settings', {
        method: 'PUT',
        body: JSON.stringify(formData),
      });
      mutate(formData);
      alert(t('successAlert'));
    } catch (err: any) {
      alert(err.message || 'Kaydedilirken bir hata oluştu.');
    } finally {
      setIsSaving(false);
    }
  };

  if (error) return <div className="text-red-500">Failed to load settings.</div>;
  if (!formData) return <div className="animate-pulse h-64 bg-gray-100 rounded-lg"></div>;

  const selectedLang = languages.find((l) => l.code === formData.defaultLanguage) || languages[1];

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-3xl">
      <div>
        <h3 className="text-lg font-medium leading-6 text-gray-900">{t('title')}</h3>
        <p className="mt-1 text-sm text-gray-500">{t('description')}</p>
      </div>

      <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">{t('systemName')}</label>
          <div className="mt-1">
            <input type="text" name="systemName" value={formData.systemName || ''} onChange={handleChange} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{t('defaultLanguage')}</label>
          <div className="mt-1 relative">
            <button
              type="button"
              onClick={() => setIsLangOpen(!isLangOpen)}
              className="flex w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <div className="flex items-center gap-2">
                <img src={selectedLang.flag} alt={selectedLang.name} className="w-5 h-3.5 object-cover rounded-sm border border-gray-100" />
                <span>{selectedLang.name}</span>
              </div>
              <span className="text-gray-400 text-xs">▼</span>
            </button>

            {isLangOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsLangOpen(false)} />
                <div className="absolute left-0 z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => {
                        setFormData((prev: any) => ({ ...prev, defaultLanguage: lang.code }));
                        setIsLangOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                    >
                      <img src={lang.flag} alt={lang.name} className="w-5 h-3.5 object-cover rounded-sm border border-gray-100" />
                      <span>{lang.name}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{t('defaultCurrency')}</label>
          <div className="mt-1">
            <select name="defaultCurrency" value={formData.defaultCurrency || 'TRY'} onChange={handleChange} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
              <option value="TRY">TRY (₺)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{t('dateFormat')}</label>
          <div className="mt-1">
            <select name="dateFormat" value={formData.dateFormat || 'YYYY-MM-DD'} onChange={handleChange} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
              <option value="YYYY-MM-DD">YYYY-MM-DD (2026-06-30)</option>
              <option value="DD.MM.YYYY">DD.MM.YYYY (30.06.2026)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{t('invoiceFormat')}</label>
          <div className="mt-1">
            <input type="text" name="invoiceNumberFormat" value={formData.invoiceNumberFormat || ''} onChange={handleChange} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{t('orderFormat')}</label>
          <div className="mt-1">
            <input type="text" name="orderNumberFormat" value={formData.orderNumberFormat || ''} onChange={handleChange} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
          </div>
        </div>

        <div className="sm:col-span-2 flex items-center">
          <input type="checkbox" name="maintenanceModeActive" checked={formData.maintenanceModeActive || false} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
          <label className="ml-2 block text-sm text-gray-900">{t('maintenanceMode')}</label>
        </div>
      </div>

      <div className="pt-5 border-t border-gray-200 flex justify-end gap-3">
        <button type="button" onClick={() => setFormData(settings)} className="rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
          {t('resetButton')}
        </button>
        <button type="submit" disabled={isSaving} className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50">
          {isSaving ? t('savingButton') : t('saveButton')}
        </button>
      </div>
    </form>
  );
}
