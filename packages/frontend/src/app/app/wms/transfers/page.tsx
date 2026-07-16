'use client';

export default function WmsTransfersPage() {
  const transfers = [
    { id: 'TRSF-501', source: 'KroptOS Central Warehouse', destination: 'Atasehir Popup Store', itemsCount: 45, status: 'shipped', date: '2026-06-29' },
    { id: 'TRSF-502', source: 'Atasehir Popup Store', destination: 'KroptOS Central Warehouse', itemsCount: 12, status: 'pending', date: '2026-06-29' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold text-kp-text-primary">Inter-Warehouse Transfers</h1>
        <p className="mt-1 text-[13px] text-kp-text-tertiary">Create and track stock transfers between warehouse locations.</p>
      </div>

      <div className="card p-5">
        <div className="flex justify-between items-center mb-5 border-b border-kp-border pb-4">
          <input type="text" placeholder="Search transfer orders…"
            className="w-80 rounded-kp-md border border-kp-border bg-kp-bg-primary px-3 py-2 text-[13px] text-kp-text-primary placeholder-kp-text-tertiary focus:border-kp-border-accent focus:outline-none" />
          <button className="rounded-kp-md bg-kp-accent px-4 py-2 text-[12px] font-semibold text-white shadow-kp-glow transition-colors hover:bg-kp-accent-hover">
            New Transfer
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-kp-border text-kp-text-tertiary">
                <th className="pb-2 font-medium">Transfer #</th>
                <th className="pb-2 font-medium">Origin</th>
                <th className="pb-2 font-medium">Destination</th>
                <th className="pb-2 font-medium">Items</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-kp-border">
              {transfers.map((trsf) => (
                <tr key={trsf.id}>
                  <td className="py-3 font-semibold text-kp-text-primary">{trsf.id}</td>
                  <td className="py-3 text-kp-text-secondary">{trsf.source}</td>
                  <td className="py-3 text-kp-text-secondary">{trsf.destination}</td>
                  <td className="py-3 text-kp-text-secondary">{trsf.itemsCount} items</td>
                  <td className="py-3">
                    <span className={`badge ${trsf.status === 'shipped' ? 'badge--info' : 'badge--warning'}`}>
                      {trsf.status === 'shipped' ? 'In Transit' : 'Pending Approval'}
                    </span>
                  </td>
                  <td className="py-3 text-kp-text-tertiary">{trsf.date}</td>
                  <td className="py-3 text-right">
                    <button className="rounded-kp-md border border-kp-border bg-kp-bg-primary/50 px-3 py-1.5 text-[11px] font-medium text-kp-text-secondary hover:border-kp-border-accent hover:text-kp-text-primary transition-all">
                      Details
                    </button>
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
