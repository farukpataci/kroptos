'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
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

export default function WmsPackagingPage() {
  const toast = useToast();
  const [orders, setOrders] = useState<PackagingOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const data = await apiFetch<any[]>('/wms/shipments');
      setOrders(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, []);

  const handleStartPacking = (orderNumber: string) => {
    toast.info(`Packing started for order ${orderNumber}. Begin scanning items.`);
  };

  const handleGenerateLabel = async (orderId: string) => {
    try {
      await apiFetch('/wms/labels', { method: 'POST', body: JSON.stringify({ orderId }) });
      toast.success('Shipping label generated! Check Settings → Label Preview for output.');
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate label.');
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
        <p className="mt-1 text-[13px] text-kp-text-tertiary">List pending orders, verify items, and print shipping labels.</p>
      </div>

      <div className="card p-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5 border-b border-kp-border pb-4">
          <input type="text" placeholder="Scan order barcode or tracking number…"
            className="w-full sm:w-80 rounded-kp-md border border-kp-border bg-kp-bg-primary px-3 py-2 text-[13px] text-kp-text-primary placeholder-kp-text-tertiary focus:border-kp-border-accent focus:outline-none" />
          <button onClick={fetchOrders}
            className="flex items-center gap-1.5 rounded-kp-md border border-kp-border bg-kp-bg-primary/50 px-3 py-2 text-[12px] font-medium text-kp-text-secondary hover:border-kp-border-accent hover:text-kp-text-primary transition-all">
            <ArrowPathIcon className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>

        {orders.length === 0 ? (
          <p className="py-8 text-center text-xs text-kp-text-tertiary">No orders awaiting packaging.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-kp-border text-kp-text-tertiary">
                  <th className="pb-2 font-medium">Order #</th>
                  <th className="pb-2 font-medium">Customer</th>
                  <th className="pb-2 font-medium">Source</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-kp-border">
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="py-3 font-semibold text-kp-text-primary">{order.orderNumber}</td>
                    <td className="py-3 text-kp-text-secondary">{order.customerName}</td>
                    <td className="py-3 capitalize text-kp-text-tertiary">{order.source}</td>
                    <td className="py-3">
                      <span className={`badge ${
                        order.packagingStatus === 'packed' ? 'badge--success'
                          : order.packagingStatus === 'packing' ? 'badge--warning' : 'badge--accent'
                      }`}>
                        {order.packagingStatus === 'packed' ? 'Packed' : order.packagingStatus === 'packing' ? 'Packing' : 'Pending'}
                      </span>
                    </td>
                    <td className="py-3 text-kp-text-tertiary">{new Date(order.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 text-right space-x-2">
                      {order.packagingStatus !== 'packed' && (
                        <button onClick={() => handleStartPacking(order.orderNumber)}
                          className="rounded-kp-md border border-kp-border bg-kp-bg-primary/50 px-3 py-1.5 text-[11px] font-medium text-kp-text-secondary hover:border-kp-border-accent hover:text-kp-text-primary transition-all">
                          Pack
                        </button>
                      )}
                      <button onClick={() => handleGenerateLabel(order.orderId)}
                        className="rounded-kp-md bg-kp-accent px-3 py-1.5 text-[11px] font-semibold text-white shadow-kp-glow transition-colors hover:bg-kp-accent-hover">
                        Print Label
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
