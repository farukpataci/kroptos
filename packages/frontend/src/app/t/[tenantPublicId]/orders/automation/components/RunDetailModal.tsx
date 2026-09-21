'use client';

import React, { useState } from 'react';
import {
  XMarkIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  MinusCircleIcon,
  ClockIcon,
  ChevronRightIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { AutomationRun } from '../types';

interface RunDetailModalProps {
  run: AutomationRun;
  onClose: () => void;
  onRetry: (runId: string) => Promise<any>;
}

export default function RunDetailModal({ run, onClose, onRetry }: RunDetailModalProps) {
  const [retrying, setRetrying] = useState(false);
  const [retrySuccess, setRetrySuccess] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);

  const handleRetry = async () => {
    setRetrying(true);
    setRetrySuccess(null);
    setRetryError(null);
    try {
      await onRetry(run.id);
      setRetrySuccess('Çalışma başarıyla yeniden kuyruğa alındı.');
    } catch (err: any) {
      setRetryError(err?.message || 'Yeniden deneme başarısız oldu.');
    } finally {
      setRetrying(false);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return (
          <span className="inline-flex items-center gap-1 rounded-kp-xs bg-kp-success-muted px-2 py-0.5 text-xs font-semibold text-kp-success">
            <CheckCircleIcon className="h-3.5 w-3.5" />
            Başarılı
          </span>
        );
      case 'PARTIAL_SUCCESS':
        return (
          <span className="inline-flex items-center gap-1 rounded-kp-xs bg-kp-warning-muted px-2 py-0.5 text-xs font-semibold text-kp-warning">
            <ClockIcon className="h-3.5 w-3.5" />
            Kısmi Başarılı
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 rounded-kp-xs bg-kp-danger-muted px-2 py-0.5 text-xs font-semibold text-kp-danger">
            <XCircleIcon className="h-3.5 w-3.5" />
            Başarısız
          </span>
        );
      case 'SKIPPED':
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-kp-xs bg-kp-bg px-2 py-0.5 text-xs font-semibold text-kp-text-tertiary">
            <MinusCircleIcon className="h-3.5 w-3.5" />
            Atlandı
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-kp-xl border border-kp-border bg-kp-surface shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-kp-border px-6 py-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-kp-text-primary">
                Çalışma Detayı #{run.id.slice(0, 8)}
              </h2>
              {statusBadge(run.status)}
            </div>
            <p className="mt-0.5 text-xs text-kp-text-tertiary">
              Tarih: {new Date(run.createdAt).toLocaleString('tr-TR')} · Süre: {run.durationMs}ms
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-kp-md p-1 text-kp-text-tertiary hover:bg-kp-surface-hover hover:text-kp-text-primary transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {retrySuccess && (
            <div className="rounded-kp-md bg-kp-success-muted p-3 text-xs text-kp-success">
              {retrySuccess}
            </div>
          )}
          {retryError && (
            <div className="rounded-kp-md bg-kp-danger-muted p-3 text-xs text-kp-danger">
              {retryError}
            </div>
          )}

          {/* Quick Info Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-kp-md border border-kp-border bg-kp-bg/40 p-3">
              <div className="text-[11px] text-kp-text-tertiary">Kural</div>
              <div className="mt-1 text-xs font-semibold text-kp-text-primary truncate">
                {run.rule?.name || run.ruleId}
              </div>
            </div>
            <div className="rounded-kp-md border border-kp-border bg-kp-bg/40 p-3">
              <div className="text-[11px] text-kp-text-tertiary">Sipariş No</div>
              <div className="mt-1 text-xs font-semibold text-kp-accent truncate">
                {run.order?.orderNumber || run.orderId}
              </div>
            </div>
            <div className="rounded-kp-md border border-kp-border bg-kp-bg/40 p-3">
              <div className="text-[11px] text-kp-text-tertiary">Tetikleyici Olay</div>
              <div className="mt-1 text-xs font-semibold text-kp-text-primary truncate">
                {run.triggerEvent}
              </div>
            </div>
            <div className="rounded-kp-md border border-kp-border bg-kp-bg/40 p-3">
              <div className="text-[11px] text-kp-text-tertiary">Sipariş Tutarı</div>
              <div className="mt-1 text-xs font-semibold text-kp-text-primary truncate">
                {run.order ? `${run.order.totalAmount} ${run.order.currency}` : '—'}
              </div>
            </div>
          </div>

          {/* Skip Reason if Skipped */}
          {run.skipReason && (
            <div className="rounded-kp-md border border-kp-warning/30 bg-kp-warning-muted/40 p-3.5">
              <div className="text-xs font-semibold text-kp-warning">Atlanma Nedeni:</div>
              <div className="mt-1 text-xs text-kp-text-secondary">{run.skipReason}</div>
            </div>
          )}

          {/* Condition Trace Tree */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-kp-text-secondary">
              Koşul Değerlendirme İzi (Condition Trace)
            </h3>
            {run.conditionTrace ? (
              <div className="rounded-kp-md border border-kp-border bg-kp-bg/30 p-4 space-y-2 font-mono text-xs">
                <div className="flex items-center gap-2 font-semibold">
                  <span>KÖK ({run.conditionTrace.operator.toUpperCase()}):</span>
                  {run.conditionTrace.matched ? (
                    <span className="text-kp-success flex items-center gap-1">
                      <CheckCircleIcon className="h-4 w-4" /> Eşleşti (Matched)
                    </span>
                  ) : (
                    <span className="text-kp-danger flex items-center gap-1">
                      <XCircleIcon className="h-4 w-4" /> Eşleşmedi (Unmatched)
                    </span>
                  )}
                </div>

                <div className="mt-2 pl-4 border-l-2 border-kp-border space-y-2">
                  {run.conditionTrace.children?.map((child, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start justify-between rounded-kp-xs p-2 ${
                        child.matched ? 'bg-kp-success-muted/30' : 'bg-kp-danger-muted/30'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="font-semibold text-kp-text-primary">
                          {child.field} <span className="text-kp-accent">{child.operator}</span>{' '}
                          <span className="text-kp-text-secondary">{JSON.stringify(child.expected)}</span>
                        </div>
                        <div className="text-[11px] text-kp-text-tertiary">
                          Sipariş Değeri: <span className="text-kp-text-primary font-medium">{JSON.stringify(child.actual)}</span>
                        </div>
                      </div>
                      <div>
                        {child.matched ? (
                          <span className="text-kp-success font-semibold text-xs flex items-center gap-0.5">
                            <CheckCircleIcon className="h-4 w-4" /> ✓
                          </span>
                        ) : (
                          <span className="text-kp-danger font-semibold text-xs flex items-center gap-0.5">
                            <XCircleIcon className="h-4 w-4" /> ✗
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-kp-md bg-kp-bg p-4 text-xs text-kp-text-tertiary italic">
                Bu çalışma için koşul izi kaydı bulunmuyor.
              </div>
            )}
          </div>

          {/* Action Runs List */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-kp-text-secondary">
              Aksiyon Adımları ({run.actionRuns?.length || 0})
            </h3>
            {run.actionRuns && run.actionRuns.length > 0 ? (
              <div className="space-y-2">
                {run.actionRuns.map((act) => (
                  <div
                    key={act.id}
                    className="rounded-kp-md border border-kp-border bg-kp-surface p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-kp-bg text-[10px] font-bold text-kp-text-secondary">
                          {act.stepIndex + 1}
                        </span>
                        <span className="text-xs font-bold text-kp-text-primary">
                          {act.actionType}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-kp-text-tertiary">
                          {act.durationMs}ms
                        </span>
                        {act.status === 'SUCCESS' && (
                          <span className="text-kp-success text-xs font-medium flex items-center gap-0.5">
                            <CheckCircleIcon className="h-3.5 w-3.5" /> Başarılı
                          </span>
                        )}
                        {act.status === 'FAILED' && (
                          <span className="text-kp-danger text-xs font-medium flex items-center gap-0.5">
                            <XCircleIcon className="h-3.5 w-3.5" /> Başarısız
                          </span>
                        )}
                        {act.status === 'SKIPPED' && (
                          <span className="text-kp-text-tertiary text-xs font-medium flex items-center gap-0.5">
                            <MinusCircleIcon className="h-3.5 w-3.5" /> Atlandı
                          </span>
                        )}
                      </div>
                    </div>

                    {act.errorMessage && (
                      <div className="rounded-kp-xs bg-kp-danger-muted p-2 text-xs text-kp-danger">
                        Hata: {act.errorMessage}
                      </div>
                    )}

                    {(act.inputPayload || act.outputPayload) && (
                      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                        {act.inputPayload && (
                          <div className="rounded-kp-xs bg-kp-bg/50 p-2 overflow-x-auto">
                            <div className="text-kp-text-tertiary font-sans font-medium mb-1">Girdi:</div>
                            <pre className="text-kp-text-secondary">{JSON.stringify(act.inputPayload, null, 2)}</pre>
                          </div>
                        )}
                        {act.outputPayload && (
                          <div className="rounded-kp-xs bg-kp-bg/50 p-2 overflow-x-auto">
                            <div className="text-kp-text-tertiary font-sans font-medium mb-1">Çıktı:</div>
                            <pre className="text-kp-text-secondary">{JSON.stringify(act.outputPayload, null, 2)}</pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-kp-md bg-kp-bg p-4 text-xs text-kp-text-tertiary italic">
                Aksiyon çalıştırılmadı.
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-kp-border px-6 py-3 bg-kp-bg/30">
          <button
            type="button"
            onClick={onClose}
            className="rounded-kp-md border border-kp-border bg-kp-surface px-4 py-1.5 text-xs font-semibold text-kp-text-secondary hover:bg-kp-surface-hover hover:text-kp-text-primary transition-colors"
          >
            Kapat
          </button>

          <button
            type="button"
            onClick={handleRetry}
            disabled={retrying}
            className="flex items-center gap-1.5 rounded-kp-md bg-kp-accent px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-3.5 w-3.5 ${retrying ? 'animate-spin' : ''}`} />
            <span>Tekrar Dene</span>
          </button>
        </div>
      </div>
    </div>
  );
}
