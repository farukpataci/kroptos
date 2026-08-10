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

  const cardFor = (name: string) => screen.getByText(name).closest('div.group') as HTMLElement;

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
