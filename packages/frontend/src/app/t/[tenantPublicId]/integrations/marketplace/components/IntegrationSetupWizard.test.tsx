import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntegrationSetupWizard } from './IntegrationSetupWizard';

jest.mock('@/lib/api', () => ({ apiFetch: jest.fn() }));
jest.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ tenantContext: { agencyId: 'ag-1', clientId: null, storeId: null } }),
}));
jest.mock('../hooks/useIntegrationSettings', () => ({
  useIntegrationSettings: () => ({
    manifest: null,
    values: {},
    errors: {},
    isSaving: false,
    isConfigured: false,
    missingRequired: [],
    setValue: jest.fn(),
    completeStep: jest.fn(),
  }),
}));

const { apiFetch } = jest.requireMock('@/lib/api');

/**
 * The country field is required and enumerated. These cover the two ways that
 * can go wrong for a seller: the options never showing up, and a country-less
 * submit reaching the backend instead of being caught in the form.
 */
const MANIFEST = {
  provider: 'trendyol_global',
  displayName: 'Trendyol Global',
  capabilities: [],
  credentials: [
    {
      key: 'country',
      type: 'select',
      labelKey: 'integrations.settings.fields.trendyol_global.country.label',
      required: true,
      options: [
        { value: 'SA', labelKey: 'integrations.settings.options.trendyol_global.country.SA' },
        { value: 'AE', labelKey: 'integrations.settings.options.trendyol_global.country.AE' },
        { value: 'KW', labelKey: 'integrations.settings.options.trendyol_global.country.KW' },
        { value: 'RO', labelKey: 'integrations.settings.options.trendyol_global.country.RO' },
        { value: 'GR', labelKey: 'integrations.settings.options.trendyol_global.country.GR' },
      ],
    },
    { key: 'sellerId', type: 'text', labelKey: 'c.sellerId', required: true },
    { key: 'apiKey', type: 'password', labelKey: 'c.apiKey', required: true, secret: true },
    { key: 'apiSecret', type: 'password', labelKey: 'c.apiSecret', required: true, secret: true },
  ],
  tabs: [],
  wizard: [],
};

const open = () =>
  render(
    <IntegrationSetupWizard
      provider="trendyol_global"
      presetName="Trendyol Global"
      onClose={jest.fn()}
      onCreated={jest.fn()}
      onFinished={jest.fn()}
    />,
  );

describe('IntegrationSetupWizard — country field', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiFetch.mockImplementation((url: string) =>
      url.includes('/settings/providers/') ? Promise.resolve(MANIFEST) : Promise.resolve({}),
    );
  });

  it('loads the provider schema before an integration exists', async () => {
    open();
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith('/integrations/settings/providers/trendyol_global/schema'),
    );
  });

  it('lists all five countries as options', async () => {
    open();

    const select = await screen.findByRole('combobox');
    const values = Array.from(select.querySelectorAll('option'))
      .map((o) => (o as HTMLOptionElement).value)
      .filter(Boolean);

    expect(values).toEqual(['SA', 'AE', 'KW', 'RO', 'GR']);
  });

  it('offers a placeholder rather than silently preselecting a country', async () => {
    open();

    const select = (await screen.findByRole('combobox')) as HTMLSelectElement;

    expect(select.value).toBe('');
    expect(screen.getByText('integrations.settings.actions.choose')).toBeInTheDocument();
  });

  it('labels the options through the message catalogue, not with raw codes', async () => {
    open();
    await screen.findByRole('combobox');

    // The mocked translator echoes keys, so seeing the key proves the label went
    // through t() — a raw "SA" in the option text would mean it did not.
    expect(
      screen.getByText('integrations.settings.options.trendyol_global.country.SA'),
    ).toBeInTheDocument();
  });

  describe('submitting without a country', () => {
    it('does not send the create request', async () => {
      const user = userEvent.setup();
      open();
      await screen.findByRole('combobox');

      await user.click(screen.getByText('integrations.settings.wizard.connectAndTest'));

      await waitFor(() => {
        const posted = apiFetch.mock.calls.filter(
          (call: any[]) => call[1]?.method === 'POST' || call[0] === '/integrations',
        );
        expect(posted).toHaveLength(0);
      });
    });

    it('shows the error on the field instead of only failing silently', async () => {
      const user = userEvent.setup();
      open();
      await screen.findByRole('combobox');

      await user.click(screen.getByText('integrations.settings.wizard.connectAndTest'));

      await waitFor(() => {
        expect(
          screen.getAllByText('integrations.settings.validation.required').length,
        ).toBeGreaterThan(0);
      });
    });
  });
});
