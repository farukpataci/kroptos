import { OdooVersionManager } from './odoo.version';
import { OdooTransportJson2 } from './odoo.transport-json2';
import { OdooTransportRpc } from './odoo.transport-rpc';
import { BadRequestException } from '@nestjs/common';

describe('Odoo Transport Layer (§3, §5.1, §5.3)', () => {
  describe('1. Version Detection & Selection (§3.2, §8.1, §8.2)', () => {
    it('selects json2 for Odoo 19.0', () => {
      const v19 = OdooVersionManager.parseVersion({
        server_version: '19.0',
        server_version_info: [19, 0, 0, 'final', 0],
      });
      expect(v19.majorVersion).toBe(19);
      expect(OdooVersionManager.selectTransport(v19)).toBe('json2');
    });

    it('selects json2 for Odoo 20.0+', () => {
      const v20 = OdooVersionManager.parseVersion({
        server_version: '20.1alpha',
        server_version_info: [20, 1, 0],
      });
      expect(v20.majorVersion).toBe(20);
      expect(OdooVersionManager.selectTransport(v20)).toBe('json2');
    });

    it('selects rpc for Odoo 17.0 and 18.0', () => {
      const v17 = OdooVersionManager.parseVersion({
        server_version: '17.0+e',
        server_version_info: [17, 0, 0],
      });
      expect(v17.majorVersion).toBe(17);
      expect(OdooVersionManager.selectTransport(v17)).toBe('rpc');

      const v18 = OdooVersionManager.parseVersion({
        server_version: '18.0-20241001',
        server_serie: '18.0',
      });
      expect(v18.majorVersion).toBe(18);
      expect(OdooVersionManager.selectTransport(v18)).toBe('rpc');
    });

    it('fails clearly if version cannot be determined (§8.3)', () => {
      expect(() => OdooVersionManager.parseVersion({})).toThrow(/tespit edilemedi/);
      expect(() => OdooVersionManager.parseVersion(null)).toThrow(/geçersiz formatta/);
    });
  });

  describe('2. JSON-2 Transport (§3.2, §5.3, §8.10)', () => {
    it('dispatches POST to /json/2/<model>/<method> with bearer and database header', async () => {
      let capturedUrl = '';
      let capturedHeaders: Record<string, string> = {};
      let capturedBody: any = null;

      const mockFetch: any = async (url: string, init: any) => {
        capturedUrl = url;
        capturedHeaders = init.headers;
        capturedBody = JSON.parse(init.body);
        return {
          ok: true,
          status: 200,
          json: async () => [{ id: 1, name: 'Customer A' }],
        };
      };

      const transport = new OdooTransportJson2(
        'https://my-odoo.example.com',
        'db_production',
        'secret-api-key',
        mockFetch,
      );

      const res = await transport.execute<any[]>({
        model: 'res.partner',
        method: 'search_read',
        kwargs: { domain: [['is_company', '=', true]], fields: ['id', 'name'] },
        companyId: 5,
      });

      expect(res).toEqual([{ id: 1, name: 'Customer A' }]);
      expect(capturedUrl).toBe('https://my-odoo.example.com/json/2/res.partner/search_read');
      expect(capturedHeaders['Authorization']).toBe('Bearer secret-api-key');
      expect(capturedHeaders['X-Odoo-Database']).toBe('db_production');
      expect(capturedBody.context).toEqual({
        allowed_company_ids: [5],
        company_id: 5,
      });
    });

    it('blocks calls outside allowlist without making network requests (§5.1, §8.5)', async () => {
      const mockFetch = jest.fn();
      const transport = new OdooTransportJson2('https://test.com', 'db', 'key', mockFetch);

      await expect(
        transport.execute({
          model: 'res.users',
          method: 'write',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('3. Classic RPC Transport (§3.2, §3.3, §8.9)', () => {
    it('dispatches JSON-RPC execute_kw and catches HTTP 200 with error block', async () => {
      const mockFetchWithError: any = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          error: {
            code: 200,
            message: 'Odoo Server Error',
            data: { message: 'Access Denied: Missing journal' },
          },
        }),
      });

      const transport = new OdooTransportRpc(
        'https://my-odoo.example.com',
        'db_production',
        'secret-api-key',
        2,
        mockFetchWithError,
      );

      await expect(
        transport.execute({
          model: 'account.move',
          method: 'action_post',
          args: [[10]],
        }),
      ).rejects.toThrow('Access Denied: Missing journal');
    });

    it('returns result when JSON-RPC call succeeds', async () => {
      const mockFetchSuccess: any = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          result: [{ id: 10, state: 'posted' }],
        }),
      });

      const transport = new OdooTransportRpc(
        'https://my-odoo.example.com',
        'db_production',
        'secret-api-key',
        2,
        mockFetchSuccess,
      );

      const res = await transport.execute<any>({
        model: 'account.move',
        method: 'search_read',
        args: [],
        kwargs: { limit: 1 },
      });

      expect(res).toEqual([{ id: 10, state: 'posted' }]);
    });
  });
});
