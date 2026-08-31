'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

/**
 * The branches of /integrations.
 *
 * Carrier connections used to be reachable only by running a script, and the
 * sub-pages under here were reachable only by typing the URL. One tab bar in a
 * layout gives both a way in without touching each page.
 */
export default function IntegrationsLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full flex-col">{children}</div>;
}
