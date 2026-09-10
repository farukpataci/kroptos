/**
 * Business Central API v2.0 / OData Helpers
 * Source: https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/api-reference/v2.0/
 */

export interface ODataQueryParams {
  filter?: string;
  expand?: string;
  select?: string[];
  top?: number;
  skip?: number;
}

export class BusinessCentralOData {
  /**
   * Build base API URL based on credentials.
   * Common: https://api.businesscentral.dynamics.com/v2.0/{environment}/api/v2.0
   * Direct: https://api.businesscentral.dynamics.com/v2.0/{userDomain}/{environment}/api/v2.0
   */
  static buildBaseUrl(environmentName: string, userDomain?: string): string {
    const env = encodeURIComponent(environmentName || 'production');
    if (userDomain && userDomain.trim().length > 0) {
      const domain = encodeURIComponent(userDomain.trim());
      return `https://api.businesscentral.dynamics.com/v2.0/${domain}/${env}/api/v2.0`;
    }
    return `https://api.businesscentral.dynamics.com/v2.0/${env}/api/v2.0`;
  }

  /**
   * Build path to company resources: /companies({companyId})/{resource}
   */
  static buildCompanyResourceUrl(
    baseUrl: string,
    companyId: string,
    resourcePath: string,
    params?: ODataQueryParams,
  ): string {
    const cleanBase = baseUrl.replace(/\/+$/, '');
    const cleanResource = resourcePath.replace(/^\/+/, '');
    let url = `${cleanBase}/companies(${companyId})/${cleanResource}`;

    if (params) {
      const queryParts: string[] = [];
      if (params.filter) {
        queryParts.push(`$filter=${encodeURIComponent(params.filter)}`);
      }
      if (params.expand) {
        queryParts.push(`$expand=${encodeURIComponent(params.expand)}`);
      }
      if (params.select && params.select.length > 0) {
        queryParts.push(`$select=${encodeURIComponent(params.select.join(','))}`);
      }
      if (params.top !== undefined) {
        queryParts.push(`$top=${params.top}`);
      }
      if (params.skip !== undefined) {
        queryParts.push(`$skip=${params.skip}`);
      }
      if (queryParts.length > 0) {
        url += `?${queryParts.join('&')}`;
      }
    }

    return url;
  }

  /**
   * Build action URL for bound actions like Microsoft.NAV.post or Microsoft.NAV.cancel
   */
  static buildActionUrl(
    baseUrl: string,
    companyId: string,
    resource: string,
    id: string,
    action: string,
  ): string {
    const cleanBase = baseUrl.replace(/\/+$/, '');
    return `${cleanBase}/companies(${companyId})/${resource}(${id})/${action}`;
  }

  /**
   * Safely escape single quotes in string values for OData string literals.
   */
  static escapeODataString(value: string): string {
    return value.replace(/'/g, "''");
  }

  /**
   * Build OData $filter string for externalDocumentNumber
   */
  static buildExternalDocNumberFilter(ref: string): string {
    return `externalDocumentNumber eq '${this.escapeODataString(ref)}'`;
  }

  /**
   * Build headers for mutate requests (PATCH/DELETE) requiring If-Match ETag concurrency protection (§4.8).
   */
  static buildIfMatchHeaders(etag?: string): Record<string, string> {
    return {
      'If-Match': etag ? etag : '*',
    };
  }

  /**
   * Parse OData v4 JSON error body
   */
  static parseODataError(body: any): { code?: string; message: string } {
    if (!body) {
      return { message: 'Bilinmeyen Business Central hatası' };
    }
    if (typeof body === 'string') {
      try {
        const parsed = JSON.parse(body);
        return this.parseODataError(parsed);
      } catch {
        return { message: body };
      }
    }
    if (body.error) {
      const code = body.error.code;
      const message =
        typeof body.error.message === 'string'
          ? body.error.message
          : body.error.message?.value || JSON.stringify(body.error);
      return { code, message };
    }
    return { message: JSON.stringify(body) };
  }
}
