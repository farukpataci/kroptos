import { render, screen } from '@testing-library/react';
import StatusBadge from './StatusBadge';

/**
 * The regression this pins: `statusConfig` is an exhaustive Record, so a status
 * outside the map used to make `config` undefined and `config.label` threw,
 * taking the whole page down. Statuses arrive from the API as plain strings, so
 * the type system never prevented it.
 */
describe('StatusBadge', () => {
  it.each(['active', 'warning', 'error', 'syncing', 'inactive'] as const)(
    'renders the known status %s',
    (status) => {
      render(<StatusBadge status={status} />);
      expect(screen.getByText(new RegExp(status, 'i'))).toBeInTheDocument();
    },
  );

  it('does not throw on a status it has no styling for', () => {
    expect(() => render(<StatusBadge status="banana" />)).not.toThrow();
  });

  it('names the unknown status instead of rendering blank', () => {
    render(<StatusBadge status="banana" />);
    expect(screen.getByText('banana')).toBeInTheDocument();
  });

  it('does not dress an unknown status as one of the known states', () => {
    const { container } = render(<StatusBadge status="banana" />);
    const badge = container.querySelector('span');
    expect(badge?.className).not.toContain('badge--success');
    expect(badge?.className).not.toContain('badge--danger');
  });

  it('prefers an explicit label over the mapped one', () => {
    render(<StatusBadge status="active" label="Yayında" />);
    expect(screen.getByText('Yayında')).toBeInTheDocument();
  });
});
