'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar/Navbar';

export default function SolutionDetail() {
  const params = useParams();
  
  const locale = (params.locale as string) || 'tr';
  const slug = (params.slug as string) || 'home-and-garden';
  const isTr = locale.startsWith('tr');

  if (slug === 'home-and-garden') {
    return (
      <div className="min-h-screen bg-kp-bg-primary text-kp-text-primary">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 py-36 flex flex-col items-center text-center space-y-6">
          <h1 className="text-4xl font-extrabold tracking-tight text-kp-text-primary">
            {isTr ? 'Ev ve Bahçe Sektör Çözümleri' : 'Home & Garden Solutions'}
          </h1>
          <p className="text-base text-kp-text-secondary max-w-2xl">
            {isTr 
              ? 'Alqora ile ev, mobilya, yaşam ve bahçe ürünleri e-ticaret süreçlerinizi yönetmeye yakında başlayabilirsiniz.' 
              : 'You will soon be able to manage your home, furniture, living, and garden goods e-commerce workflows with Alqora.'}
          </p>
          <Link href={`/${locale}`} className="px-5 py-2.5 rounded bg-kp-accent text-white font-bold transition-all shadow hover:shadow-kp-glow">
            {isTr ? 'Anasayfaya Dön' : 'Back to Home'}
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-kp-bg-primary text-kp-text-primary">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-36 flex flex-col items-center">
        <h1 className="text-3xl font-extrabold text-kp-text-primary mb-4">
          {isTr ? 'Sektörel Çözüm Bulunamadı' : 'Solution Not Found'}
        </h1>
        <p className="text-kp-text-secondary mb-6">
          {isTr ? 'Talep ettiğiniz sektörel çözüm sayfası şu anda aktif değil.' : 'The requested industry solution is not active.'}
        </p>
        <Link href={`/${locale}`} className="px-5 py-2.5 rounded bg-kp-accent text-white font-bold">
          {isTr ? 'Anasayfaya Dön' : 'Back to Home'}
        </Link>
      </main>
    </div>
  );
}
