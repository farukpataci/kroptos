import { render, screen } from '@testing-library/react';
import type { ProviderSettingsManifest } from '@kroptos/shared';
import { SettingsSchemaRenderer } from './SettingsSchemaRenderer';

// next-intl is mocked globally in jest.setup.js: keys echo back as their own text.

/**
 * n11 declares `stock.push` so the stock tab survives — revoking the capability
 * would delete the tab and make the backend prune every value saved inside it —
 * but no connector code stands behind it. The form therefore has to stay,
 * unchanged on the save path, while saying plainly that filling it in achieves
 * nothing.
 */
describe('SettingsSchemaRenderer — planned capabilities', () => {
  const manifest = (plannedCapabilities: string[] = []): ProviderSettingsManifest =>
    ({
      provider: 'n11',
      displayName: 'n11',
      version: 1,
      capabilities: ['stock.push', 'orders.read'],
      plannedCapabilities,
      credentials: [],
      wizard: [],
      crossRules: [],
      tabs: [
        {
          id: 'stock',
          titleKey: 'tabs.stock',
          requiresCapability: 'stock.push',
          sections: [
            {
              id: 'stock.policy',
              titleKey: 'sections.stock',
              fields: [
                { key: 'stock.bufferQuantity', type: 'number', labelKey: 'fields.buffer' },
              ],
            },
          ],
        },
        {
          id: 'orders',
          titleKey: 'tabs.orders',
          requiresCapability: 'orders.read',
          sections: [
            {
              id: 'orders.import',
              titleKey: 'sections.orders',
              fields: [
                { key: 'orders.numberPrefix', type: 'text', labelKey: 'fields.prefix' },
                {
                  key: 'orders.pushStatus',
                  type: 'toggle',
                  labelKey: 'fields.pushStatus',
                  requiresCapability: 'orders.updateStatus',
                },
              ],
            },
          ],
        },
      ],
    }) as unknown as ProviderSettingsManifest;

  const renderTab = (tabId: string, planned: string[] = []) =>
    render(
      <SettingsSchemaRenderer
        manifest={manifest(planned)}
        activeTabId={tabId}
        values={{}}
        errors={{}}
        onChange={jest.fn()}
      />,
    );

  it('warns that a planned tab is not supported yet', () => {
    renderTab('stock', ['stock.push']);

    const notice = screen.getByTestId('planned-capability-notice');
    expect(notice).toHaveTextContent(/henüz desteklenmiyor/i);
    expect(notice).toHaveTextContent('n11');
    // The values are kept, and the user is told so.
    expect(notice).toHaveTextContent(/korunur/i);
  });

  it('renders the planned tab read-only rather than hiding it', () => {
    renderTab('stock', ['stock.push']);

    // Still on screen — hiding it would mean the stored values get pruned.
    const input = screen.getByLabelText(/fields.buffer/i);
    expect(input).toBeInTheDocument();
    expect(input).toBeDisabled();
  });

  it('leaves an implemented tab editable and unannotated', () => {
    renderTab('orders', ['stock.push']);

    expect(screen.queryByTestId('planned-capability-notice')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/fields.prefix/i)).not.toBeDisabled();
  });

  it('disables a single planned field inside an implemented tab', () => {
    renderTab('orders', ['orders.updateStatus']);

    // The tab itself is fine, so no banner; only the one field is inert.
    expect(screen.queryByTestId('planned-capability-notice')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/fields.prefix/i)).not.toBeDisabled();
    // A toggle renders as a switch button rather than a labelled input.
    expect(screen.getByRole('switch', { name: /fields.pushStatus/i })).toBeDisabled();
  });

  it('changes nothing when the provider declares no planned capabilities', () => {
    renderTab('stock', []);

    expect(screen.queryByTestId('planned-capability-notice')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/fields.buffer/i)).not.toBeDisabled();
  });
});
