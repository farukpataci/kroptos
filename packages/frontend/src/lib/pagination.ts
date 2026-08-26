export const PAGE_WINDOW = 5;

/**
 * The page numbers a pagination bar should render: at most `PAGE_WINDOW`, the
 * current one in the middle. Near either end the window stops rather than
 * shrinking, so the bar keeps its width instead of resizing as you page
 * through.
 */
export function pageWindow(currentPage: number, totalPages: number): number[] {
  const first = Math.max(
    1,
    Math.min(currentPage - Math.floor(PAGE_WINDOW / 2), totalPages - PAGE_WINDOW + 1),
  );
  return Array.from({ length: Math.min(PAGE_WINDOW, totalPages - first + 1) }, (_, i) => first + i);
}
