'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { apiFetch } from '@/lib/api';

const fetcher = (url: string) => apiFetch(url);

export function NotificationSettingsForm() {
  const { data: notifications, error, mutate } = useSWR<any>('/system/notification-settings', fetcher);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<any>(null);

  // Sync state when data loads
  if (notifications && !formData) {
    setFormData({
      channels: notifications.channels || { email: true, sms: false, slack: false, system: true },
      events: notifications.events || { newOrder: true, criticalStock: true, integrationError: true },
    });
  }

  const handleChannelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData((prev: any) => ({
      ...prev,
      channels: {
        ...prev.channels,
        [name]: checked,
      },
    }));
  };

  const handleEventChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData((prev: any) => ({
      ...prev,
      events: {
        ...prev.events,
        [name]: checked,
      },
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await apiFetch('/system/notification-settings', {
        method: 'PUT',
        body: JSON.stringify(formData),
      });
      mutate(formData);
      alert('Notification settings saved.');
    } catch (err: any) {
      alert(err.message || 'Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  if (error) return <div className="text-red-500">Failed to load notification settings.</div>;
  if (!formData) return <div className="animate-pulse h-64 bg-gray-100 rounded-lg"></div>;

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-lg font-medium leading-6 text-gray-900">Notification Settings</h3>
        <p className="mt-1 text-sm text-gray-500">Configure alert channels and event-driven trigger notifications.</p>
      </div>

      <div className="space-y-6">
        <div>
          <h4 className="text-sm font-bold text-gray-800 mb-3">Notification Channels</h4>
          <div className="space-y-3 pl-1">
            <div className="flex items-start">
              <input
                id="channel_email"
                name="email"
                type="checkbox"
                checked={formData.channels?.email || false}
                onChange={handleChannelChange}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mt-0.5"
              />
              <label htmlFor="channel_email" className="ml-3 text-sm text-gray-700 font-medium">
                Email Alerts
                <span className="block text-xs text-gray-400">Receive reports and order alerts at company email.</span>
              </label>
            </div>

            <div className="flex items-start">
              <input
                id="channel_sms"
                name="sms"
                type="checkbox"
                checked={formData.channels?.sms || false}
                onChange={handleChannelChange}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mt-0.5"
              />
              <label htmlFor="channel_sms" className="ml-3 text-sm text-gray-700 font-medium">
                SMS Mobile Alerts
                <span className="block text-xs text-gray-400">Send direct texts for critical warehouse operations.</span>
              </label>
            </div>

            <div className="flex items-start">
              <input
                id="channel_slack"
                name="slack"
                type="checkbox"
                checked={formData.channels?.slack || false}
                onChange={handleChannelChange}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mt-0.5"
              />
              <label htmlFor="channel_slack" className="ml-3 text-sm text-gray-700 font-medium">
                Slack Hook Integration
                <span className="block text-xs text-gray-400">Publish alerts to a Slack channel via webhook.</span>
              </label>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-6">
          <h4 className="text-sm font-bold text-gray-800 mb-3">Event Triggers</h4>
          <div className="space-y-3 pl-1">
            <div className="flex items-start">
              <input
                id="event_newOrder"
                name="newOrder"
                type="checkbox"
                checked={formData.events?.newOrder || false}
                onChange={handleEventChange}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mt-0.5"
              />
              <label htmlFor="event_newOrder" className="ml-3 text-sm text-gray-700 font-medium">
                New Order Received
              </label>
            </div>

            <div className="flex items-start">
              <input
                id="event_criticalStock"
                name="criticalStock"
                type="checkbox"
                checked={formData.events?.criticalStock || false}
                onChange={handleEventChange}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mt-0.5"
              />
              <label htmlFor="event_criticalStock" className="ml-3 text-sm text-gray-700 font-medium">
                Critical Low Stock Level
              </label>
            </div>

            <div className="flex items-start">
              <input
                id="event_integrationError"
                name="integrationError"
                type="checkbox"
                checked={formData.events?.integrationError || false}
                onChange={handleEventChange}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mt-0.5"
              />
              <label htmlFor="event_integrationError" className="ml-3 text-sm text-gray-700 font-medium">
                API Integration Sync Failures
              </label>
            </div>
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
