'use client';

export default function WmsInboundPage() {
  const inboundJobs = [
    { id: 'INB-001', supplier: 'Denim Fabric Corp', itemsCount: 450, status: 'pending', date: '2026-06-29' },
    { id: 'INB-002', supplier: 'Sneaker Supplies Ltd', itemsCount: 120, status: 'receiving', date: '2026-06-28' },
    { id: 'INB-003', supplier: 'Logistics Packaging Inc', itemsCount: 1500, status: 'completed', date: '2026-06-25' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold text-kp-text-primary">Inbound Receiving</h1>
        <p className="mt-1 text-[13px] text-kp-text-tertiary">Receive supplier shipments and count incoming goods into warehouse inventory.</p>
      </div>

      <div className="card p-5">
        <div className="flex justify-between items-center mb-5 border-b border-kp-border pb-4">
          <input type="text" placeholder="Search by invoice or supplier…"
            className="w-80 rounded-kp-md border border-kp-border bg-kp-bg-primary px-3 py-2 text-[13px] text-kp-text-primary placeholder-kp-text-tertiary focus:border-kp-border-accent focus:outline-none" />
          <button className="rounded-kp-md bg-kp-accent px-4 py-2 text-[12px] font-semibold text-white shadow-kp-glow transition-colors hover:bg-kp-accent-hover">
            New Inbound
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-kp-border text-kp-text-tertiary">
                <th className="pb-2 font-medium">Receiving #</th>
                <th className="pb-2 font-medium">Supplier</th>
                <th className="pb-2 font-medium">Item Count</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-kp-border">
              {inboundJobs.map((job) => (
                <tr key={job.id}>
                  <td className="py-3 font-semibold text-kp-text-primary">{job.id}</td>
                  <td className="py-3 text-kp-text-secondary">{job.supplier}</td>
                  <td className="py-3 text-kp-text-secondary">{job.itemsCount} items</td>
                  <td className="py-3">
                    <span className={`badge ${
                      job.status === 'completed' ? 'badge--success' : job.status === 'receiving' ? 'badge--warning' : 'badge--accent'
                    }`}>
                      {job.status === 'completed' ? 'Completed' : job.status === 'receiving' ? 'Counting' : 'Pending'}
                    </span>
                  </td>
                  <td className="py-3 text-kp-text-tertiary">{job.date}</td>
                  <td className="py-3 text-right">
                    <button className="rounded-kp-md border border-kp-border bg-kp-bg-primary/50 px-3 py-1.5 text-[11px] font-medium text-kp-text-secondary hover:border-kp-border-accent hover:text-kp-text-primary transition-all">
                      Details / Count
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
