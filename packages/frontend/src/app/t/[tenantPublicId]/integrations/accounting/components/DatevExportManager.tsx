'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ArrowDownTrayIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ShieldCheckIcon,
  DocumentArrowDownIcon,
  ArrowPathIcon,
  KeyIcon,
  CalendarDaysIcon,
  BoltIcon,
} from '@heroicons/react/24/outline';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { AccountingCompanyItem } from '../types';

interface DatevExportManagerProps {
  companies: AccountingCompanyItem[];
  onRefresh?: () => void;
}

interface DatevConfigForm {
  beraterNummer: number;
  mandantenNummer: number;
  wjBeginn: string;
  sachkontenLaenge: number;
  kontenrahmen: 'SKR03' | 'SKR04';
  encoding: 'WINDOWS-1252' | 'UTF-8';
  festschreibung: 0 | 1;
}

interface DatevExportBatch {
  batchId: string;
  hashSha256: string;
  companyId: string;
  createdAt: string;
  orderCount: number;
  totalAmount: number;
  currency: string;
  downloadUrl: string;
}

interface DatevExportResult {
  batchId: string;
  fileName: string;
  hashSha256: string;
  encoding: string;
  datumVon: string;
  datumBis: string;
  totalDebit: number;
  totalCredit: number;
  entryCount: number;
  downloadUrl: string;
  downloadToken: string;
  reexportedOrderIds?: string[];
}

export default function DatevExportManager({ companies }: DatevExportManagerProps) {
  const toast = useToast();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(companies[0]?.id || '');

  // Config State
  const [config, setConfig] = useState<DatevConfigForm>({
    beraterNummer: 1001,
    mandantenNummer: 1,
    wjBeginn: new Date().getFullYear() + '-01-01',
    sachkontenLaenge: 4,
    kontenrahmen: 'SKR03',
    encoding: 'WINDOWS-1252',
    festschreibung: 0,
  });
  const [isConfigLoading, setIsConfigLoading] = useState(false);
  const [isConfigSaving, setIsConfigSaving] = useState(false);

  // Export State
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1); // 1st day of current month
    return d.toISOString().substring(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => {
    return new Date().toISOString().substring(0, 10);
  });
  const [acknowledgeReexport, setAcknowledgeReexport] = useState(false);
  const [reexportWarning, setReexportWarning] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<DatevExportResult | null>(null);

  // Batches history
  const [batches, setBatches] = useState<DatevExportBatch[]>([]);
  const [isBatchesLoading, setIsBatchesLoading] = useState(false);

  // Load config when company changes
  const loadConfig = useCallback(async (companyId: string) => {
    if (!companyId) return;
    setIsConfigLoading(true);
    try {
      const data = await api.get<Partial<DatevConfigForm>>(`/accounting/datev/config/${companyId}`);
      if (data && data.beraterNummer) {
        setConfig({
          beraterNummer: data.beraterNummer || 1001,
          mandantenNummer: data.mandantenNummer || 1,
          wjBeginn: data.wjBeginn || new Date().getFullYear() + '-01-01',
          sachkontenLaenge: data.sachkontenLaenge || 4,
          kontenrahmen: data.kontenrahmen || 'SKR03',
          encoding: data.encoding || 'WINDOWS-1252',
          festschreibung: data.festschreibung ?? 0,
        });
      }
    } catch (err: any) {
      // If none saved yet, keep defaults
    } finally {
      setIsConfigLoading(false);
    }
  }, []);

  // Load export history
  const loadBatches = useCallback(async (companyId: string) => {
    if (!companyId) return;
    setIsBatchesLoading(true);
    try {
      const list = await api.get<DatevExportBatch[]>(`/accounting/datev/exports?companyId=${companyId}`);
      setBatches(list || []);
    } catch (err: any) {
      // Ignored
    } finally {
      setIsBatchesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCompanyId) {
      loadConfig(selectedCompanyId);
      loadBatches(selectedCompanyId);
    }
  }, [selectedCompanyId, loadConfig, loadBatches]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId) {
      toast.error('Lütfen bir muhasebe şirketi seçiniz.');
      return;
    }
    setIsConfigSaving(true);
    try {
      await api.post(`/accounting/datev/config/${selectedCompanyId}`, config);
      toast.success('DATEV yapılandırması başarıyla kaydedildi.');
    } catch (err: any) {
      toast.error(err.message || 'Yapılandırma kaydedilemedi.');
    } finally {
      setIsConfigSaving(false);
    }
  };

  const handleGenerateExport = async () => {
    if (!selectedCompanyId) {
      toast.error('Lütfen bir muhasebe şirketi seçiniz.');
      return;
    }

    setIsExporting(true);
    setReexportWarning(null);

    try {
      const result = await api.post<DatevExportResult>('/accounting/datev/export', {
        companyId: selectedCompanyId,
        dateFrom,
        dateTo,
        acknowledgeReexport,
        overrideConfig: config,
      });

      setExportResult(result);
      toast.success(`DATEV dışa aktarımı oluşturuldu: ${result.fileName}`);
      loadBatches(selectedCompanyId);
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('GoBD') || msg.includes('mükerrer') || msg.includes('tekrar')) {
        setReexportWarning(msg);
      } else {
        toast.error(msg || 'Dışa aktarım başarısız oldu.');
      }
    } finally {
      setIsExporting(false);
    }
  };

  const triggerDownload = (batchId: string) => {
    window.open(`/api/accounting/datev/exports/${batchId}/download`, '_blank');
  };

  return (
    <div className="space-y-8">
      {/* Top Banner: Steuerberater & GoBD Notice */}
      <div className="rounded-2xl border border-blue-500/20 bg-blue-50/50 dark:bg-blue-950/20 p-5 shadow-xs">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-blue-500/10 p-2.5 text-blue-600 dark:text-blue-400">
            <InformationCircleIcon className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              DATEV EXTF Buchungsstapel Dışa Aktarımı
              <span className="rounded-md bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 text-2xs font-bold text-blue-700 dark:text-blue-300">
                Almanya Muhasebe Standardı
              </span>
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Bu ekran, KroptOS sipariş ve ödemelerini mali müşavirinizin (<strong>Steuerberater</strong>) DATEV Kanzlei sistemine doğrudan aktarabileceği resmi <strong>EXTF (Format 700 / Kategori 21)</strong> muhasebe fiş dosyasına dönüştürür.
            </p>
            <div className="mt-2 flex flex-wrap gap-4 text-2xs font-semibold text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <ShieldCheckIcon className="h-3.5 w-3.5" /> GoBD Uyumlu Çift Kayıt Koruması
              </span>
              <span>• Dok.-Nr. 1036228 / 1003221 (125 Sütun)</span>
              <span>• Pozitif Tutar & S/H Yön Kuralı</span>
            </div>
          </div>
        </div>
      </div>

      {/* Company Selector */}
      <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
          İşlem Yapılacak Şirket:
        </label>
        <select
          value={selectedCompanyId}
          onChange={(e) => setSelectedCompanyId(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500"
        >
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name || c.externalCompanyId} ({c.currency})
            </option>
          ))}
        </select>
      </div>

      {/* Two Column Layout: Configuration & Export Action */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Configuration Form */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <KeyIcon className="h-4 w-4 text-blue-600" />
              Mali Müşavir (Steuerberater) Yapılandırması
            </h3>
            <span className="text-2xs font-semibold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
              Tahmin Edilemez
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
            Aşağıdaki bilgileri <strong>mali müşavirinizden (Steuerberater)</strong> temin ediniz. Bu parametreler müşavirinizin DATEV defter yapısıyla birebir örtüşmelidir.
          </p>

          <form onSubmit={handleSaveConfig} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-2xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Berater-Nr (Danışman No) *
                </label>
                <input
                  type="number"
                  min={1001}
                  max={9999999}
                  required
                  value={config.beraterNummer}
                  onChange={(e) => setConfig({ ...config, beraterNummer: parseInt(e.target.value, 10) || 1001 })}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="1001 - 9999999"
                />
              </div>

              <div>
                <label className="block text-2xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Mandanten-Nr (Müşteri No) *
                </label>
                <input
                  type="number"
                  min={1}
                  max={99999}
                  required
                  value={config.mandantenNummer}
                  onChange={(e) => setConfig({ ...config, mandantenNummer: parseInt(e.target.value, 10) || 1 })}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="1 - 99999"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-2xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  WJ-Beginn (Mali Yıl Başlangıcı) *
                </label>
                <input
                  type="date"
                  required
                  value={config.wjBeginn}
                  onChange={(e) => setConfig({ ...config, wjBeginn: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-2xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Sachkontenlänge (Hesap Uzunluğu) *
                </label>
                <select
                  value={config.sachkontenLaenge}
                  onChange={(e) => setConfig({ ...config, sachkontenLaenge: parseInt(e.target.value, 10) || 4 })}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value={4}>4 Hane (Debitor: 5 Hane / 10000..69999)</option>
                  <option value={5}>5 Hane (Debitor: 6 Hane / 100000..699999)</option>
                  <option value={6}>6 Hane (Debitor: 7 Hane)</option>
                  <option value={7}>7 Hane (Debitor: 8 Hane)</option>
                  <option value={8}>8 Hane (Debitor: 9 Hane)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-2xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Kontenrahmen (Hesap Planı) *
                </label>
                <select
                  value={config.kontenrahmen}
                  onChange={(e) => setConfig({ ...config, kontenrahmen: e.target.value as any })}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-xs text-slate-900 dark:text-white font-bold text-blue-600 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="SKR03">SKR03 (Süreç Odaklı - Standart 19%: 8400)</option>
                  <option value="SKR04">SKR04 (Tablo Odaklı - Standart 19%: 4400)</option>
                </select>
              </div>

              <div>
                <label className="block text-2xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Dosya Kodlaması (Encoding) *
                </label>
                <select
                  value={config.encoding}
                  onChange={(e) => setConfig({ ...config, encoding: e.target.value as any })}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="WINDOWS-1252">WINDOWS-1252 (DATEV Standart ANSI)</option>
                  <option value="UTF-8">UTF-8 (Modern DATEV)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-2xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Festschreibung (Kayıt Kilitleme)
              </label>
              <select
                value={config.festschreibung}
                onChange={(e) => setConfig({ ...config, festschreibung: parseInt(e.target.value, 10) as any })}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value={0}>0 = Değiştirilebilir Taslak (Müşavir düzenleyebilir - Önerilen)</option>
                <option value={1}>1 = Festgeschrieben (Kilitli / GoBD kesin kayıt)</option>
              </select>
              <p className="mt-1 text-3xs text-slate-400">
                DATEV boş bırakılan kayıtları otomatik kilitler. Değiştirilebilir taslak aktarmak için açıkça 0 yazılır.
              </p>
            </div>

            <button
              type="submit"
              disabled={isConfigSaving || isConfigLoading}
              className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition-all shadow-xs"
            >
              {isConfigSaving ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <CheckCircleIcon className="h-4 w-4" />}
              DATEV Yapılandırmasını Kaydet
            </button>
          </form>
        </div>

        {/* Right: Export Action */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CalendarDaysIcon className="h-4 w-4 text-emerald-600" />
                Dışa Aktarım Dönemi Seçimi
              </h3>
              <span className="text-2xs font-bold text-slate-500">
                EXTF Batch
              </span>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-2xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Başlangıç Tarihi (Datum von)
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-2xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Bitiş Tarihi (Datum bis)
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Re-export Warning & Checkbox */}
              {reexportWarning && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-50/70 dark:bg-amber-950/30 p-4 space-y-2">
                  <div className="flex items-start gap-2.5 text-amber-800 dark:text-amber-300">
                    <ExclamationTriangleIcon className="h-5 w-5 shrink-0 mt-0.5" />
                    <p className="text-xs leading-relaxed font-medium">{reexportWarning}</p>
                  </div>
                  <label className="flex items-center gap-2 mt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={acknowledgeReexport}
                      onChange={(e) => setAcknowledgeReexport(e.target.checked)}
                      className="rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                      Mükerrerlik riskini anladım, tekrar dışa aktarımı onaylıyorum (Audit log'a yazılır)
                    </span>
                  </label>
                </div>
              )}

              <button
                type="button"
                onClick={handleGenerateExport}
                disabled={isExporting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 text-xs font-bold transition-all shadow-xs disabled:opacity-50"
              >
                {isExporting ? (
                  <>
                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    EXTF Dosyası Hesaplanıyor...
                  </>
                ) : (
                  <>
                    <DocumentArrowDownIcon className="h-4 w-4" />
                    DATEV EXTF Buchungsstapel Üret (.csv)
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Export Result Card */}
          {exportResult && (
            <div className="bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-500/30 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-xs">
                  <CheckCircleIcon className="h-4 w-4" />
                  Dışa Aktarım Başarılı!
                </div>
                <span className="text-2xs font-mono bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded">
                  {exportResult.encoding}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs bg-white dark:bg-slate-900 p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/40">
                <div>
                  <span className="text-slate-400 text-2xs block">Kayıt Sayısı</span>
                  <strong className="text-slate-900 dark:text-white">{exportResult.entryCount} Buchungssatz</strong>
                </div>
                <div>
                  <span className="text-slate-400 text-2xs block">Toplam Tutar</span>
                  <strong className="text-slate-900 dark:text-white">
                    {exportResult.totalCredit.toFixed(2)} EUR
                  </strong>
                </div>
                <div className="col-span-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 text-3xs block">SHA-256 Sağlama Özeti:</span>
                  <span className="font-mono text-3xs text-slate-600 dark:text-slate-300 break-all">
                    {exportResult.hashSha256}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => triggerDownload(exportResult.batchId)}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 px-4 py-2.5 text-xs font-bold shadow-xs transition-all"
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                {exportResult.fileName} İndir
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Historical Exports Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <DocumentArrowDownIcon className="h-4 w-4 text-blue-600" />
            Geçmiş DATEV Dışa Aktarım Fişleri
          </h3>
          <button
            onClick={() => loadBatches(selectedCompanyId)}
            className="text-2xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1"
          >
            <ArrowPathIcon className={`h-3 w-3 ${isBatchesLoading ? 'animate-spin' : ''}`} />
            Yenile
          </button>
        </div>

        {batches.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            Henüz oluşturulmuş bir DATEV dışa aktarımı bulunmuyor.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 dark:border-slate-800 text-2xs uppercase text-slate-400 font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Batch ID</th>
                  <th className="py-2.5 px-3">Oluşturulma Tarihi</th>
                  <th className="py-2.5 px-3">Sipariş Sayısı</th>
                  <th className="py-2.5 px-3">Toplam Tutar</th>
                  <th className="py-2.5 px-3">SHA-256 Özeti</th>
                  <th className="py-2.5 px-3 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-600 dark:text-slate-300">
                {batches.map((b) => (
                  <tr key={b.batchId} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-3 font-mono font-semibold text-slate-900 dark:text-white">
                      {b.batchId}
                    </td>
                    <td className="py-3 px-3">
                      {new Date(b.createdAt).toLocaleString('tr-TR')}
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                        {b.orderCount} Sipariş
                      </span>
                    </td>
                    <td className="py-3 px-3 font-semibold">
                      {b.totalAmount?.toFixed(2)} {b.currency}
                    </td>
                    <td className="py-3 px-3 font-mono text-3xs text-slate-400 max-w-xs truncate">
                      {b.hashSha256 || '-'}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => triggerDownload(b.batchId)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-2xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                      >
                        <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                        İndir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
