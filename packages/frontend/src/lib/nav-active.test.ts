import { isNavItemActive } from './nav-active';

const T = '/t/tn_1';
const sp = (qs: string) => new URLSearchParams(qs);

describe('isNavItemActive', () => {
  it('lights the exact parent only on the parent itself', () => {
    expect(isNavItemActive(`${T}/orders`, null, `${T}/orders`, true)).toBe(true);
    expect(isNavItemActive(`${T}/orders/invoices`, null, `${T}/orders`, true)).toBe(false);
  });

  it('lights a child on its own route and its subtree', () => {
    expect(isNavItemActive(`${T}/orders/invoices`, null, `${T}/orders/invoices`)).toBe(true);
    expect(isNavItemActive(`${T}/orders/invoices/inv_9`, null, `${T}/orders/invoices`)).toBe(true);
    expect(isNavItemActive(`${T}/orders/returns`, null, `${T}/orders/invoices`)).toBe(false);
  });

  it('leaves exactly one Orders entry active on every sub-route', () => {
    const items = [
      { href: `${T}/orders`, exact: true },
      { href: `${T}/orders/invoices` },
      { href: `${T}/orders/returns` },
      { href: `${T}/orders/customers` },
      { href: `${T}/orders/settings` },
    ];
    for (const here of items) {
      const lit = items.filter((i) => isNavItemActive(here.href, null, i.href, i.exact));
      expect(lit).toEqual([here]);
    }
  });

  it('separates ?tab= links that share a pathname', () => {
    expect(isNavItemActive(`${T}/system`, sp('tab=warehouses'), `${T}/system?tab=warehouses`)).toBe(true);
    expect(isNavItemActive(`${T}/system`, sp('tab=warehouses'), `${T}/system?tab=settings`)).toBe(false);
    // No tab in the URL is the settings tab, which is what the page opens on.
    expect(isNavItemActive(`${T}/system`, null, `${T}/system?tab=settings`)).toBe(true);
    expect(isNavItemActive(`${T}/products`, sp('tab=settings'), `${T}/system?tab=settings`)).toBe(false);
  });
});
