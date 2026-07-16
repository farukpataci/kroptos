'use client';

import { useEffect, useState } from 'react';
import { TruckIcon, ArrowPathIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import StatusBadge from '@/components/ui/StatusBadge';

interface Shipment {
  orderId: string;
  orderNumber: string;
  provider: string;
  weight: string;
  packageCount: string;
  trackingNumber: string;
  shippedAt: string;
}

export default function ShippingPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load from local storage
    const stored = localStorage.getItem('simulated_shipments');
    if (stored) {
      try {
        setShipments(JSON.parse(stored));
      } catch (_) {}
    }
    setIsLoading(false);
  }, []);

  const filteredShipments = shipments.filter(s =>
    s.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
    s.trackingNumber.toLowerCase().includes(search.toLowerCase()) ||
    s.provider.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center animate-fade-in">
        <ArrowPathIcon className="h-8 w-8 text-kp-accent animate-spin" />
        <p className="mt-2 text-xs text-kp-text-tertiary">Loading shipments...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between border-b border-kp-border pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-kp-md bg-kp-accent/10 text-kp-accent">
            <TruckIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-kp-text-primary">Shipping Center</h1>
            <p className="text-[13px] text-kp-text-tertiary">Track shipments, carriers, and simulated cargo tracking codes</p>
          </div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center gap-2 max-w-md bg-kp-bg-secondary border border-kp-border rounded-kp-md px-3.5 py-2">
        <MagnifyingGlassIcon className="h-4 w-4 text-kp-text-tertiary" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by order or tracking number..."
          className="w-full bg-transparent text-theme-sm text-kp-text-primary placeholder-kp-text-tertiary focus:outline-hidden"
        />
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-theme-sm text-kp-text-secondary">
            <thead>
              <tr className="border-b border-kp-border text-[11px] font-semibold uppercase tracking-wider text-kp-text-tertiary bg-kp-bg-primary/30">
                <th className="py-3 px-4">Tracking Code</th>
                <th className="py-3 px-4">Order Number</th>
                <th className="py-3 px-4">Carrier</th>
                <th className="py-3 px-4 text-center">Desi / Package</th>
                <th className="py-3 px-4 text-center">Weight</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Shipped Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-kp-border">
              {filteredShipments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-kp-text-tertiary">
                    No shipments tracked. Simulate cargo shipment from the "Orders" details drawer.
                  </td>
                </tr>
              ) : (
                filteredShipments.map((shipment) => (
                  <tr key={shipment.trackingNumber} className="hover:bg-kp-bg-hover/30 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-semibold text-kp-accent">{shipment.trackingNumber}</td>
                    <td className="py-3.5 px-4 font-mono font-medium text-kp-text-primary">{shipment.orderNumber}</td>
                    <td className="py-3.5 px-4 font-semibold uppercase text-kp-text-primary">{shipment.provider}</td>
                    <td className="py-3.5 px-4 text-center">{shipment.packageCount} units</td>
                    <td className="py-3.5 px-4 text-center font-medium text-kp-text-primary">{shipment.weight} kg</td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status="active" label="In Transit" />
                    </td>
                    <td className="py-3.5 px-4 text-xs text-kp-text-tertiary">
                      {new Date(shipment.shippedAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
