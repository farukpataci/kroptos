'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

interface PrinterSettings {
  printerName: string;
  printerType: string;
  driverName: string | null;
  driverVersion: string | null;
  driverInstalled: boolean;
  connectionType: string;
  labelFormat: string;
  labelSize: string;
}

interface LabelPreviewData {
  labelId: string;
  carrierName: string;
  trackingNumber: string;
  barcode: string;
  labelFormat: string;
  orderNumber: string;
  customerName: string;
  shippingAddress: string;
  totalAmount: string;
  currency: string;
  createdAt: string;
}

export default function WmsSettingsPage() {
  const [settings, setSettings] = useState<PrinterSettings | null>(null);
  const [previewData, setPreviewData] = useState<LabelPreviewData | null>(null);
  const [driverStatusMessage, setDriverStatusMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'printer' | 'label' | 'preview'>('printer');

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form states
  const [printerName, setPrinterName] = useState('');
  const [printerType, setPrinterType] = useState('Thermal');
  const [connectionType, setConnectionType] = useState('USB');
  const [labelFormat, setLabelFormat] = useState('PDF');
  const [labelSize, setLabelSize] = useState('100x150');

  const fetchData = async () => {
    try {
      setLoading(true);
      const s = await apiFetch<PrinterSettings>('/wms/printer/settings');
      setSettings(s);
      setPrinterName(s.printerName);
      setPrinterType(s.printerType);
      setConnectionType(s.connectionType);
      setLabelFormat(s.labelFormat);
      setLabelSize(s.labelSize);

      const label = await apiFetch<any>('/wms/labels/latest');
      if (label) {
        const preview = await apiFetch<LabelPreviewData>(`/wms/labels/${label.id}/preview`);
        setPreviewData(preview);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const updated = await apiFetch<PrinterSettings>('/wms/printer/settings', {
        method: 'PATCH',
        body: JSON.stringify({ printerName, printerType, connectionType, labelFormat, labelSize }),
      });
      setSettings(updated);
      alert('Printer settings saved successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleCheckDriver = async () => {
    try {
      setChecking(true);
      const res = await apiFetch<any>('/wms/printer/driver');
      setDriverStatusMessage(res.message);
      if (settings) setSettings({ ...settings, driverInstalled: res.driverInstalled });
    } catch (err: any) {
      alert(err.message || 'Driver check failed.');
    } finally {
      setChecking(false);
    }
  };

  const handleSendTestPrint = async () => {
    try {
      setTesting(true);
      const res = await apiFetch<any>('/wms/printer/test');
      if (res.success) alert(res.message);
    } catch (err: any) {
      alert(err.message || 'Test print failed.');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center animate-fade-in">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-kp-accent border-t-transparent" />
        <p className="mt-2 text-xs text-kp-text-tertiary">Loading settings...</p>
      </div>
    );
  }

  const tabs = [
    { key: 'printer' as const, label: 'Printer Config' },
    { key: 'label' as const, label: 'Label Settings' },
    { key: 'preview' as const, label: 'Label Preview' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Title */}
      <div>
        <h1 className="text-xl font-semibold text-kp-text-primary">WMS Settings</h1>
        <p className="mt-1 text-[13px] text-kp-text-tertiary">
          Configure barcode printers, label formats, driver management, and preview shipping labels.
        </p>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-1 border-b border-kp-border pb-0">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-[13px] font-medium transition-colors border-b-2 -mb-[1px] ${
              activeTab === tab.key
                ? 'border-kp-accent text-kp-accent-hover'
                : 'border-transparent text-kp-text-tertiary hover:text-kp-text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'printer' && settings && (
        <div className="card p-6 space-y-5">
          <div className="border-b border-kp-border pb-3">
            <h2 className="text-[15px] font-semibold text-kp-text-primary">Thermal Barcode Printer Configuration</h2>
          </div>

          {/* Driver info alert */}
          <div className="rounded-kp-md border border-kp-border-accent bg-kp-accent-muted px-4 py-3 text-[12px] text-kp-accent-hover">
            <strong>Note:</strong> Printer driver installation is done at the OS level. This panel allows you to verify driver status, send test prints, and configure label output format.
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-kp-text-tertiary mb-1.5">Active Printer</label>
                <input type="text" value={printerName} onChange={(e) => setPrinterName(e.target.value)}
                  className="w-full rounded-kp-md border border-kp-border bg-kp-bg-primary px-3 py-2 text-[13px] text-kp-text-primary focus:border-kp-border-accent focus:outline-none" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-kp-text-tertiary mb-1.5">Printer Type</label>
                <select value={printerType} onChange={(e) => setPrinterType(e.target.value)}
                  className="w-full rounded-kp-md border border-kp-border bg-kp-bg-primary px-3 py-2 text-[13px] text-kp-text-primary focus:border-kp-border-accent focus:outline-none">
                  <option value="Thermal">Thermal Transfer</option>
                  <option value="DirectThermal">Direct Thermal</option>
                  <option value="Laser">Laser Printer</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-kp-text-tertiary mb-1.5">Connection Type</label>
                <select value={connectionType} onChange={(e) => setConnectionType(e.target.value)}
                  className="w-full rounded-kp-md border border-kp-border bg-kp-bg-primary px-3 py-2 text-[13px] text-kp-text-primary focus:border-kp-border-accent focus:outline-none">
                  <option value="USB">USB Connection</option>
                  <option value="Ethernet">Ethernet / Network IP</option>
                  <option value="Bluetooth">Bluetooth</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-kp-text-tertiary mb-1.5">Driver Status</label>
                <div className="flex items-center gap-3 py-1.5">
                  <span className={`badge ${settings.driverInstalled ? 'badge--success' : 'badge--danger'}`}>
                    {settings.driverInstalled ? 'Driver Installed' : 'Driver Missing'}
                  </span>
                  <button type="button" onClick={handleCheckDriver} disabled={checking}
                    className="rounded-kp-md border border-kp-border bg-kp-bg-primary/50 px-3 py-1.5 text-[11px] font-medium text-kp-text-secondary hover:border-kp-border-accent hover:text-kp-text-primary transition-all">
                    {checking ? 'Checking…' : 'Check Driver'}
                  </button>
                </div>
              </div>
            </div>

            {driverStatusMessage && (
              <p className="text-[11px] text-kp-text-tertiary italic rounded-kp-md border border-kp-border bg-kp-bg-tertiary px-3 py-2">
                {driverStatusMessage}
              </p>
            )}

            <div className="flex items-center gap-3 pt-4 border-t border-kp-border">
              <button type="submit" disabled={saving}
                className="rounded-kp-md bg-kp-accent px-4 py-2 text-[13px] font-semibold text-white shadow-kp-glow transition-colors hover:bg-kp-accent-hover">
                {saving ? 'Saving…' : 'Save Settings'}
              </button>
              <button type="button" onClick={handleSendTestPrint} disabled={testing}
                className="rounded-kp-md border border-kp-border bg-kp-bg-primary/50 px-4 py-2 text-[13px] font-medium text-kp-text-secondary hover:border-kp-border-accent hover:text-kp-text-primary transition-all">
                {testing ? 'Sending…' : 'Send Test Print'}
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'label' && (
        <div className="card p-6 space-y-5">
          <div className="border-b border-kp-border pb-3">
            <h2 className="text-[15px] font-semibold text-kp-text-primary">Shipping Label Format</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-kp-text-tertiary mb-1.5">Label Size</label>
              <select value={labelSize} onChange={(e) => setLabelSize(e.target.value)}
                className="w-full rounded-kp-md border border-kp-border bg-kp-bg-primary px-3 py-2 text-[13px] text-kp-text-primary focus:border-kp-border-accent focus:outline-none">
                <option value="100x150">100mm × 150mm (Standard Shipping)</option>
                <option value="100x100">100mm × 100mm (Square Label)</option>
                <option value="80x50">80mm × 50mm (Shelf / Product Label)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-kp-text-tertiary mb-1.5">Output Format</label>
              <select value={labelFormat} onChange={(e) => setLabelFormat(e.target.value)}
                className="w-full rounded-kp-md border border-kp-border bg-kp-bg-primary px-3 py-2 text-[13px] text-kp-text-primary focus:border-kp-border-accent focus:outline-none">
                <option value="PDF">PDF Document</option>
                <option value="ZPL">ZPL (Zebra Programming Language)</option>
                <option value="PNG">Image (PNG / GDI)</option>
              </select>
            </div>
          </div>
          <div className="pt-4 border-t border-kp-border">
            <button type="button" onClick={handleSaveSettings}
              className="rounded-kp-md bg-kp-accent px-4 py-2 text-[13px] font-semibold text-white shadow-kp-glow transition-colors hover:bg-kp-accent-hover">
              Save Label Settings
            </button>
          </div>
        </div>
      )}

      {activeTab === 'preview' && (
        <div className="card p-6 space-y-5">
          <div className="border-b border-kp-border pb-3">
            <h2 className="text-[15px] font-semibold text-kp-text-primary">Shipping Label Preview</h2>
            <p className="text-[11px] text-kp-text-tertiary">Preview the most recently generated shipping label.</p>
          </div>

          {!previewData ? (
            <div className="flex h-40 flex-col items-center justify-center text-xs text-kp-text-tertiary gap-2">
              <svg className="h-8 w-8 text-kp-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              No shipping label has been generated yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* Metadata */}
              <div className="space-y-3 text-[12px]">
                {[
                  ['Order Number', previewData.orderNumber],
                  ['Carrier', previewData.carrierName],
                  ['Tracking Number', previewData.trackingNumber],
                  ['Recipient', previewData.customerName],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between border-b border-kp-border pb-2">
                    <span className="text-kp-text-tertiary">{label}</span>
                    <span className="font-medium text-kp-text-primary">{value}</span>
                  </div>
                ))}
                <div className="flex flex-col gap-1">
                  <span className="text-kp-text-tertiary">Address</span>
                  <span className="text-kp-text-secondary rounded-kp-md border border-kp-border bg-kp-bg-tertiary p-2.5 leading-relaxed">
                    {previewData.shippingAddress}
                  </span>
                </div>
              </div>

              {/* Label Visual */}
              <div className="rounded-kp-lg bg-white p-5 text-black shadow-kp-elevated border border-kp-border max-w-sm mx-auto font-mono">
                <div className="flex justify-between items-center border-b-2 border-black pb-2 mb-3">
                  <span className="font-extrabold tracking-tighter text-sm uppercase">{previewData.carrierName}</span>
                  <span className="font-bold border border-black px-1.5 py-0.5 text-[9px]">STANDARD</span>
                </div>
                <div className="text-[10px] space-y-1.5 mb-3">
                  <div><span className="font-bold">FROM:</span> KroptOS WMS Central Warehouse</div>
                  <div><span className="font-bold">TO:</span> {previewData.customerName}</div>
                  <div><span className="font-bold">ADDR:</span> {previewData.shippingAddress}</div>
                </div>
                <div className="border-t-2 border-dashed border-black pt-3 flex flex-col items-center gap-2">
                  <div className="w-full h-14 bg-black flex items-center justify-center text-white font-mono text-[10px] tracking-[6px] select-none">
                    ||||||||||||||||||||||||||||||||||||||||||||||
                  </div>
                  <div className="font-mono text-xs font-bold text-center">{previewData.barcode}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
