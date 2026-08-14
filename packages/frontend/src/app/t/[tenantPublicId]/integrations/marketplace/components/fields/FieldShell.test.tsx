import { render, screen } from '@testing-library/react';
import type { SettingsField } from '@kroptos/shared';
import { FieldShell } from './FieldShell';
import { humanizeMessageKey } from './useFieldText';

const field = (overrides: Partial<SettingsField> = {}): SettingsField =>
  ({
    key: 'country',
    type: 'select',
    labelKey: 'integrations.settings.fields.trendyol_global.country.label',
    ...overrides,
  }) as SettingsField;

describe('humanizeMessageKey', () => {
  it('drops the trailing role segment and names the field', () => {
    expect(humanizeMessageKey('integrations.settings.fields.trendyol_global.country.label')).toBe(
      'Country',
    );
    expect(humanizeMessageKey('integrations.settings.fields.x.country.help')).toBe('Country');
  });

  it('splits camelCase into words', () => {
    expect(humanizeMessageKey('a.b.onlyApprovedProducts.label')).toBe('Only Approved Products');
  });

  it('uses the last segment when it is not a role name', () => {
    expect(humanizeMessageKey('integrations.settings.options.etsy.listingState.draft')).toBe(
      'Draft',
    );
  });

  it('returns the key unchanged when there is nothing to humanise', () => {
    expect(humanizeMessageKey('')).toBe('');
  });
});

describe('FieldShell layout', () => {
  /**
   * jsdom has no layout engine, so actual pixel overflow cannot be measured
   * here. What can be pinned is the set of rules that prevent it: a grid item
   * without `min-w-0` is sized by its content and pushes into the neighbouring
   * column instead of wrapping, and an unbroken token needs `break-words`.
   */
  const LONG_LABEL = 'INTEGRATIONS.SETTINGS.FIELDS.TRENDYOL_GLOBAL.COUNTRY.LABEL';

  it('lets the grid cell shrink below its content width', () => {
    const { container } = render(
      <FieldShell field={field({ labelKey: LONG_LABEL })}>
        <input />
      </FieldShell>,
    );

    expect(container.firstElementChild?.className).toContain('min-w-0');
  });

  it('wraps a long label inside its own column', () => {
    render(
      <FieldShell field={field({ labelKey: LONG_LABEL })}>
        <input />
      </FieldShell>,
    );

    const label = screen.getByText(new RegExp(LONG_LABEL, 'i'));
    expect(label.className).toContain('break-words');
    expect(label.className).toContain('min-w-0');
  });

  it('keeps the badge from being squeezed by a long label', () => {
    const { container } = render(
      <FieldShell field={field({ labelKey: LONG_LABEL, badgeKey: 'beta' } as any)}>
        <input />
      </FieldShell>,
    );

    const badge = container.querySelector('span.shrink-0');
    expect(badge).not.toBeNull();
  });

  it('wraps long help text too', () => {
    render(
      <FieldShell field={field({ helpKey: 'a.b.c.help' })}>
        <input />
      </FieldShell>,
    );

    expect(screen.getByText('a.b.c.help').className).toContain('break-words');
  });

  it('marks a required field', () => {
    const { container } = render(
      <FieldShell field={field({ required: true })}>
        <input />
      </FieldShell>,
    );

    expect(container.textContent).toContain('*');
  });
});

describe('FieldShell with a missing translation', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.doMock('next-intl', () => ({
      useTranslations: () => {
        const t = (key: string) => key;
        t.has = () => false;
        return t;
      },
      useLocale: () => 'tr',
    }));
  });

  afterEach(() => {
    jest.dontMock('next-intl');
    jest.resetModules();
  });

  it('shows a readable label instead of the raw key', async () => {
    const { FieldShell: Shell } = await import('./FieldShell');

    render(
      <Shell field={field()}>
        <input />
      </Shell>,
    );

    expect(screen.getByText(/Country/)).toBeInTheDocument();
    expect(screen.queryByText(/integrations\.settings\.fields/i)).toBeNull();
  });
});
