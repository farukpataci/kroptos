import { SagePaginationEnvelope } from './sage.types';

/**
 * §3.4 Sage pagination helper.
 * Follows $next exact full URL provided by Sage API.
 * Never constructs offset or page numbers manually.
 */
export async function fetchAllSagePages<T>(
  fetchPage: (url?: string) => Promise<SagePaginationEnvelope<T>>,
  initialUrl?: string,
  maxPages: number = 50,
): Promise<T[]> {
  const allItems: T[] = [];
  let nextUrl: string | null | undefined = initialUrl;
  let pagesFetched = 0;

  while (pagesFetched < maxPages) {
    const pageData: SagePaginationEnvelope<T> = await fetchPage(nextUrl || undefined);
    pagesFetched++;

    if (Array.isArray(pageData.$items)) {
      allItems.push(...pageData.$items);
    }

    if (!pageData.$next) {
      break;
    }

    nextUrl = pageData.$next;
  }

  return allItems;
}
