'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import {
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  XMarkIcon,
  EyeIcon,
  CodeBracketIcon
} from '@heroicons/react/24/outline';

export default function IntegrationErrorsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedError, setSelectedError] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Filters
  const [providerFilter, setProviderFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/integration-logs', {
        params: {
          provider: providerFilter || undefined,
          status: statusFilter || undefined,
        },
      });
      setLogs(data.items || []);
    } catch (err) {
      console.error('Failed to fetch integration logs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [providerFilter, statusFilter]);

  const handleAction = async (id: string, actionType: 'retry' | 'resolve' | 'ignore', resolutionNote?: string) => {
    setActionLoading(true);
    try {
      let payload = {};
      if (resolutionNote) payload = { resolutionNote };
      
      await api.post(`/integration-logs/${id}/${actionType}`, payload);
      await fetchLogs(); // Refresh
      if (selectedError?.id === id) {
        setSelectedError(null);
      }
    } catch (err) {
      console.error(`Failed to ${actionType} log ${id}`, err);
    } finally {
      setActionLoading(false);
    }
  };

  const statusColors: any = {
    pending: 'badge--info',
    processing: 'badge--warning',
    success: 'badge--success',
    failed: 'badge--danger',
    retrying: 'bg-purple-900/30 text-purple-400 border-purple-700/50',
    resolved: 'badge--info',
    ignored: 'bg-gray-800 text-gray-400 border-gray-600',
  };

  return (
    <div className="flex h-full flex-col p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-kp-text-primary tracking-tight">Integration Error Center</h1>
          <p className="text-sm text-kp-text-secondary mt-1">
            Monitor and resolve sync issues across your integrations.
          </p>
        </div>
        <button 
          onClick={fetchLogs}
          className="flex items-center gap-2 rounded-kp-md bg-kp-bg-secondary border border-kp-border px-4 py-2 text-sm font-medium text-kp-text-primary hover:border-kp-border-hover transition-colors"
        >
          <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Unresolved Errors', value: '18', color: 'text-kp-danger' },
          { label: 'Critical Errors', value: '3', color: 'text-kp-danger' },
          { label: 'Pending Retries', value: '5', color: 'text-purple-400' },
          { label: 'Today\'s Syncs', value: '1,204', color: 'text-kp-success' },
        ].map((card, i) => (
          <div key={i} className="rounded-kp-lg border border-kp-border bg-kp-bg-secondary p-4 flex flex-col justify-between">
            <span className="text-xs font-semibold text-kp-text-tertiary uppercase tracking-wider">{card.label}</span>
            <span className={`text-2xl font-bold mt-2 ${card.color}`}>{card.value}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between rounded-kp-lg border border-kp-border bg-kp-bg-secondary p-3">
        <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
          <div className="relative w-full max-w-sm">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-kp-text-tertiary" />
            <input
              type="text"
              placeholder="Search by Order No, SKU or reference..."
              className="h-9 w-full rounded-kp-md border border-kp-border bg-kp-bg-primary pl-9 pr-4 text-sm text-kp-text-primary placeholder:text-kp-text-tertiary focus:border-kp-accent focus:outline-none focus:ring-1 focus:ring-kp-accent"
            />
          </div>
          <button className="flex h-9 items-center gap-2 rounded-kp-md border border-kp-border bg-kp-bg-primary px-3 text-sm font-medium text-kp-text-secondary hover:text-kp-text-primary">
            <AdjustmentsHorizontalIcon className="h-4 w-4" />
            Filters
          </button>
        </div>
        <div className="flex gap-2">
          <select 
            value={providerFilter}
            onChange={e => setProviderFilter(e.target.value)}
            className="h-9 rounded-kp-md border border-kp-border bg-kp-bg-primary px-3 text-sm text-kp-text-primary focus:border-kp-accent focus:outline-none"
          >
            <option value="">All Providers</option>
            <option value="logo">Logo ERP</option>
            <option value="trendyol">Trendyol</option>
            <option value="shopify">Shopify</option>
          </select>

          <select 
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="h-9 rounded-kp-md border border-kp-border bg-kp-bg-primary px-3 text-sm text-kp-text-primary focus:border-kp-accent focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="failed">Failed</option>
            <option value="retrying">Retrying</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </div>

      {/* Data Table */}
      <div className="flex-1 overflow-hidden rounded-kp-lg border border-kp-border bg-kp-bg-secondary flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-kp-bg-tertiary/50">
              <tr className="border-b border-kp-border text-kp-text-tertiary">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Provider</th>
                <th className="px-4 py-3 font-medium">Entity</th>
                <th className="px-4 py-3 font-medium">Error Step</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-kp-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-kp-text-tertiary">
                    Loading errors...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-kp-text-tertiary">
                    No integration errors found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-kp-bg-hover/50 transition-colors">
                    <td className="px-4 py-3 text-kp-text-secondary whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-kp-text-primary capitalize">{log.provider}</div>
                      <div className="text-[11px] text-kp-text-tertiary">{log.operation}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-kp-text-primary">{log.entityType}</div>
                      <div className="text-[11px] text-kp-text-tertiary">#{log.entityId || log.sourceReference}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-kp-text-secondary truncate max-w-xs">{log.errorStep || 'Unknown Step'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${statusColors[log.status] || 'badge--info'}`}>
                        {log.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {log.status === 'failed' && (
                          <button 
                            onClick={() => handleAction(log.id, 'retry')}
                            disabled={actionLoading}
                            className="rounded-kp-md border border-kp-accent bg-kp-accent/10 px-3 py-1.5 text-xs font-medium text-kp-accent hover:bg-kp-accent hover:text-white transition-colors"
                          >
                            Retry
                          </button>
                        )}
                        <button 
                          onClick={() => setSelectedError(log)}
                          className="rounded-kp-md border border-kp-border bg-kp-bg-primary px-3 py-1.5 text-xs font-medium text-kp-text-secondary hover:text-kp-text-primary transition-colors"
                        >
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Drawer Modal */}
      {selectedError && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="h-full w-full max-w-2xl bg-kp-bg-secondary border-l border-kp-border shadow-2xl flex flex-col transform transition-transform duration-300">
            <div className="flex items-center justify-between border-b border-kp-border p-6">
              <div>
                <h2 className="text-lg font-semibold text-kp-text-primary flex items-center gap-2">
                  <ExclamationTriangleIcon className="h-5 w-5 text-kp-danger" />
                  Integration Error Details
                </h2>
                <p className="text-sm text-kp-text-tertiary mt-1">ID: {selectedError.id}</p>
              </div>
              <button 
                onClick={() => setSelectedError(null)}
                className="rounded-kp-sm p-2 text-kp-text-tertiary hover:bg-kp-bg-hover hover:text-kp-text-primary transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* General Info */}
              <div className="grid grid-cols-2 gap-4 text-sm bg-black/20 p-4 rounded-kp-md border border-kp-border-subtle">
                <div>
                  <span className="block text-kp-text-tertiary text-[11px] uppercase tracking-wider font-semibold">Provider / Operation</span>
                  <span className="block text-kp-text-primary mt-1 font-medium capitalize">{selectedError.provider} - {selectedError.operation}</span>
                </div>
                <div>
                  <span className="block text-kp-text-tertiary text-[11px] uppercase tracking-wider font-semibold">Status</span>
                  <span className={`inline-block mt-1 badge ${statusColors[selectedError.status] || 'badge--info'}`}>
                    {selectedError.status.toUpperCase()}
                  </span>
                </div>
                <div>
                  <span className="block text-kp-text-tertiary text-[11px] uppercase tracking-wider font-semibold">Source Ref</span>
                  <span className="block text-kp-text-primary mt-1">{selectedError.sourceReference || '-'}</span>
                </div>
                <div>
                  <span className="block text-kp-text-tertiary text-[11px] uppercase tracking-wider font-semibold">Retries</span>
                  <span className="block text-kp-text-primary mt-1">{selectedError.retryCount} / {selectedError.maxRetryCount}</span>
                </div>
              </div>

              {/* Error Details */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-kp-text-secondary uppercase tracking-widest border-b border-kp-border pb-2">Error Message</h3>
                <div className="rounded-kp-md bg-kp-danger-muted border border-kp-danger-muted p-4">
                  <span className="block text-[13px] font-semibold text-kp-danger mb-1">Step: {selectedError.errorStep || 'Execution'}</span>
                  <p className="text-sm text-white/90 font-medium">
                    {selectedError.errorMessage || 'An unknown error occurred during sync.'}
                  </p>
                </div>
              </div>

              {/* Suggestion */}
              {selectedError.suggestedAction && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-kp-text-secondary uppercase tracking-widest border-b border-kp-border pb-2">Suggested Action</h3>
                  <div className="rounded-kp-md bg-kp-bg-active border border-kp-accent p-4 flex gap-3">
                    <CheckCircleIcon className="h-5 w-5 text-kp-accent flex-shrink-0" />
                    <p className="text-sm text-kp-text-primary">
                      {selectedError.suggestedAction}
                    </p>
                  </div>
                </div>
              )}

              {/* Payloads */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-kp-text-secondary uppercase tracking-widest border-b border-kp-border pb-2 flex items-center gap-2">
                  <CodeBracketIcon className="h-4 w-4" />
                  API Payloads
                </h3>
                
                {selectedError.requestPayload && (
                  <div>
                    <span className="block text-xs font-semibold text-kp-text-tertiary mb-1">Request Payload</span>
                    <div className="rounded-kp-md bg-black/40 border border-kp-border p-3">
                      <pre className="text-xs text-kp-text-secondary overflow-x-auto">
                        {JSON.stringify(selectedError.requestPayload, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
                
                {selectedError.responsePayload && (
                  <div className="mt-4">
                    <span className="block text-xs font-semibold text-kp-text-tertiary mb-1">Response Payload</span>
                    <div className="rounded-kp-md bg-black/40 border border-kp-border p-3">
                      <pre className="text-xs text-kp-text-secondary overflow-x-auto">
                        {JSON.stringify(selectedError.responsePayload, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>

              {/* Stack Trace */}
              {selectedError.errorStack && (
                <div className="space-y-3 pt-4">
                  <details className="group">
                    <summary className="cursor-pointer text-xs font-semibold text-kp-text-tertiary uppercase tracking-widest hover:text-kp-text-primary transition-colors">
                      Show Technical Stack Trace
                    </summary>
                    <div className="mt-3 rounded-kp-md bg-black border border-kp-border p-3 overflow-x-auto">
                      <pre className="text-[10px] text-kp-danger/70 whitespace-pre-wrap">
                        {selectedError.errorStack}
                      </pre>
                    </div>
                  </details>
                </div>
              )}
            </div>
            
            {/* Action Footer */}
            <div className="border-t border-kp-border p-6 bg-kp-bg-primary flex justify-end gap-3">
              {selectedError.status !== 'resolved' && selectedError.status !== 'ignored' && (
                <>
                  <button 
                    onClick={() => handleAction(selectedError.id, 'ignore', 'Manually ignored by user')}
                    disabled={actionLoading}
                    className="flex items-center gap-2 rounded-kp-md border border-kp-border bg-kp-bg-secondary px-4 py-2 text-sm font-medium text-kp-text-secondary hover:text-white hover:bg-gray-800 transition-colors"
                  >
                    <XCircleIcon className="h-4 w-4" />
                    Ignore
                  </button>
                  <button 
                    onClick={() => handleAction(selectedError.id, 'resolve', 'Manually marked as resolved')}
                    disabled={actionLoading}
                    className="flex items-center gap-2 rounded-kp-md border border-kp-success-muted bg-kp-success-muted/10 px-4 py-2 text-sm font-medium text-kp-success hover:text-white hover:bg-kp-success transition-colors"
                  >
                    <CheckCircleIcon className="h-4 w-4" />
                    Mark Resolved
                  </button>
                  <button 
                    onClick={() => handleAction(selectedError.id, 'retry')}
                    disabled={actionLoading}
                    className="flex items-center gap-2 rounded-kp-md bg-kp-accent px-4 py-2 text-sm font-medium text-white hover:bg-kp-accent-hover transition-colors shadow-kp-glow"
                  >
                    <ArrowPathIcon className="h-4 w-4" />
                    Retry Sync
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
