import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 p-4 font-sans">
      <div className="text-center space-y-4 max-w-md">
        <h1 className="text-6xl font-extrabold text-blue-600">404</h1>
        <h2 className="text-xl font-bold">Sayfa Bulunamadı</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Aradığınız sayfa kaldırılmış, adı değiştirilmiş veya geçici olarak kullanılamıyor olabilir.
        </p>
        <div className="pt-4">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors"
          >
            Ana Sayfaya Dön
          </Link>
        </div>
      </div>
    </div>
  );
}
