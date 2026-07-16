'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

interface Shipment {
  id: string;
  orderNumber: string;
  customerName: string;
  carrier: string;
  trackingNumber: string;
  packagingStatus: string;
  createdAt: string;
}

export default function WmsShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        const data = await apiFetch<Shipment[]>('/wms/shipments');
        setShipments(data);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetch();
  }, []);

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
        <p className="mt-1 text-[13px] text-kp-text-tertiary">Packed orders ready for courier pickup and dispatch tracking.</p>
      </div>

      <div className="card p-5">
        <div className="flex justify-between items-center mb-5 border-b border-kp-border pb-4">
          <input type="text" placeholder="Search by tracking number or customer…"
            className="w-80 rounded-kp-md border border-kp-border bg-kp-bg-primary px-3 py-2 text-[13px] text-kp-text-primary placeholder-kp-text-tertiary focus:border-kp-border-accent focus:outline-none" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-kp-border text-kp-text-tertiary">
                <th className="pb-2 font-medium">Shipment ID</th>
                <th className="pb-2 font-medium">Order #</th>
                <th className="pb-2 font-medium">Recipient</th>
                <th className="pb-2 font-medium">Carrier</th>
                <th className="pb-2 font-medium">Tracking</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-kp-border">
              {shipments.map((ship) => (
                <tr key={ship.id}>
                  <td className="py-3 font-mono text-[10px] text-kp-text-tertiary">{ship.id.substring(0, 15)}…</td>
                  <td className="py-3 font-semibold text-kp-text-primary">{ship.orderNumber}</td>
                  <td className="py-3 text-kp-text-secondary">{ship.customerName}</td>
                  <td className="py-3 text-kp-text-secondary">{ship.carrier}</td>
                  <td className="py-3 font-mono text-kp-text-tertiary">{ship.trackingNumber}</td>
                  <td className="py-3">
                    <span className={`badge ${ship.packagingStatus === 'packed' ? 'badge--success' : 'badge--warning'}`}>
                      {ship.packagingStatus === 'packed' ? 'Awaiting Courier' : 'Preparing'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
