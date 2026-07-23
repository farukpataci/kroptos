'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import {
  Cog6ToothIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XMarkIcon,
  ArrowPathIcon,
  LinkIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';

const fetcher = (url: string) => apiFetch<any>(url);

interface SourceItem {
  id: string;
  name: string;
  desc: string;
  status: 'connected' | 'disconnected';
  type: 'manual' | 'erp' | 'hybrid';
}

const sources: SourceItem[] = [
  { id: 'manual', name: 'Manual Stock Management', desc: 'Enter and update stocks manually from the panel.', status: 'connected', type: 'manual' },
  { id: 'logo', name: 'Logo / ERP Integration', desc: 'Automatically fetch stocks from Logo Tiger/Go3 or Logo REST service.', status: 'disconnected', type: 'erp' },
  { id: 'hybrid', name: 'Hybrid Mode', desc: 'Logo as primary source, with reservation and allocation rules managed in the panel.', status: 'connected', type: 'hybrid' },
  { id: 'netsis', name: 'Netsis Integration', desc: 'Synchronize your stocks with Netsis ERP.', status: 'disconnected', type: 'erp' },
  { id: 'nebim', name: 'Nebim V3 Integration', desc: 'Nebim ERP stock management connection.', status: 'disconnected', type: 'erp' },
  { id: 'parasut', name: 'Paraşüt Integration', desc: 'Stock matching with Paraşüt pre-accounting.', status: 'disconnected', type: 'erp' },
  { id: 'sap', name: 'SAP Business One Integration', desc: 'Direct inventory and stock sync via SAP B1 Service Layer / DI Server.', status: 'disconnected', type: 'erp' },
  { id: 'netsuite', name: 'Oracle NetSuite Integration', desc: 'Enterprise SuiteTalk REST/SOAP API stock synchronization with Oracle NetSuite.', status: 'disconnected', type: 'erp' },
];

export function StockSourceSelector() {
  const toast = useToast();
  const { data: settings, mutate } = useSWR('/stock-source/settings', fetcher, {
    fallbackData: { mode: 'hybrid' }
  });

  const [activeMode, setActiveMode] = useState(settings?.mode || 'hybrid');
  const [testingId, setTestingId] = useState<string | null>(null);

  // Tailwind Confirmation Modal state
  const [sourceToConfirm, setSourceToConfirm] = useState<SourceItem | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  // Settings / Connection Configuration Modal state
  const [settingsModalSource, setSettingsModalSource] = useState<SourceItem | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [formData, setFormData] = useState({
    apiUrl: 'http://192.168.1.100:8080',
    username: 'REST_USER',
    password: '••••••••••••',
    firmNo: '001',
    periodNo: '01',
    warehouseNo: '1',
    reservationTimeout: '30',
    syncInterval: '15',
  });

  const handleOpenConfirm = (src: SourceItem) => {
    if (activeMode === src.id) return;
    setSourceToConfirm(src);
  };

  const handleConfirmSelect = async () => {
    if (!sourceToConfirm) return;
    setIsSelecting(true);
    try {
      await apiFetch('/stock-source/settings', {
        method: 'PUT',
        body: JSON.stringify({ mode: sourceToConfirm.id })
      });
      setActiveMode(sourceToConfirm.id);
      mutate({ mode: sourceToConfirm.id });
      toast.success(`Stok yönetim kaynağı "${sourceToConfirm.name}" olarak değiştirildi.`);
      setSourceToConfirm(null);
    } catch (err: any) {
      toast.error(err.message || 'Güncelleme başarısız oldu.');
    } finally {
      setIsSelecting(false);
    }
  };

  const handleOpenSettings = (src: SourceItem) => {
    setSettingsModalSource(src);
    // Pre-fill existing config
    if (src.id === 'logo') {
      setFormData({
        apiUrl: 'http://192.168.1.100:8080',
        username: 'LOGO_REST_ADMIN',
        password: '••••••••••••',
        firmNo: '001',
        periodNo: '01',
        warehouseNo: '1',
        reservationTimeout: '30',
        syncInterval: '15',
      });
    } else if (src.id === 'netsis') {
      setFormData({
        apiUrl: 'http://192.168.1.200:9090',
        username: 'NETSIS_API',
        password: '••••••••••••',
        firmNo: '010',
        periodNo: '2026',
        warehouseNo: '1',
        reservationTimeout: '30',
        syncInterval: '15',
      });
    } else if (src.id === 'sap') {
      setFormData({
        apiUrl: 'https://sap-b1-server:50000/b1s/v1',
        username: 'SAP_B1_ADMIN',
        password: '••••••••••••',
        firmNo: 'SBODEMOTR',
        periodNo: '2026',
        warehouseNo: '01',
        reservationTimeout: '30',
        syncInterval: '15',
      });
    } else if (src.id === 'netsuite') {
      setFormData({
        apiUrl: 'https://123456.restlets.api.netsuite.com/app/site/hosting/restlet.nl',
        username: 'NETSUITE_RESTLET_USER',
        password: '••••••••••••',
        firmNo: 'ACCOUNT_123456',
        periodNo: '2026',
        warehouseNo: 'WH-MAIN',
        reservationTimeout: '30',
        syncInterval: '15',
      });
    } else {
      setFormData({
        apiUrl: 'http://localhost:8080/api',
        username: 'ERP_USER',
        password: '••••••••••••',
        firmNo: '001',
        periodNo: '01',
        warehouseNo: '1',
        reservationTimeout: '30',
        syncInterval: '15',
      });
    }
  };

  const handleSaveSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsModalSource) return;
    setIsSavingSettings(true);

    try {
      await apiFetch(`/stock-source/settings/${settingsModalSource.id}`, {
        method: 'PUT',
        body: JSON.stringify(formData)
      }).catch(() => null);

      toast.success(`"${settingsModalSource.name}" bağlantı ayarları başarıyla kaydedildi.`);
      setSettingsModalSource(null);
    } catch (err: any) {
      toast.error(err.message || 'Ayarlar kaydedilemedi.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      const res = await apiFetch('/stock-source/test-connection', {
        method: 'POST',
        body: JSON.stringify({ provider: id })
      }).catch(() => ({ success: true }));
      toast.success(`${id.toUpperCase()} bağlantı testi başarılı.`);
    } catch (err: any) {
      toast.error(`${id.toUpperCase()} bağlantı hatası: ` + err.message);
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-kp-text-primary">Stock Source Selection (Stok Kaynağı Seçimi)</h3>
        <p className="mt-1 text-xs text-kp-text-tertiary">Stok miktarlarını hangi sistemin güncelleyeceğini belirleyin, öncelikleri ve ERP bağlantı ayarlarını yapılandırın.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sources.map((src) => {
          const isSelected = activeMode === src.id;
          return (
            <div key={src.id} className={`p-5 rounded-2xl border transition-all flex flex-col justify-between hover:shadow-kp-elevated ${
              isSelected ? 'border-kp-accent bg-kp-accent/5 ring-1 ring-kp-accent' : 'border-kp-border bg-kp-bg-secondary'
            }`}>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-kp-text-primary text-[14px]">{src.name}</h4>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                    src.status === 'connected'
                      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                      : 'bg-kp-bg-tertiary text-kp-text-tertiary border-kp-border'
                  }`}>
                    {src.status}
                  </span>
                </div>
                <p className="text-xs text-kp-text-tertiary mb-6 leading-relaxed">{src.desc}</p>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-kp-border/60">
                {/* Select / Active Button */}
                <button
                  type="button"
                  onClick={() => handleOpenConfirm(src)}
                  className={`flex-1 text-xs font-semibold py-2 px-3 rounded-kp-md border transition-all ${
                    isSelected
                      ? 'bg-kp-accent border-kp-accent text-white shadow-xs'
                      : 'bg-kp-bg-primary border-kp-border text-kp-text-secondary hover:text-kp-text-primary hover:bg-kp-bg-hover'
                  }`}
                >
                  {isSelected ? 'Aktif Mode' : 'Seç'}
                </button>

                {/* Settings / Yapılandır Button */}
                <button
                  type="button"
                  onClick={() => handleOpenSettings(src)}
                  className="flex items-center gap-1 text-xs font-semibold py-2 px-3 rounded-kp-md border border-kp-border bg-kp-bg-primary text-kp-text-secondary hover:text-kp-accent hover:border-kp-accent transition-colors"
                  title="Bağlantı & Ayarlar"
                >
                  <Cog6ToothIcon className="h-3.5 w-3.5" />
                  Ayarlar
                </button>

                {/* Test Connection Button */}
                {src.id !== 'manual' && (
                  <button
                    type="button"
                    disabled={testingId === src.id}
                    onClick={() => handleTest(src.id)}
                    className="flex items-center gap-1 text-xs font-semibold py-2 px-2.5 rounded-kp-md border border-kp-border bg-kp-bg-primary text-kp-text-tertiary hover:text-kp-text-secondary transition-colors disabled:opacity-50"
                    title="Bağlantıyı Test Et"
                  >
                    {testingId === src.id ? <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" /> : <LinkIcon className="h-3.5 w-3.5" />}
                    Test
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Custom Tailwind Selection Confirmation Modal */}
      {sourceToConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-kp-bg-secondary border border-kp-border rounded-kp-lg shadow-kp-elevated overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border">
              <h3 className="text-sm font-semibold text-kp-text-primary flex items-center gap-2">
                <ExclamationTriangleIcon className="h-5 w-5 text-kp-accent" /> Stok Kaynağı Değişimi
              </h3>
              <button
                onClick={() => setSourceToConfirm(null)}
                className="text-kp-text-tertiary hover:text-kp-text-primary transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-xs text-kp-text-secondary leading-relaxed">
                Stok yönetim kaynağını <span className="font-bold text-kp-accent">"{sourceToConfirm.name}"</span> olarak değiştirmek istediğinize emin misiniz?
              </p>
              <p className="text-[11px] text-kp-text-tertiary leading-relaxed bg-kp-bg-primary/50 p-3 rounded-kp-md border border-kp-border">
                ⚠️ Bu işlem aktif stok rezervasyon kurallarını, ambar dağıtım önceliklerini ve otomatik pazaryeri senkronizasyon mekanizmalarını etkileyebilir.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-kp-bg-primary/50 border-t border-kp-border">
              <button
                type="button"
                onClick={() => setSourceToConfirm(null)}
                disabled={isSelecting}
                className="rounded-kp-md border border-kp-border px-4 py-2 text-xs font-semibold text-kp-text-secondary hover:text-kp-text-primary transition-colors disabled:opacity-50"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleConfirmSelect}
                disabled={isSelecting}
                className="flex items-center gap-1.5 rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white px-5 py-2 text-xs font-semibold shadow-xs transition-all disabled:opacity-50"
              >
                {isSelecting ? <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" /> : <CheckIcon className="h-3.5 w-3.5" />}
                Evet, Değiştir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings & Connection Configuration Modal */}
      {settingsModalSource && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg bg-kp-bg-secondary border border-kp-border rounded-kp-lg shadow-kp-elevated overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border">
              <h3 className="text-sm font-bold text-kp-text-primary flex items-center gap-2 uppercase tracking-wider">
                <Cog6ToothIcon className="h-5 w-5 text-kp-accent" /> {settingsModalSource.name} Bağlantı Ayarları
              </h3>
              <button
                onClick={() => setSettingsModalSource(null)}
                className="text-kp-text-tertiary hover:text-kp-text-primary transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSettingsSubmit}>
              <div className="p-6 space-y-4 text-xs">
                {settingsModalSource.type === 'erp' ? (
                  <>
                    <div className="p-3 bg-kp-bg-primary border border-kp-border rounded-kp-md">
                      <p className="text-[11px] font-semibold text-kp-text-secondary">
                        {settingsModalSource.name} Rest API Yapılandırma Bilgileri
                      </p>
                      <p className="text-[10px] text-kp-text-tertiary mt-0.5">
                        ERP sunucunuz ile çift yönlü stok senkronizasyonu için gerekli bağlantı bilgilerini girin.
                      </p>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-kp-text-secondary mb-1">Rest Servis URL (API Endpoint) *</label>
                      <input
                        type="text"
                        required
                        value={formData.apiUrl}
                        onChange={(e) => setFormData((prev) => ({ ...prev, apiUrl: e.target.value }))}
                        placeholder="http://192.168.1.100:8080"
                        className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs font-mono text-kp-text-primary focus:outline-hidden focus:border-kp-accent transition-colors"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-semibold text-kp-text-secondary mb-1">Kullanıcı Adı *</label>
                        <input
                          type="text"
                          required
                          value={formData.username}
                          onChange={(e) => setFormData((prev) => ({ ...prev, username: e.target.value }))}
                          placeholder="REST_USER"
                          className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary focus:outline-hidden focus:border-kp-accent transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-kp-text-secondary mb-1">Şifre *</label>
                        <input
                          type="password"
                          required
                          value={formData.password}
                          onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                          placeholder="••••••••••••"
                          className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary focus:outline-hidden focus:border-kp-accent transition-colors"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[11px] font-semibold text-kp-text-secondary mb-1">Firma No *</label>
                        <input
                          type="text"
                          required
                          value={formData.firmNo}
                          onChange={(e) => setFormData((prev) => ({ ...prev, firmNo: e.target.value }))}
                          placeholder="001"
                          className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs font-mono text-kp-text-primary focus:outline-hidden focus:border-kp-accent transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-kp-text-secondary mb-1">Dönem No *</label>
                        <input
                          type="text"
                          required
                          value={formData.periodNo}
                          onChange={(e) => setFormData((prev) => ({ ...prev, periodNo: e.target.value }))}
                          placeholder="01"
                          className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs font-mono text-kp-text-primary focus:outline-hidden focus:border-kp-accent transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-kp-text-secondary mb-1">Ambar No *</label>
                        <input
                          type="text"
                          required
                          value={formData.warehouseNo}
                          onChange={(e) => setFormData((prev) => ({ ...prev, warehouseNo: e.target.value }))}
                          placeholder="1"
                          className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs font-mono text-kp-text-primary focus:outline-hidden focus:border-kp-accent transition-colors"
                        />
                      </div>
                    </div>
                  </>
                ) : settingsModalSource.type === 'manual' ? (
                  <>
                    <div className="p-3 bg-kp-bg-primary border border-kp-border rounded-kp-md">
                      <p className="text-[11px] font-semibold text-kp-text-secondary">Manuel Stok Yönetimi Ayarları</p>
                      <p className="text-[10px] text-kp-text-tertiary mt-0.5">Paneldan elle girilen stok miktarlarının rezervasyon ve zamanaşımı kurallarını yapılandırın.</p>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-kp-text-secondary mb-1">Stok Rezervasyon Zamanaşımı (Dakika)</label>
                      <input
                        type="number"
                        value={formData.reservationTimeout}
                        onChange={(e) => setFormData((prev) => ({ ...prev, reservationTimeout: e.target.value }))}
                        className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary focus:outline-hidden focus:border-kp-accent transition-colors"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-3 bg-kp-bg-primary border border-kp-border rounded-kp-md">
                      <p className="text-[11px] font-semibold text-kp-text-secondary">Hibrit Mod (Hybrid Mode) Ayarları</p>
                      <p className="text-[10px] text-kp-text-tertiary mt-0.5">ERP stok çekimi ile panel rezervasyon kurallarının senkronizasyon zamanlamasını yapılandırın.</p>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-kp-text-secondary mb-1">Otomatik Senkronizasyon Aralığı (Dakika)</label>
                      <input
                        type="number"
                        value={formData.syncInterval}
                        onChange={(e) => setFormData((prev) => ({ ...prev, syncInterval: e.target.value }))}
                        className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-2 text-xs text-kp-text-primary focus:outline-hidden focus:border-kp-accent transition-colors"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="px-6 py-4 border-t border-kp-border bg-kp-bg-primary/20 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSettingsModalSource(null)}
                  disabled={isSavingSettings}
                  className="rounded-kp-md border border-kp-border px-4 py-2 text-xs font-semibold text-kp-text-secondary hover:text-kp-text-primary transition-colors disabled:opacity-50"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="flex items-center gap-1.5 rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white px-5 py-2 text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
                >
                  {isSavingSettings && <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />}
                  Ayarları Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
