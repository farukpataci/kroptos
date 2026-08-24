'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useToast } from '@/components/ui/Toast';

interface PackagingOrder {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  status: string;
  packagingStatus: string;
  source: string;
  createdAt: string;
}

interface Measurement {
  weightKg: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
}

interface BulkResult {
  created: number;
  failed: number;
  results: {
    orderId: string;
    success: boolean;
    label?: { barcode: string; trackingNumber: string; carrierName: string };
    error?: { code?: string; message: string };
  }[];
}

const EMPTY: Measurement = { weightKg: '', lengthCm: '', widthCm: '', heightCm: '' };

const numberInput =
  'w-16 rounded-kp-md border border-kp-border bg-kp-bg-primary px-2 py-1 text-[0.75rem] text-kp-text-primary focus:border-kp-border-accent focus:outline-none';

/** Every field measured and positive, or the order is not ready to label. */
function measured(entry: Measurement | undefined) {
  if (!entry) return false;
  return [entry.weightKg, entry.lengthCm, entry.widthCm, entry.heightCm].every(
    (value) => Number(value) > 0,
  );
}

export default function WmsPackagingPage() {
  const toast = useToast();
  const [orders, setOrders] = useState<PackagingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [boxes, setBoxes] = useState<Record<string, Measurement>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const data = await apiFetch<PackagingOrder[]>('/wms/shipments');
      setOrders(data);
    } catch (err: any) {
      toast.error(err.message || 'Packaging queue could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const toggle = (orderId: string) =>
    setSelected((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId],
    );

  const setBox = (orderId: string, field: keyof Measurement, value: string) =>
    setBoxes((prev) => ({
      ...prev,
      [orderId]: { ...(prev[orderId] ?? EMPTY), [field]: value },
    }));

  const ready = selected.filter((orderId) => measured(boxes[orderId]));

  const createLabels = async () => {
    setIsCreating(true);
    setResult(null);
    try {
      const body = {
        items: ready.map((orderId) => {
          const box = boxes[orderId];
          return {
            orderId,
            // One box per order here. Multi-box orders go through the single
            // label screen, which takes a parcel list.
            parcels: [
              {
                weightKg: Number(box.weightKg),
                lengthCm: Number(box.lengthCm),
                widthCm: Number(box.widthCm),
                heightCm: Number(box.heightCm),
              },
            ],
          };
        }),
      };

      const data = await apiFetch<BulkResult>('/wms/labels/bulk', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setResult(data);

      if (data.failed === 0) toast.success(`${data.created} label(s) created.`);
      else toast.warning(`${data.created} created, ${data.failed} failed. See the list below.`);

      // Only the ones that worked leave the selection; the rest stay so the
      // packer can fix them without hunting through the table again.
      const failedIds = data.results.filter((r) => !r.success).map((r) => r.orderId);
      setSelected(failedIds);
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || 'Labels could not be created.');
    } finally {
      setIsCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center animate-fade-in">
        <ArrowPathIcon className="h-8 w-8 text-kp-accent animate-spin" />
        <p className="mt-2 text-xs text-kp-text-tertiary">Loading packaging queue...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold text-kp-text-primary">Packaging Station</h1>
        <p className="mt-1 text-[0.8125rem] text-kp-text-tertiary">
          Select the orders you packed, enter the box you measured, and take the barcodes in one go.
        </p>
      </div>

      <div className="card p-5">
        <div className="mb-5 flex flex-col items-start justify-between gap-4 border-b border-kp-border pb-4 sm:flex-row sm:items-center">
          <div className="text-[0.75rem] text-kp-text-tertiary">
            {selected.length} selected · {ready.length} measured
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchOrders}
              className="flex items-center gap-1.5 rounded-kp-md border border-kp-border bg-kp-bg-primary/50 px-3 py-2 text-[0.75rem] font-medium text-kp-text-secondary transition-all hover:border-kp-border-accent hover:text-kp-text-primary"
            >
              <ArrowPathIcon className="h-3.5 w-3.5" /> Refresh
            </button>
            <button
              onClick={createLabels}
              disabled={ready.length === 0 || isCreating}
              title={
                selected.length && ready.length === 0
                  ? 'Enter the measurements first: desi and the price come from them, so nothing is assumed here.'
                  : undefined
              }
              className="flex items-center gap-1.5 rounded-kp-md bg-kp-accent px-4 py-2 text-[0.75rem] font-semibold text-white transition-colors hover:bg-kp-accent-hover disabled:opacity-40"
            >
              {isCreating && <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />}
              Create labels ({ready.length})
            </button>
          </div>
        </div>

        {orders.length === 0 ? (
          <p className="py-8 text-center text-xs text-kp-text-tertiary">
            No orders awaiting packaging.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[0.75rem]">
              <thead>
                <tr className="border-b border-kp-border text-kp-text-tertiary">
                  <th className="pb-2 font-medium" />
                  <th className="pb-2 font-medium">Order #</th>
                  <th className="pb-2 font-medium">Customer</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Box (kg · L×W×H cm)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-kp-border">
                {orders.map((order) => {
                  const isSelected = selected.includes(order.orderId);
                  const box = boxes[order.orderId] ?? EMPTY;
                  return (
                    <tr key={order.id}>
                      <td className="py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggle(order.orderId)}
                        />
                      </td>
                      <td className="py-3 font-semibold text-kp-text-primary">
                        {order.orderNumber}
                      </td>
                      <td className="py-3 text-kp-text-secondary">{order.customerName}</td>
                      <td className="py-3">
                        <span
                          className={`badge ${
                            order.packagingStatus === 'packed'
                              ? 'badge--success'
                              : order.packagingStatus === 'packing'
                                ? 'badge--warning'
                                : 'badge--accent'
                          }`}
                        >
                          {order.packagingStatus === 'packed'
                            ? 'Packed'
                            : order.packagingStatus === 'packing'
                              ? 'Packing'
                              : 'Pending'}
                        </span>
                      </td>
                      <td className="py-3">
                        {isSelected ? (
                          <div className="flex items-center gap-1">
                            {(
                              [
                                ['weightKg', 'kg'],
                                ['lengthCm', 'L'],
                                ['widthCm', 'W'],
                                ['heightCm', 'H'],
                              ] as [keyof Measurement, string][]
                            ).map(([field, label]) => (
                              <input
                                key={field}
                                type="number"
                                min={0}
                                step="0.1"
                                placeholder={label}
                                value={box[field]}
                                onChange={(e) => setBox(order.orderId, field, e.target.value)}
                                className={numberInput}
                              />
                            ))}
                          </div>
                        ) : (
                          <span className="text-kp-text-tertiary">—</span>
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

      {result && (
        <div className="card space-y-3 p-5">
          <h2 className="text-[0.8125rem] font-semibold text-kp-text-primary">
            Barcodes from this round
          </h2>
          <ul className="space-y-2">
            {result.results.map((row) => {
              const order = orders.find((o) => o.orderId === row.orderId);
              return (
                <li
                  key={row.orderId}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-kp-border pb-2 text-[0.75rem] last:border-0"
                >
                  <span className="font-semibold text-kp-text-primary">
                    {order?.orderNumber ?? row.orderId}
                  </span>
                  {row.success ? (
                    <>
                      <span className="font-mono text-kp-accent">{row.label?.barcode}</span>
                      <span className="text-kp-text-tertiary">{row.label?.carrierName}</span>
                      <span className="font-mono text-kp-text-secondary">
                        {row.label?.trackingNumber}
                      </span>
                    </>
                  ) : (
                    <span className="flex items-center gap-1 text-kp-danger">
                      <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                      {row.error?.message}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
