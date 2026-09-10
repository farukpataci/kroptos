import { BusinessCentralOData } from './bc.odata';

describe('BusinessCentralOData', () => {
  describe('buildBaseUrl', () => {
    it('builds standard common endpoint with environmentName', () => {
      const url = BusinessCentralOData.buildBaseUrl('production');
      expect(url).toBe('https://api.businesscentral.dynamics.com/v2.0/production/api/v2.0');
    });

    it('builds sandbox endpoint with environmentName', () => {
      const url = BusinessCentralOData.buildBaseUrl('sandbox');
      expect(url).toBe('https://api.businesscentral.dynamics.com/v2.0/sandbox/api/v2.0');
    });

    it('builds direct tenant endpoint when userDomain is present', () => {
      const url = BusinessCentralOData.buildBaseUrl('sandbox', 'cronus.com');
      expect(url).toBe('https://api.businesscentral.dynamics.com/v2.0/cronus.com/sandbox/api/v2.0');
    });
  });

  describe('buildCompanyResourceUrl', () => {
    const baseUrl = 'https://api.businesscentral.dynamics.com/v2.0/production/api/v2.0';
    const companyId = 'b0a0a0a0-0000-0000-0000-000000000001';

    it('builds resource path without params', () => {
      const url = BusinessCentralOData.buildCompanyResourceUrl(
        baseUrl,
        companyId,
        'salesInvoices',
      );
      expect(url).toBe(
        'https://api.businesscentral.dynamics.com/v2.0/production/api/v2.0/companies(b0a0a0a0-0000-0000-0000-000000000001)/salesInvoices',
      );
    });

    it('appends OData query parameters ($filter, $expand, $select, $top, $skip)', () => {
      const url = BusinessCentralOData.buildCompanyResourceUrl(
        baseUrl,
        companyId,
        'salesInvoices',
        {
          filter: "status eq 'Open'",
          expand: 'salesInvoiceLines',
          select: ['id', 'number'],
          top: 10,
          skip: 20,
        },
      );
      expect(url).toContain("$filter=status%20eq%20'Open'");
      expect(url).toContain('$expand=salesInvoiceLines');
      expect(url).toContain('$select=id%2Cnumber');
      expect(url).toContain('$top=10');
      expect(url).toContain('$skip=20');
    });
  });

  describe('buildActionUrl', () => {
    it('builds action URL for bound actions', () => {
      const baseUrl = 'https://api.businesscentral.dynamics.com/v2.0/production/api/v2.0';
      const companyId = 'comp-1';
      const invoiceId = 'inv-1';
      const url = BusinessCentralOData.buildActionUrl(
        baseUrl,
        companyId,
        'salesInvoices',
        invoiceId,
        'Microsoft.NAV.post',
      );
      expect(url).toBe(
        'https://api.businesscentral.dynamics.com/v2.0/production/api/v2.0/companies(comp-1)/salesInvoices(inv-1)/Microsoft.NAV.post',
      );
    });
  });

  describe('buildExternalDocNumberFilter', () => {
    it('formats filter and escapes single quotes', () => {
      const filter = BusinessCentralOData.buildExternalDocNumberFilter("ORD-101'A");
      expect(filter).toBe("externalDocumentNumber eq 'ORD-101''A'");
    });
  });

  describe('buildIfMatchHeaders', () => {
    it('returns If-Match with provided etag', () => {
      const headers = BusinessCentralOData.buildIfMatchHeaders('W/"JzQ0OzE2OD..."');
      expect(headers).toEqual({ 'If-Match': 'W/"JzQ0OzE2OD..."' });
    });

    it('returns If-Match: * if etag is not provided', () => {
      const headers = BusinessCentralOData.buildIfMatchHeaders();
      expect(headers).toEqual({ 'If-Match': '*' });
    });
  });

  describe('parseODataError', () => {
    it('extracts code and message from OData v4 JSON error', () => {
      const errorObj = {
        error: {
          code: 'Application_DialogException',
          message: 'The Sales Header does not exist. Identification fields and values: Document Type=Invoice',
        },
      };
      const parsed = BusinessCentralOData.parseODataError(errorObj);
      expect(parsed.code).toBe('Application_DialogException');
      expect(parsed.message).toBe(
        'The Sales Header does not exist. Identification fields and values: Document Type=Invoice',
      );
    });
  });
});
