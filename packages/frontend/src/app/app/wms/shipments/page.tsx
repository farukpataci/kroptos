'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { ArrowPathIcon, PrinterIcon, TruckIcon } from '@heroicons/react/24/outline';
import { useToast } from '@/components/ui/Toast';
import { printManifest } from './manifest';

interface Shipment {
  id: string;
  publicId: string;
  provider: string;
  status: string;
  barcode: string | null;
  trackingNumber: string | null;
  referenceCode: string | null;
  totalDesi: number | null;
  totalWeightKg: number | null;
  handedOverAt: string | null;
  createdAt: string;
}

interface HandoverResult {
  handedOverAt: string;
  handedOver: Shipment[];
  refused: { id: string; code: string; message: string }[];
}

/** Nothing to scan, or already gone: not a parcel this screen can hand over. */
function handoverable(row: Shipment) {
  return Boolean(row.barcode || row.trackingNumber) && row.status !== 'cancelled';
}

export default function WmsShipmentsPage() {
  const toast = useToast();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [isHandingOver, setIsHandingOver] = useState(false);
  const [lastManifest, setLastManifest] = useState<HandoverResult | null>(null);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiFetch<{ items: Shipment[] }>('/shipments', {
        params: { pageSize: 100, q: query || undefined },
      });
      setShipments(data.items);
    } catch (err: any) {
      toast.error(err.message || 'Shipments could not be loaded.');
    } finally {
      setLoading(false);
    }
    // toast is stable enough for this screen; re-running on it would refetch on
    // every toast.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const pending = shipments.filter((row) => handoverable(row) && !row.handedOverAt);

  const handover = async () => {
    setIsHandingOver(true);
    try {
      const result = await apiFetch<HandoverResult>('/shipments/handover', {
        method: 'POST',
        body: JSON.stringify({ shipmentIds: selected }),
      });
      setLastManifest(result);
      setSelected([]);

      if (result.refused.length === 0) {
        toast.success(`${result.handedOver.length} parcel(s) handed over.`);
      } else {
        toast.warning(
          `${result.handedOver.length} handed over, ${result.refused.length} refused: ` +
            result.refused.map((r) => r.message).join(' '),
        );
      }
      load();
    } catch (err: any) {
      toast.error(err.message || 'Handover failed.');
    } finally {
      setIsHandingOver(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center animate-fade-in">
        <ArrowPathIcon className="h-8 w-8 text-kp-accent animate-spin" />
        <p className="mt-2 text-xs text-kp-text-tertiary">Loading shipments...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold text-kp-text-primary">Shipment Dispatch</h1>
        <p className="mt-1 text-[0.8125rem] text-kp-text-tertiary">
          Hand the packed parcels to the courier and print the manifest they sign.
        </p>
      </div>

      <div className="card p-5">
        <div className="mb-5 flex flex-col items-start justify-between gap-3 border-b border-kp-border pb-4 sm:flex-row sm:items-center">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by barcode, tracking or order number…"
            className="w-full rounded-kp-md border border-kp-border bg-kp-bg-primary px-3 py-2 text-[0.8125rem] text-kp-text-primary placeholder-kp-text-tertiary focus:border-kp-border-accent focus:outline-none sm:w-96"
          />
          <div className="flex items-center gap-2">
            <span className="text-[0.75rem] text-kp-text-tertiary">
              {selected.length} selected · {pending.length} waiting
            </span>
            <button
              onClick={handover}
              disabled={selected.length === 0 || isHandingOver}
              className="flex items-center gap-1.5 rounded-kp-md bg-kp-accent px-4 py-2 text-[0.75rem] font-semibold text-white transition-colors hover:bg-kp-accent-hover disabled:opacity-40"
            >
              <TruckIcon className="h-4 w-4" />
              Hand over ({selected.length})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[0.75rem]">
            <thead>
              <tr className="border-b border-kp-border text-kp-text-tertiary">
                <th className="pb-2 font-medium" />
                <th className="pb-2 font-medium">Barcode</th>
                <th className="pb-2 font-medium">Carrier</th>
                <th className="pb-2 font-medium">Tracking</th>
                <th className="pb-2 font-medium">Desi</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Handed over</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-kp-border">
              {shipments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-kp-text-tertiary">
                    Nothing to dispatch. A parcel appears here once its label is printed.
                  </td>
                </tr>
              ) : (
                shipments.map((row) => (
                  <tr key={row.id}>
                    <td className="py-3">
                      <input
                        type="checkbox"
                        checked={selected.includes(row.id)}
                        disabled={!handoverable(row)}
                        title={
                          handoverable(row)
                            ? undefined
                            : 'No barcode to scan, or the shipment is cancelled.'
                        }
                        onChange={() => toggle(row.id)}
                      />
                    </td>
                    <td className="py-3 font-mono font-semibold text-kp-accent">
                      {row.barcode || '—'}
                    </td>
                    <td className="py-3 uppercase text-kp-text-primary">{row.provider}</td>
                    <td className="py-3 font-mono text-kp-text-secondary">
                      {row.trackingNumber || '—'}
                    </td>
                    <td className="py-3 text-kp-text-secondary">{row.totalDesi ?? '—'}</td>
                    <td className="py-3 text-kp-text-secondary">{row.status.replace(/_/g, ' ')}</td>
                    <td className="py-3 text-kp-text-tertiary">
                      {row.handedOverAt ? new Date(row.handedOverAt).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {lastManifest && lastManifest.handedOver.length > 0 && (
        <div className="card space-y-3 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[0.8125rem] font-semibold text-kp-text-primary">
              Manifest · {new Date(lastManifest.handedOverAt).toLocaleString()} ·{' '}
              {lastManifest.handedOver.length} parcel(s)
            </h2>
            <button
              onClick={() => printManifest(lastManifest.handedOverAt, lastManifest.handedOver)}
              className="flex items-center gap-1.5 rounded-kp-md border border-kp-border bg-kp-bg-primary/50 px-3 py-2 text-[0.75rem] font-medium text-kp-text-secondary transition-all hover:border-kp-border-accent hover:text-kp-text-primary"
            >
              <PrinterIcon className="h-4 w-4" /> Print manifest
            </button>
          </div>
          <p className="text-[0.75rem] text-kp-text-tertiary">
            The courier signs the printed copy. Reprinting keeps the original handover time.
          </p>
        </div>
      )}
    </div>
  );
}
