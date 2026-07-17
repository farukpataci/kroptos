'use client';

import useSWR from 'swr';
import { apiFetch } from '@/lib/api';

const fetcher = (url: string) => apiFetch<any>(url);

export function AuditLogsShortcutPanel() {
  const { data: logsData, error } = useSWR<any>('/audit-logs?take=20', fetcher);

  if (error) return <div className="text-red-500">Failed to load audit logs.</div>;
  if (!logsData) return <div className="animate-pulse h-64 bg-gray-100 rounded-lg"></div>;

  const logs = logsData.items || [];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium leading-6 text-gray-900">Audit & Activity Logs</h3>
        <p className="mt-1 text-sm text-gray-500">Track all operational changes and security events in your workspace.</p>
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-left">
            <tr>
              <th className="px-6 py-3">Action</th>
              <th className="px-6 py-3">Module</th>
              <th className="px-6 py-3">Entity Type</th>
              <th className="px-6 py-3">User</th>
              <th className="px-6 py-3">IP Address</th>
              <th className="px-6 py-3">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {logs.map((log: any) => (
              <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="whitespace-nowrap px-6 py-4 font-semibold text-gray-700">{log.action}</td>
                <td className="whitespace-nowrap px-6 py-4 text-gray-500 capitalize">{log.module || 'System'}</td>
                <td className="whitespace-nowrap px-6 py-4 text-gray-500">{log.entityType}</td>
                <td className="whitespace-nowrap px-6 py-4 text-gray-900 font-medium">
                  {log.userName || log.userEmail || 'System'}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-gray-400 font-mono text-xs">{log.ipAddress || '—'}</td>
                <td className="whitespace-nowrap px-6 py-4 text-gray-400">
                  {new Date(log.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
            {!logs.length && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-400 italic">
                  No activity logs found for this workspace.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
