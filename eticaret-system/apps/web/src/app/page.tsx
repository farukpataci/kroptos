import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="max-w-2xl p-8 bg-white rounded-3xl shadow-xl">
        <h1 className="text-3xl font-semibold mb-4">Eticaret System</h1>
        <p className="text-slate-600 mb-6">Monorepo admin dashboard starter.</p>
        <div className="grid gap-3">
          <Link href="/" className="px-4 py-3 bg-slate-900 text-white rounded-lg text-center">Dashboard</Link>
        </div>
      </div>
    </main>
  );
}
