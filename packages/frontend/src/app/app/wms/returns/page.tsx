'use client';

export default function WmsReturnsPage() {
  const returns = [
    { id: 'RET-8921', orderNumber: 'KP-10291', customer: 'Can Berk', reason: 'Size mismatch', status: 'pending', date: '2026-06-29' },
    { id: 'RET-8920', orderNumber: 'KP-10283', customer: 'Selin Guler', reason: 'Wrong product', status: 'approved', date: '2026-06-27' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold text-kp-text-primary">Returns</h1>
        <p className="mt-1 text-[13px] text-kp-text-tertiary">Inspect customer returns, approve or reject, and restock items.</p>
      </div>

      <div className="card p-5">
        <div className="flex justify-between items-center mb-5 border-b border-kp-border pb-4">
          <input type="text" placeholder="Scan return barcode or order number…"
            className="w-80 rounded-kp-md border border-kp-border bg-kp-bg-primary px-3 py-2 text-[13px] text-kp-text-primary placeholder-kp-text-tertiary focus:border-kp-border-accent focus:outline-none" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-kp-border text-kp-text-tertiary">
                <th className="pb-2 font-medium">Return #</th>
                <th className="pb-2 font-medium">Order #</th>
                <th className="pb-2 font-medium">Customer</th>
                <th className="pb-2 font-medium">Reason</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-kp-border">
              {returns.map((ret) => (
                <tr key={ret.id}>
                  <td className="py-3 font-semibold text-kp-text-primary">{ret.id}</td>
                  <td className="py-3 text-kp-text-secondary">{ret.orderNumber}</td>
                  <td className="py-3 text-kp-text-secondary">{ret.customer}</td>
                  <td className="py-3 text-kp-text-tertiary">{ret.reason}</td>
                  <td className="py-3">
                    <span className={`badge ${ret.status === 'approved' ? 'badge--success' : 'badge--warning'}`}>
                      {ret.status === 'approved' ? 'Approved' : 'Under Review'}
                    </span>
                  </td>
                  <td className="py-3 text-kp-text-tertiary">{ret.date}</td>
                  <td className="py-3 text-right">
                    <button className="rounded-kp-md border border-kp-border bg-kp-bg-primary/50 px-3 py-1.5 text-[11px] font-medium text-kp-text-secondary hover:border-kp-border-accent hover:text-kp-text-primary transition-all">
                      Approve
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
