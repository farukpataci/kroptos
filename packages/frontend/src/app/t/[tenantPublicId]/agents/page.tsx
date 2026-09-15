'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  ServerStackIcon,
  ShieldCheckIcon,
  PlusIcon,
  ArrowPathIcon,
  TrashIcon,
  KeyIcon,
  ComputerDesktopIcon,
  SignalIcon,
  CheckCircleIcon,
  XMarkIcon,
  DocumentDuplicateIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

export interface AgentInstanceItem {
  id: string;
  agencyId: string;
  clientId?: string | null;
  name: string;
  status: 'PENDING' | 'ACTIVE' | 'OFFLINE' | 'REVOKED';
  publicKey: string;
  certFingerprint?: string | null;
  agentVersion?: string | null;
  osVersion?: string | null;
  protocolVersion?: number | null;
  clockSkewSec?: number | null;
  lastHeartbeatAt?: string | null;
  connectedNodeId?: string | null;
  enrolledAt?: string | null;
  revokedAt?: string | null;
  revokedBy?: string | null;
  connected?: boolean;
  protocolVersionServer?: number;
  createdAt: string;
}

export interface EnrollmentCodeResponse {
  code: string;
  expiresAt: string;
  expiresInSeconds: number;
}

export default function AgentsManagementPage() {
  const toast = useToast();
  const params = useParams();
  const tenantPublicId = params?.tenantPublicId as string;

  const [agents, setAgents] = useState<AgentInstanceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Enrollment Code modal state
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [enrollmentResult, setEnrollmentResult] = useState<EnrollmentCodeResponse | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Revoke confirmation modal state
  const [agentToRevoke, setAgentToRevoke] = useState<AgentInstanceItem | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  const loadAgents = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.get<AgentInstanceItem[]>('/agents');
      setAgents(data || []);
    } catch (err: any) {
      toast.error(err.message || 'Agent listesi alınamadı.');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const handleGenerateCode = async () => {
    setIsGeneratingCode(true);
    try {
      const res = await api.post<EnrollmentCodeResponse>('/agents/enrollment-codes', {});
      setEnrollmentResult(res);
      toast.success('Tek kullanımlık kayıt kodu oluşturuldu.');
    } catch (err: any) {
      toast.error(err.message || 'Kayıt kodu üretilemedi.');
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    toast.success('Kod panoya kopyalandı.');
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleConfirmRevoke = async () => {
    if (!agentToRevoke) return;
    setIsRevoking(true);
    try {
      await api.post(`/agents/${agentToRevoke.id}/revoke`, {});
      toast.success(`Agent (${agentToRevoke.name}) iptal edildi.`);
      setAgentToRevoke(null);
      await loadAgents();
    } catch (err: any) {
      toast.error(err.message || 'Agent iptal edilemedi.');
    } finally {
      setIsRevoking(false);
    }
  };

  const activeCount = agents.filter((a) => a.status === 'ACTIVE').length;
  const connectedCount = agents.filter((a) => a.connected).length;
  const totalCount = agents.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              KroptOS Agent Yönetimi
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <ShieldCheckIcon className="h-3.5 w-3.5" />
              mTLS Güvenli Tünel
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Yerel sunucularda (Mikro ERP, Nebim V3, Logo) çalışan KroptOS Agent bağlantılarını yönetin.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadAgents}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-xs"
          >
            <ArrowPathIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Yenile
          </button>
          <button
            onClick={() => {
              setEnrollmentResult(null);
              setIsCodeModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-all shadow-xs"
          >
            <PlusIcon className="h-4 w-4" />
            Yeni Kayıt Kodu Üret
          </button>
        </div>
      </div>

      {/* Quick Stats Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Toplam Agent</span>
            <ServerStackIcon className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{totalCount}</div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Aktif & Yetkili</span>
            <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{activeCount}</div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Canlı Tünel Bağlantısı</span>
            <SignalIcon className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-600 dark:text-blue-400">{connectedCount}</div>
        </div>
      </div>

      {/* Security notice card */}
      <div className="rounded-2xl border border-blue-500/20 bg-blue-50/50 dark:bg-blue-950/20 p-4 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-3">
        <InformationCircleIcon className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold text-blue-950 dark:text-blue-100">KroptOS Agent Güvenlik Mimarisi (K1, K2, K5):</span>
          <p className="text-blue-800/90 dark:text-blue-300">
            ERP kimlik bilgileri (API Key, kullanıcı kodu, şifre) KroptOS bulut sunucularına asla düz metin aktarılmaz; tarayıcıda Agent açık anahtarıyla uçtan uca şifrelenir ve yalnızca yerel Agent kasasında tutulur. Bağlantı daima müşteriden buluta doğru dışa yönlü mTLS WebSocket tüneli ile kurulur (gelen port açılması gerekmez).
          </p>
        </div>
      </div>

      {/* Agents Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <div className="border-b border-slate-200 dark:border-slate-800 px-6 py-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Kayıtlı Agent Listesi</h2>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center p-12 text-slate-400">
            <ArrowPathIcon className="h-6 w-6 animate-spin" />
          </div>
        ) : agents.length === 0 ? (
          <div className="p-12 text-center">
            <ComputerDesktopIcon className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" />
            <h3 className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">Henüz Kayıtlı Agent Yok</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Yerel muhasebe sunucunuza KroptOS Agent kurmak için yukarıdaki &quot;Yeni Kayıt Kodu Üret&quot; butonunu kullanın.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-semibold">
                <tr>
                  <th className="px-6 py-3.5">Agent Adı</th>
                  <th className="px-6 py-3.5">Durum</th>
                  <th className="px-6 py-3.5">Canlı Tünel</th>
                  <th className="px-6 py-3.5">Sürüm / İşletim Sistemi</th>
                  <th className="px-6 py-3.5">Saat Farkı (K8)</th>
                  <th className="px-6 py-3.5">Son Görülme</th>
                  <th className="px-6 py-3.5 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {agents.map((agent) => {
                  const isRevoked = agent.status === 'REVOKED';
                  const isConnected = agent.connected;

                  return (
                    <tr key={agent.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-200">
                            <ComputerDesktopIcon className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white">{agent.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">ID: {agent.id}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            agent.status === 'ACTIVE'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : agent.status === 'PENDING'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                              : agent.status === 'REVOKED'
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                              : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20'
                          }`}
                        >
                          {agent.status === 'ACTIVE' && 'Aktif'}
                          {agent.status === 'PENDING' && 'Beklemede'}
                          {agent.status === 'REVOKED' && 'İptal Edildi'}
                          {agent.status === 'OFFLINE' && 'Çevrimdışı'}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        {isRevoked ? (
                          <span className="text-slate-400 text-xs">—</span>
                        ) : isConnected ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            Bağlı
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
                            <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                            Bağlı Değil
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <div className="text-slate-700 dark:text-slate-300 font-medium">
                          v{agent.agentVersion || '0.1.0'} (Protokol v{agent.protocolVersion || 1})
                        </div>
                        <div className="text-[10px] text-slate-400">{agent.osVersion || 'Windows Server'}</div>
                      </td>

                      <td className="px-6 py-4">
                        {agent.clockSkewSec !== null && agent.clockSkewSec !== undefined ? (
                          <span
                            className={`font-mono ${
                              Math.abs(agent.clockSkewSec) > 30 ? 'text-rose-600 font-bold' : 'text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {agent.clockSkewSec > 0 ? `+${agent.clockSkewSec}s` : `${agent.clockSkewSec}s`}
                          </span>
                        ) : (
                          <span className="text-slate-400">0s (yerel)</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                        {agent.lastHeartbeatAt ? new Date(agent.lastHeartbeatAt).toLocaleString('tr-TR') : 'Henüz sinyal yok'}
                      </td>

                      <td className="px-6 py-4 text-right">
                        {!isRevoked ? (
                          <button
                            onClick={() => setAgentToRevoke(agent)}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                            İptal Et
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">İptal Edilmiş</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Enrollment Code Modal */}
      {isCodeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl animate-scale-in">
            <header className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Tek Kullanımlık Agent Kayıt Kodu</h2>
              </div>
              <button
                onClick={() => setIsCodeModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </header>

            <div className="p-6 space-y-4">
              {!enrollmentResult ? (
                <div className="space-y-4 text-center py-4">
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    ERP sunucunuzdaki KroptOS Agent&apos;ı KroptOS bulutuna güvenle bağlamak için tek kullanımlık bir kayıt kodu oluşturun.
                  </p>
                  <button
                    onClick={handleGenerateCode}
                    disabled={isGeneratingCode}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 transition-all shadow-xs"
                  >
                    {isGeneratingCode ? (
                      <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    ) : (
                      <KeyIcon className="h-4 w-4" />
                    )}
                    {isGeneratingCode ? 'Kod Üretiliyor...' : 'Kayıt Kodu Oluştur'}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/20 p-4 space-y-3">
                    <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                      Kayıt Kodunuz (15 dakika boyunca geçerlidir):
                    </div>
                    <div className="flex items-center justify-between gap-2 rounded-xl bg-white dark:bg-slate-950 border border-emerald-500/30 p-3">
                      <code className="text-sm font-bold font-mono tracking-wider text-slate-900 dark:text-white select-all">
                        {enrollmentResult.code}
                      </code>
                      <button
                        onClick={() => handleCopy(enrollmentResult.code)}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-xs"
                      >
                        <DocumentDuplicateIcon className="h-3.5 w-3.5" />
                        {copiedCode ? 'Kopyalandı!' : 'Kopyala'}
                      </button>
                    </div>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                      Bu kod tek kullanımlıktır ve sunucuda şifreli SHA-256 hash olarak tutulur. Pencereyi kapattığınızda tekrar görüntülenemez.
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 space-y-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Agent Sunucusunda Kurulum:</span>
                    <div className="rounded-lg bg-slate-900 p-2.5 text-[11px] font-mono text-slate-200">
                      kroptos-agent enroll {enrollmentResult.code}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <footer className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-6 py-3 flex justify-end">
              <button
                onClick={() => {
                  setIsCodeModalOpen(false);
                  loadAgents();
                }}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Kapat
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Revoke Confirmation Modal */}
      {agentToRevoke && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-white dark:bg-slate-900 shadow-2xl animate-scale-in">
            <header className="border-b border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20 px-6 py-4 flex items-center gap-3">
              <ExclamationTriangleIcon className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Agent İptal Onayı</h2>
            </header>

            <div className="p-6 space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-300">
                <strong>{agentToRevoke.name}</strong> isimli Agent&apos;ı iptal etmek üzeresiniz.
              </p>
              <div className="rounded-xl border border-rose-500/20 bg-rose-50/50 dark:bg-rose-950/20 p-3 text-[11px] text-rose-800 dark:text-rose-300 space-y-1">
                <li>Ajanın açık olan tüm WebSocket tünelleri derhal kapatılır.</li>
                <li>Agent makinesi REVOKED sinyali alınca yerel kimlik kasasını siler ve durur.</li>
                <li>Bağlı muhasebe entegrasyonu için yeni bir Agent atanması gerekecektir.</li>
              </div>
            </div>

            <footer className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-6 py-3 flex justify-end gap-2">
              <button
                onClick={() => setAgentToRevoke(null)}
                disabled={isRevoking}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50"
              >
                Vazgeç
              </button>
              <button
                onClick={handleConfirmRevoke}
                disabled={isRevoking}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 transition-all shadow-xs"
              >
                {isRevoking ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <TrashIcon className="h-4 w-4" />}
                {isRevoking ? 'İptal Ediliyor...' : 'Evet, Agentı İptal Et'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
