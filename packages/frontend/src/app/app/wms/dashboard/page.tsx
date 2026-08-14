'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import {
  ArrowPathIcon,
  ExclamationTriangleIcon,
  PrinterIcon,
} from '@heroicons/react/24/outline';

interface WmsStatus {
  ordersWaiting: number;
  labelsPending: number;
  packedToday: number;
  stockWarnings: number;
  printerStatus: string;
  activePrinter: string;
  driverInstalled: boolean;
}

interface PrintJob {
  id: string;
  printerName: string;
  status: string;
  errorMessage: string | null;
  printedAt: string | null;
  createdAt: string;
}

export default function WmsDashboard() {
  const [status, setStatus] = useState<WmsStatus | null>(null);
  const [printJobs, setPrintJobs] = useState<PrintJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const statusData = await apiFetch<WmsStatus>('/wms/status');
      setStatus(statusData);

      const jobsData = await apiFetch<PrintJob[]>('/wms/print-jobs');
      setPrintJobs(jobsData);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load warehouse status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center animate-fade-in">
        <ArrowPathIcon className="h-8 w-8 text-kp-accent animate-spin" />
        <p className="mt-2 text-xs text-kp-text-tertiary">Loading warehouse metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center animate-fade-in">
        <ExclamationTriangleIcon className="h-10 w-10 text-kp-danger" />
        <h3 className="mt-4 text-base font-semibold text-kp-text-primary">Failed to load WMS Dashboard</h3>
        <p className="mt-1 text-xs text-kp-text-tertiary">{error}</p>
      </div>
    );
  }

  const kpiCards = status
    ? [
        { title: 'Orders Waiting', value: status.ordersWaiting, unit: 'orders', color: 'accent', note: 'Ready for packing' },
        { title: 'Unprinted Labels', value: status.labelsPending, unit: 'labels', color: 'warning', note: 'Print queue' },
        { title: 'Packed Today', value: status.packedToday, unit: 'orders', color: 'success', note: 'Ready for dispatch' },
        { title: 'Stock Warnings', value: status.stockWarnings, unit: 'products', color: 'danger', note: 'Below threshold' },
      ]
    : [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-kp-text-primary">WMS Dashboard</h1>
          <p className="mt-1 text-[0.8125rem] text-kp-text-tertiary">
            Real-time warehouse status, active printers, and label processing overview.
          </p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="flex items-center gap-1.5 rounded-kp-md border border-kp-border bg-kp-bg-primary/50 px-3 py-2 text-[0.75rem] font-medium text-kp-text-secondary transition-all hover:border-kp-border-accent hover:text-kp-text-primary"
        >
          <ArrowPathIcon className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {kpiCards.map((kpi, idx) => (
          <div
            key={kpi.title}
            className="card p-5 animate-fade-in-up"
            style={{ animationDelay: `${idx * 60}ms`, animationFillMode: 'both' }}
          >
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-kp-text-tertiary">{kpi.title}</p>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-bold text-kp-text-primary">{kpi.value}</span>
              <span className="text-[0.625rem] text-kp-text-tertiary">{kpi.unit}</span>
            </div>
            <p className={`mt-1 text-[0.625rem] font-medium text-kp-${kpi.color}`}>{kpi.note}</p>
          </div>
        ))}
      </div>

      {/* Printer & Print Jobs Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Active Printer Status */}
        {status && (
          <div className="card p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 border-b border-kp-border pb-3 mb-4">
                <PrinterIcon className="h-4 w-4 text-kp-text-tertiary" />
                <h2 className="text-[0.9375rem] font-semibold text-kp-text-primary">Active Printer</h2>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-[0.75rem] text-kp-text-tertiary">Printer Name</span>
                  <span className="text-[0.75rem] font-medium text-kp-text-primary">{status.activePrinter}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[0.75rem] text-kp-text-tertiary">Connection</span>
                  <span className={`inline-flex items-center gap-1.5 text-[0.6875rem] font-semibold ${
                    status.printerStatus === 'connected' ? 'text-kp-success' : 'text-kp-danger'
                  }`}>
                    <span className={`status-dot status-dot--${status.printerStatus === 'connected' ? 'active' : 'error'}`} />
                    {status.printerStatus === 'connected' ? 'Online' : 'Offline'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[0.75rem] text-kp-text-tertiary">Driver Status</span>
                  <span className={`text-[0.75rem] font-medium ${status.driverInstalled ? 'text-kp-success' : 'text-kp-text-tertiary'}`}>
                    {status.driverInstalled ? 'Installed' : 'Not Installed'}
                  </span>
                </div>
              </div>
            </div>

            <Link
              href="/app/wms/settings"
              className="mt-5 flex items-center justify-center rounded-kp-md border border-kp-border bg-kp-bg-primary/50 py-2 text-[0.75rem] font-medium text-kp-text-secondary transition-all hover:border-kp-border-accent hover:text-kp-text-primary"
            >
              Manage Printer Settings
            </Link>
          </div>
        )}

        {/* Recent Print Jobs */}
        <div className="card p-5 lg:col-span-2">
          <div className="border-b border-kp-border pb-3 mb-4">
            <h2 className="text-[0.9375rem] font-semibold text-kp-text-primary">Recent Print Jobs</h2>
            <p className="text-[0.6875rem] text-kp-text-tertiary">Latest label print operations</p>
          </div>
          {printJobs.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-xs text-kp-text-tertiary">
              No print jobs recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[0.75rem]">
                <thead>
                  <tr className="border-b border-kp-border text-kp-text-tertiary">
                    <th className="pb-2 font-medium">Job ID</th>
                    <th className="pb-2 font-medium">Printer</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Created</th>
                    <th className="pb-2 font-medium">Completed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-kp-border">
                  {printJobs.map((job) => (
                    <tr key={job.id}>
                      <td className="py-2.5 font-mono text-[0.625rem] text-kp-text-tertiary">{job.id.substring(0, 10)}…</td>
                      <td className="py-2.5 text-kp-text-secondary">{job.printerName}</td>
                      <td className="py-2.5">
                        <span className={`badge ${job.status === 'printed' ? 'badge--success' : 'badge--warning'}`}>
                          {job.status === 'printed' ? 'Printed' : 'Queued'}
                        </span>
                      </td>
                      <td className="py-2.5 text-kp-text-tertiary">{new Date(job.createdAt).toLocaleTimeString()}</td>
                      <td className="py-2.5 text-kp-text-tertiary">{job.printedAt ? new Date(job.printedAt).toLocaleTimeString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
