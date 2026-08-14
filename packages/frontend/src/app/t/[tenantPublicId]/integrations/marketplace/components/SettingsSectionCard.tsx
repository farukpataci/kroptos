'use client';

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import * as HeroIcons from '@heroicons/react/24/outline';
import { ChevronDownIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline';
import type { SettingsSection } from '@kroptos/shared';

/**
 * Manifests name their icon as a string ('CubeIcon') because they cross the
 * wire as JSON. An unknown or missing name simply renders no icon rather than
 * breaking the section.
 */
function SectionIcon({ name }: { name?: string }) {
  if (!name) return null;
  const Icon = (HeroIcons as Record<string, unknown>)[name] as
    | React.ComponentType<{ className?: string }>
    | undefined;
  if (!Icon) return null;
  return <Icon className="h-4 w-4 text-kp-accent" />;
}

export function SettingsSectionCard({
  section,
  hasError,
  onReset,
  children,
}: {
  section: SettingsSection;
  hasError?: boolean;
  onReset?: () => void;
  children: ReactNode;
}) {
  const t = useTranslations();
  const [collapsed, setCollapsed] = useState(section.collapsedByDefault ?? false);

  return (
    <section
      className={`overflow-hidden rounded-kp-lg border bg-kp-bg-secondary ${
        hasError ? 'border-kp-danger/40' : 'border-kp-border'
      }`}
    >
      <header className="flex items-start justify-between gap-3 border-b border-kp-border bg-kp-bg-primary/30 px-4 py-3">
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
        >
          <span className="mt-0.5">
            <SectionIcon name={section.icon} />
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-bold text-kp-text-primary">
              {t(section.titleKey)}
            </span>
            {section.descriptionKey && (
              <span className="mt-0.5 block text-[0.6875rem] leading-relaxed text-kp-text-tertiary">
                {t(section.descriptionKey)}
              </span>
            )}
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              title={t('integrations.settings.actions.resetSection')}
              className="rounded-kp-md p-1.5 text-kp-text-tertiary transition-colors hover:bg-kp-bg-hover hover:text-kp-text-primary"
            >
              <ArrowUturnLeftIcon className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-expanded={!collapsed}
            className="rounded-kp-md p-1.5 text-kp-text-tertiary transition-colors hover:bg-kp-bg-hover hover:text-kp-text-primary"
          >
            <ChevronDownIcon
              className={`h-4 w-4 transition-transform ${collapsed ? '-rotate-90' : ''}`}
            />
          </button>
        </div>
      </header>

      {!collapsed && <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">{children}</div>}
    </section>
  );
}
