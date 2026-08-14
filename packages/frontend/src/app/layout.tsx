import '@/styles/globals.css';
import { Outfit, JetBrains_Mono } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import { ThemeProvider } from '@/context/ThemeContext';
import { I18nProvider } from '@/context/I18nProvider';
import { ToastProvider } from '@/components/ui/Toast';

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-outfit',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata = {
  title: 'KroptOS — Commerce Operating System',
  description: 'Multi-tenant commerce management platform for agencies, clients, and stores',
  keywords: 'commerce, operating system, multi-tenant, e-commerce, marketplace',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${outfit.variable} ${jetbrainsMono.variable}`}>
      <body className="font-outfit antialiased">
        <ThemeProvider>
          <AuthProvider>
            <I18nProvider>
              <ToastProvider>
                {children}
              </ToastProvider>
            </I18nProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
