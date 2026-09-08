import { SapFindContactQuery, SapODataErrorBody } from './sap-s4hana-cloud.types';

export class SapODataHelper {
  /**
   * Builds OData v2 query parameters for Business Partner search.
   */
  static buildBusinessPartnerQuery(query: SapFindContactQuery): Record<string, string> {
    const params: Record<string, string> = {
      $format: 'json',
      $inlinecount: 'allpages',
      $expand: 'to_BusinessPartnerAddress,to_BusinessPartnerTaxNumber',
    };

    const filters: string[] = [];

    if (query.businessPartnerId?.trim()) {
      filters.push(`BusinessPartner eq '${this.escapeODataString(query.businessPartnerId.trim())}'`);
    }

    if (query.searchTerm?.trim()) {
      const escaped = this.escapeODataString(query.searchTerm.trim());
      filters.push(
        `(SearchTerm1 eq '${escaped}' or SearchTerm2 eq '${escaped}' or substringof('${escaped}', BusinessPartnerFullName))`,
      );
    }

    if (query.taxNumber?.trim()) {
      const escaped = this.escapeODataString(query.taxNumber.trim());
      filters.push(`to_BusinessPartnerTaxNumber/BPTaxNumber eq '${escaped}'`);
    }

    if (filters.length > 0) {
      params.$filter = filters.join(' and ');
    }

    // Pagination
    if (query.top !== undefined && query.top > 0) {
      params.$top = String(query.top);
    } else {
      params.$top = '20'; // default page size
    }

    if (query.skip !== undefined && query.skip >= 0) {
      params.$skip = String(query.skip);
    }

    return params;
  }

  /**
   * Escape single quotes for OData string literals.
   */
  static escapeODataString(str: string): string {
    return str.replace(/'/g, "''");
  }

  /**
   * Extracts error message from SAP OData error payload if present.
   */
  static parseODataError(body: any): string | null {
    if (!body) return null;

    if (typeof body === 'object' && body.error) {
      const err = body as SapODataErrorBody;
      const mainMsg = err.error?.message?.value;
      const details = err.error?.innererror?.errordetails;

      if (details && Array.isArray(details) && details.length > 0) {
        const detailMsgs = details.map((d) => d.message).filter(Boolean).join('; ');
        if (detailMsgs) {
          return mainMsg ? `${mainMsg} (${detailMsgs})` : detailMsgs;
        }
      }

      if (mainMsg) return mainMsg;
      if (err.error.code) return `SAP OData Error: ${err.error.code}`;
    }

    return null;
  }
}
