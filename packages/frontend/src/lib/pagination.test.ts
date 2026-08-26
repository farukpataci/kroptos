import { pageWindow, PAGE_WINDOW } from './pagination';

// Products rendered one button per page - 46 of them. Orders had its own
// hand-rolled 7-wide window. Both now come through here, so these pin the
// clamping at each end, which is where the off-by-one lives.
describe('pageWindow', () => {
  it('centres the current page', () => {
    expect(pageWindow(10, 46)).toEqual([8, 9, 10, 11, 12]);
  });

  it('stops at the first page instead of counting below 1', () => {
    expect(pageWindow(1, 46)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(2, 46)).toEqual([1, 2, 3, 4, 5]);
  });

  it('stops at the last page instead of counting past it', () => {
    expect(pageWindow(46, 46)).toEqual([42, 43, 44, 45, 46]);
    expect(pageWindow(45, 46)).toEqual([42, 43, 44, 45, 46]);
  });

  it('shows every page when there are fewer than the window', () => {
    expect(pageWindow(2, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(1, 1)).toEqual([1]);
  });

  it('never renders more than the window and always includes the current page', () => {
    for (let total = 1; total <= 50; total++) {
      for (let page = 1; page <= total; page++) {
        const shown = pageWindow(page, total);
        expect(shown.length).toBe(Math.min(PAGE_WINDOW, total));
        expect(shown).toContain(page);
      }
    }
  });
});
