'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

const fetcher = (url: string) => apiFetch(url);

export function SecuritySettingsForm() {
  const { data: security, error, mutate } = useSWR<any>('/system/security-settings', fetcher);
  const toast = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<any>(null);

  // Sync state when data loads
  if (security && !formData) {
    setFormData({
      require2FA: security.require2FA || false,
      passwordPolicy: security.passwordPolicy || 'standard',
      minPasswordLength: security.minPasswordLength || 8,
      sessionTimeoutMinutes: security.sessionTimeoutMinutes || 120,
      loginAttemptLimit: security.loginAttemptLimit || 5,
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
      await apiFetch('/system/security-settings', {
        method: 'PUT',
        body: JSON.stringify(formData),
      });
      mutate(formData);
      toast.success('Security settings saved.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  if (error) return <div className="text-red-500">Failed to load security settings.</div>;
  if (!formData) return <div className="animate-pulse h-64 bg-gray-100 rounded-lg"></div>;

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-lg font-medium leading-6 text-gray-900">Workspace Security Policy</h3>
        <p className="mt-1 text-sm text-gray-500">Enforce global login attempts, session expiration timers, and 2FA policies.</p>
      </div>

      <div className="space-y-4">
        <div className="flex items-start">
          <div className="flex h-5 items-center">
            <input
              id="require2FA"
              name="require2FA"
              type="checkbox"
              checked={formData.require2FA || false}
              onChange={handleChange}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
          </div>
          <div className="ml-3 text-sm">
            <label htmlFor="require2FA" className="font-medium text-gray-700">Enforce 2FA for all users</label>
            <p className="text-gray-500">Mandate that all member accounts configure and verify 2FA credentials at login.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Password Strength Policy</label>
            <select
              name="passwordPolicy"
              value={formData.passwordPolicy || 'standard'}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="standard">Standard (Min length only)</option>
              <option value="strong">Strong (Requires numbers and capital letters)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Minimum Password Length</label>
            <input
              type="number"
              name="minPasswordLength"
              min={6}
              max={32}
              value={formData.minPasswordLength}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Session Timeout (Minutes)</label>
            <input
              type="number"
              name="sessionTimeoutMinutes"
              min={10}
              max={1440}
              value={formData.sessionTimeoutMinutes}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Login Attempt Lockout Limit</label>
            <input
              type="number"
              name="loginAttemptLimit"
              min={3}
              max={20}
              value={formData.loginAttemptLimit}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
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
