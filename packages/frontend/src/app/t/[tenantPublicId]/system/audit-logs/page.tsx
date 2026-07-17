'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import {
  ClipboardDocumentListIcon,
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  ArrowDownTrayIcon,
  ExclamationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  // Filters
  const [moduleFilter, setModuleFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/audit-logs', {
        params: {
          module: moduleFilter || undefined,
          severity: severityFilter || undefined,
        },
      });
      setLogs(data.items || []);
    } catch (err) {
      console.error('Failed to fetch audit logs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [moduleFilter, severityFilter]);

  const severityColors: any = {
    info: 'badge--info',
    warning: 'badge--warning',
    error: 'badge--danger',
    critical: 'bg-red-900 text-white border-red-700',
  };

  return (
    <div className="flex h-full flex-col p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-kp-text-primary tracking-tight">System History</h1>
          <p className="text-sm text-kp-text-secondary mt-1">
            Complete history of system changes, user actions, and data mutations.
          </p>
        </div>
        <button className="flex items-center gap-2 rounded-kp-md bg-kp-bg-secondary border border-kp-border px-4 py-2 text-sm font-medium text-kp-text-primary hover:border-kp-border-hover transition-colors">
          <ArrowDownTrayIcon className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Today\'s Actions', value: '342' },
          { label: 'Critical Events', value: '2' },
          { label: 'Failed Logins', value: '14' },
          { label: 'Tenant Switches', value: '8' },
        ].map((card, i) => (
          <div key={i} className="rounded-kp-lg border border-kp-border bg-kp-bg-secondary p-4 flex flex-col justify-between">
            <span className="text-xs font-semibold text-kp-text-tertiary uppercase tracking-wider">{card.label}</span>
            <span className="text-2xl font-bold text-kp-text-primary mt-2">{card.value}</span>
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
              placeholder="Search user, entity, or action..."
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
            value={severityFilter}
            onChange={e => setSeverityFilter(e.target.value)}
            className="h-9 rounded-kp-md border border-kp-border bg-kp-bg-primary px-3 text-sm text-kp-text-primary focus:border-kp-accent focus:outline-none"
          >
            <option value="">All Severities</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
            <option value="critical">Critical</option>
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
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Entity</th>
                <th className="px-4 py-3 font-medium">Severity</th>
                <th className="px-4 py-3 font-medium text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-kp-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-kp-text-tertiary">
                    Loading logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-kp-text-tertiary">
                    No logs found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-kp-bg-hover/50 transition-colors">
                    <td className="px-4 py-3 text-kp-text-secondary whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-kp-text-primary">{log.userName || 'System'}</div>
                      <div className="text-[11px] text-kp-text-tertiary">{log.userEmail || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-kp-text-primary font-medium">{log.action}</td>
                    <td className="px-4 py-3">
                      <span className="text-kp-text-secondary">{log.entityType}</span>
                      <span className="ml-2 text-[11px] text-kp-text-tertiary">#{log.entityId}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${severityColors[log.severity] || 'badge--info'}`}>
                        {log.severity.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button 
                        onClick={() => setSelectedLog(log)}
                        className="rounded-kp-md border border-kp-border bg-kp-bg-primary px-3 py-1.5 text-xs font-medium text-kp-text-secondary hover:text-kp-text-primary transition-colors"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Drawer Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="h-full w-full max-w-2xl bg-kp-bg-secondary border-l border-kp-border shadow-2xl flex flex-col transform transition-transform duration-300">
            <div className="flex items-center justify-between border-b border-kp-border p-6">
              <div>
                <h2 className="text-lg font-semibold text-kp-text-primary">Log Detail</h2>
                <p className="text-sm text-kp-text-tertiary mt-1">ID: {selectedLog.id}</p>
              </div>
              <button 
                onClick={() => setSelectedLog(null)}
                className="rounded-kp-sm p-2 text-kp-text-tertiary hover:bg-kp-bg-hover hover:text-kp-text-primary transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* General Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="block text-kp-text-tertiary text-[11px] uppercase tracking-wider font-semibold">User</span>
                  <span className="block text-kp-text-primary mt-1">{selectedLog.userName || 'System'} ({selectedLog.userEmail})</span>
                </div>
                <div>
                  <span className="block text-kp-text-tertiary text-[11px] uppercase tracking-wider font-semibold">Action</span>
                  <span className="block text-kp-text-primary mt-1">{selectedLog.action}</span>
                </div>
                <div>
                  <span className="block text-kp-text-tertiary text-[11px] uppercase tracking-wider font-semibold">Entity</span>
                  <span className="block text-kp-text-primary mt-1">{selectedLog.entityType} - {selectedLog.entityId}</span>
                </div>
                <div>
                  <span className="block text-kp-text-tertiary text-[11px] uppercase tracking-wider font-semibold">Date</span>
                  <span className="block text-kp-text-primary mt-1">{new Date(selectedLog.createdAt).toLocaleString()}</span>
                </div>
              </div>

              {/* Description */}
              {selectedLog.description && (
                <div className="rounded-kp-md bg-kp-bg-active p-3 text-sm text-kp-text-primary border border-kp-border">
                  {selectedLog.description}
                </div>
              )}

              {/* Value Changes (Diff Viewer placeholder) */}
              {(selectedLog.oldValue || selectedLog.newValue) && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-kp-text-secondary uppercase tracking-widest border-b border-kp-border pb-2">Data Changes</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-kp-md bg-black/40 border border-kp-border p-4">
                      <span className="block text-xs font-semibold text-kp-danger mb-2">Old Value</span>
                      <pre className="text-xs text-kp-text-secondary overflow-x-auto">
                        {JSON.stringify(selectedLog.oldValue, null, 2)}
                      </pre>
                    </div>
                    <div className="rounded-kp-md bg-black/40 border border-kp-border p-4">
                      <span className="block text-xs font-semibold text-kp-success mb-2">New Value</span>
                      <pre className="text-xs text-kp-text-secondary overflow-x-auto">
                        {JSON.stringify(selectedLog.newValue, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Metadata */}
              {selectedLog.metadata && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-kp-text-secondary uppercase tracking-widest border-b border-kp-border pb-2">Metadata</h3>
                  <div className="rounded-kp-md bg-black/40 border border-kp-border p-4">
                    <pre className="text-xs text-kp-text-secondary overflow-x-auto">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
