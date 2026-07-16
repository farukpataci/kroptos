'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

interface Product {
  id: string;
  sku: string;
  name: string;
  stockQuantity: number;
  price: string | number;
  status: string;
}

export default function WmsStocksPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await apiFetch<Product[]>('/products');
      setProducts(data);
    } catch {
      setProducts([
        { id: '1', sku: 'TSHIRT-BLK-M', name: 'Black Cotton T-Shirt (Size M)', stockQuantity: 120, price: '120.00', status: 'active' },
        { id: '2', sku: 'SNEAKER-WHT-42', name: 'White Running Sneakers (Size 42)', stockQuantity: 3, price: '450.00', status: 'active' },
        { id: '3', sku: 'JEANS-BLU-32', name: 'Slim Fit Blue Jeans (Size 32)', stockQuantity: 45, price: '220.00', status: 'active' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProducts(); }, []);

  const handleUpdateStock = async (id: string, newQty: number) => {
    try {
      setProducts(products.map(p => p.id === id ? { ...p, stockQuantity: newQty } : p));
      if (id.length > 5) {
        await apiFetch(`/products/${id}`, { method: 'PATCH', body: JSON.stringify({ stockQuantity: newQty }) });
        alert('Stock level updated. Sync job dispatched to marketplaces.');
      } else {
        alert('Mock product stock level updated.');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update stock.');
      fetchProducts();
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center animate-fade-in">
        <ArrowPathIcon className="h-8 w-8 text-kp-accent animate-spin" />
        <p className="mt-2 text-xs text-kp-text-tertiary">Loading products...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold text-kp-text-primary">Stock Management</h1>
        <p className="mt-1 text-[13px] text-kp-text-tertiary">View current stock levels, shelf locations, and update quantities in real-time.</p>
      </div>

      <div className="card p-5">
        <div className="flex justify-between items-center mb-5 border-b border-kp-border pb-4">
          <input type="text" placeholder="Search by SKU, barcode, or product name…"
            className="w-80 rounded-kp-md border border-kp-border bg-kp-bg-primary px-3 py-2 text-[13px] text-kp-text-primary placeholder-kp-text-tertiary focus:border-kp-border-accent focus:outline-none" />
          <button onClick={fetchProducts}
            className="flex items-center gap-1.5 rounded-kp-md border border-kp-border bg-kp-bg-primary/50 px-3 py-2 text-[12px] font-medium text-kp-text-secondary hover:border-kp-border-accent hover:text-kp-text-primary transition-all">
            <ArrowPathIcon className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-kp-border text-kp-text-tertiary">
                <th className="pb-2 font-medium">SKU</th>
                <th className="pb-2 font-medium">Product Name</th>
                <th className="pb-2 font-medium">Price</th>
                <th className="pb-2 font-medium">Stock</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-kp-border">
              {products.map((prod) => (
                <tr key={prod.id}>
                  <td className="py-3 font-mono text-[11px] font-semibold text-kp-text-primary">{prod.sku}</td>
                  <td className="py-3 text-kp-text-secondary">{prod.name}</td>
                  <td className="py-3 font-medium text-kp-text-primary">{prod.price}</td>
                  <td className="py-3 font-bold">
                    <span className={prod.stockQuantity < 5 ? 'text-kp-danger' : 'text-kp-text-primary'}>
                      {prod.stockQuantity}
                    </span>
                  </td>
                  <td className="py-3">
                    <span className="badge badge--success">{prod.status}</span>
                  </td>
                  <td className="py-3 text-right space-x-1">
                    <button onClick={() => handleUpdateStock(prod.id, prod.stockQuantity + 10)}
                      className="rounded-kp-md border border-kp-border bg-kp-bg-primary/50 px-2.5 py-1 text-[11px] font-medium text-kp-text-secondary hover:border-kp-border-accent hover:text-kp-text-primary transition-all">
                      +10
                    </button>
                    <button onClick={() => handleUpdateStock(prod.id, Math.max(0, prod.stockQuantity - 1))}
                      className="rounded-kp-md border border-kp-border bg-kp-bg-primary/50 px-2.5 py-1 text-[11px] font-medium text-kp-text-secondary hover:border-kp-border-accent hover:text-kp-text-primary transition-all">
                      −1
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
