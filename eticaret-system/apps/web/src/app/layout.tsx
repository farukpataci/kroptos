import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Eticaret System',
  description: 'E-commerce system monorepo dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
