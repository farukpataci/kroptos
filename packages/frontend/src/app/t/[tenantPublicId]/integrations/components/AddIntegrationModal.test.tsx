import { render, screen, waitFor, within } from '@testing-library/react';
import { AddIntegrationModal, CATALOG_PROVIDERS } from './AddIntegrationModal';

jest.mock('@/lib/api', () => ({ apiFetch: jest.fn() }));
const { apiFetch } = jest.requireMock('@/lib/api');

/**
 * Connectability is derived from the backend registry, not asserted by the
 * catalogue. These pin that derivation and the Türkiye / Global split, which
 * are the two ways a seller can end up connecting the wrong thing.
 */
describe('AddIntegrationModal', () => {
  const REGISTERED = [
    { provider: 'trendyol', displayName: 'Trendyol', capabilities: [] },
    { provider: 'trendyol_global', displayName: 'Trendyol Global', capabilities: [] },
  ];

  const open = (props: Partial<React.ComponentProps<typeof AddIntegrationModal>> = {}) =>
    render(
      <AddIntegrationModal
        isOpen
        onClose={jest.fn()}
        connectedProviderIds={[]}
        onSelectProvider={jest.fn()}
        {...props}
      />,
    );

  // Anchored on the card heading rather than any matching text: several
  // providers use the same string for their name and their badge, so a plain
  // text lookup finds two nodes and throws.
  const cardFor = (name: string) =>
    screen.getByRole('heading', { name }).closest('div.group') as HTMLElement;

  beforeEach(() => {
    jest.clearAllMocks();
    apiFetch.mockResolvedValue(REGISTERED);
  });

  it('reads the connectable set from the registry endpoint', async () => {
    open();
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/integrations/settings/providers'));
  });

  describe('Trendyol / Trendyol Global split', () => {
    it('lists them as two separate cards', () => {
      open();
      expect(screen.getByText('Trendyol (Türkiye)')).toBeInTheDocument();
      expect(screen.getByText('Trendyol Global (Uluslararası)')).toBeInTheDocument();
    });

    it('keeps exactly one catalogue entry per provider id', () => {
      const ids = CATALOG_PROVIDERS.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids).toContain('trendyol');
      expect(ids).toContain('trendyol_global');
    });

    it('points the Türkiye card at the Global card for foreign stores', () => {
      open();
      expect(
        within(cardFor('Trendyol (Türkiye)')).getByText(/Trendyol Global.*kartını kullanın/i),
      ).toBeInTheDocument();
    });

    it('tells the Global card user that a country is chosen at setup', () => {
      open();
      expect(
        within(cardFor('Trendyol Global (Uluslararası)')).getByText(/ülke seçilir/i),
      ).toBeInTheDocument();
    });

    it('offers both for connection once the registry lists them', async () => {
      open();
      await waitFor(() => {
        expect(within(cardFor('Trendyol (Türkiye)')).getByText('Bağlantı Kur')).toBeInTheDocument();
      });
      expect(
        within(cardFor('Trendyol Global (Uluslararası)')).getByText('Bağlantı Kur'),
      ).toBeInTheDocument();
    });
  });

  describe('planned marketplaces', () => {
    const PLANNED = [
      'temu',
      'zalando',
      'allegro',
      'aliexpress',
      'emag',
      'kaufland',
      'otto',
      'bol',
    ];

    it.each(PLANNED)('lists %s in the catalogue', (id) => {
      expect(CATALOG_PROVIDERS.map((p) => p.id)).toContain(id);
    });

    it('marks every planned marketplace as coming soon', () => {
      for (const id of PLANNED) {
        const provider = CATALOG_PROVIDERS.find((p) => p.id === id);
        expect(provider?.status).toBe('coming_soon');
      }
    });

    it('never offers a planned marketplace for connection', async () => {
      // The registry knows nothing about them, so the derived state must be
      // "coming soon" — a connectable card here would dead-end the seller.
      // The label appears twice per card (badge and button); asserting on the
      // button is the one that decides whether the card can be acted on.
      open();

      await waitFor(() => {
        expect(within(cardFor('Temu')).getByRole('button')).toHaveTextContent('Çok yakında');
      });

      for (const name of ['Zalando', 'AliExpress', 'eMAG', 'Kaufland Marketplace', 'OTTO Market', 'Bol']) {
        expect(within(cardFor(name)).getByRole('button')).toHaveTextContent('Çok yakında');
      }
    });

    it('disables the button on a planned marketplace', async () => {
      open();

      await waitFor(() => {
        expect(within(cardFor('Allegro')).getByRole('button')).toBeDisabled();
      });
    });

    it('becomes connectable on its own once the registry lists it', async () => {
      // Adding a manifest is the whole change; the catalogue needs no edit.
      apiFetch.mockResolvedValue([
        ...REGISTERED,
        { provider: 'temu', displayName: 'Temu', capabilities: [] },
      ]);
      open();

      await waitFor(() => {
        expect(within(cardFor('Temu')).getByText('Bağlantı Kur')).toBeInTheDocument();
      });
    });
  });

  describe('registry-derived connectability', () => {
    it('marks a marketplace the registry does not list as upcoming', async () => {
      apiFetch.mockResolvedValue([{ provider: 'trendyol', displayName: 'Trendyol', capabilities: [] }]);
      open();

      await waitFor(() => {
        expect(
          within(cardFor('Trendyol Global (Uluslararası)')).getByText('Çok yakında'),
        ).toBeInTheDocument();
      });
    });

    it('disables the button for a provider that is not connectable', async () => {
      apiFetch.mockResolvedValue([]);
      open();

      await waitFor(() => {
        const button = within(cardFor('Trendyol (Türkiye)')).getByRole('button');
        expect(button).toBeDisabled();
      });
    });

    it('falls back to upcoming when the registry lookup fails', async () => {
      // The safe direction: a failed lookup must not present everything as
      // connectable and send the seller into a dead end.
      apiFetch.mockRejectedValue(new Error('network'));
      open();

      await waitFor(() => {
        expect(
          within(cardFor('Trendyol (Türkiye)')).getByText('Çok yakında'),
        ).toBeInTheDocument();
      });
    });

    it('never marks a non-marketplace category connectable', async () => {
      apiFetch.mockResolvedValue([
        ...REGISTERED,
        { provider: 'logo_erp', displayName: 'Logo', capabilities: [] },
      ]);
      open();

      await waitFor(() => {
        expect(
          within(cardFor('Logo GO3 / Tiger ERP')).getByText('Çok yakında'),
        ).toBeInTheDocument();
      });
    });
  });
});
