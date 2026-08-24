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
  const pathname = usePathname();
  const params = useParams();
  const tNav = useTranslations('navigation');
  const tCarriers = useTranslations('carriers');

  const tenantPublicId = params?.tenantPublicId as string;
  const base = `/t/${tenantPublicId}/integrations`;

  const tabs = [
    { href: base, label: tNav('integrations') },
    { href: `${base}/carrier`, label: tCarriers('title') },
  ];

  return (
    <div className="flex h-full flex-col">
      <nav className="flex items-center gap-1 border-b border-kp-border px-6 pt-4">
        {tabs.map((tab) => {
          // Exact match for the hub: `startsWith` would light it up on every
          // branch, which is the tab bar telling the operator they are in the
          // wrong place.
          const active = tab.href === base ? pathname === base : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              prefetch={true}
              className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                active
                  ? 'border-kp-accent text-kp-accent'
                  : 'border-transparent text-kp-text-tertiary hover:text-kp-text-primary'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      <div className="flex-1">{children}</div>
    </div>
  );
}
