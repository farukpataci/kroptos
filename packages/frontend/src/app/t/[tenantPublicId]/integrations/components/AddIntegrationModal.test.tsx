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
    // `allegro` and `temu` deliberately left out: their manifests are
    // registered, so those cards are connectable and neither is a planned entry.
    const PLANNED = ['zalando', 'aliexpress', 'emag', 'kaufland', 'otto', 'bol'];

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
        expect(within(cardFor('Zalando')).getByRole('button')).toHaveTextContent('Çok yakında');
      });

      for (const name of ['AliExpress', 'eMAG', 'Kaufland Marketplace', 'OTTO Market', 'Bol']) {
        expect(within(cardFor(name)).getByRole('button')).toHaveTextContent('Çok yakında');
      }
    });

    it('disables the button on a planned marketplace', async () => {
      open();

      await waitFor(() => {
        expect(within(cardFor('Zalando')).getByRole('button')).toBeDisabled();
      });
    });

    it('becomes connectable on its own once the registry lists it', async () => {
      // Adding a manifest is the whole change; the catalogue needs no edit.
      apiFetch.mockResolvedValue([
        ...REGISTERED,
        { provider: 'zalando', displayName: 'Zalando', capabilities: [] },
      ]);
      open();

      await waitFor(() => {
        expect(within(cardFor('Zalando')).getByText('Bağlantı Kur')).toBeInTheDocument();
      });
    });
  });

  describe('Temu', () => {
    /**
     * Registered on 2026-08-14 to break a deadlock: the card was disabled until
     * a live call verified the response shapes, but a disabled card has nowhere
     * to enter credentials, so that call could never be made. These pin what the
     * card may and may not promise while it is still unverified.
     */
    it('is offered for connection once the registry lists it', async () => {
      apiFetch.mockResolvedValue([
        ...REGISTERED,
        { provider: 'temu', displayName: 'Temu', capabilities: [] },
      ]);
      open();

      await waitFor(() => {
        expect(within(cardFor('Temu')).getByRole('button')).toHaveTextContent('Bağlantı Kur');
      });
    });

    it('carries the beta badge rather than presenting itself as verified', () => {
      expect(CATALOG_PROVIDERS.find((p) => p.id === 'temu')?.status).toBe('beta');
    });

    it('advertises no stock capability, because updateStock does not send', () => {
      // TemuConnector.updateStock deliberately refuses: the stock list element
      // names are unverified and a mis-parsed list can zero a whole catalogue.
      // A badge here is how a seller ends up trusting a sync that cannot run.
      const temu = CATALOG_PROVIDERS.find((p) => p.id === 'temu');

      expect(temu?.capabilities).toEqual(['Siparişler', 'Ürünler', 'Kategoriler']);
      expect(temu?.capabilities.join(' ')).not.toMatch(/stok/i);
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
