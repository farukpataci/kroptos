import { OdooTransportKind, OdooVersionInfo } from './odoo.types';

/**
 * Odoo Version Detection and Transport Selection (§3, §5.2)
 */
export class OdooVersionManager {
  /**
   * Parse version payload returned from Odoo /web/version or /xmlrpc/2/common version()
   */
  static parseVersion(payload: any): OdooVersionInfo {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Odoo sürüm yanıtı boş veya geçersiz formatta.');
    }

    const serverVersion: string =
      payload.server_version || payload.serverVersion || '';
    const serverVersionInfo: (number | string)[] =
      payload.server_version_info || payload.version_info || [];
    const serverSerie: string =
      payload.server_serie || (serverVersion ? serverVersion.split('.')[0] : '');
    const protocolVersion: number = payload.protocol_version ?? 1;

    let majorVersion = 0;
    if (serverVersionInfo.length > 0 && typeof serverVersionInfo[0] === 'number') {
      majorVersion = serverVersionInfo[0];
    } else if (serverSerie) {
      const parsed = parseInt(serverSerie, 10);
      if (!isNaN(parsed)) majorVersion = parsed;
    } else if (serverVersion) {
      const match = serverVersion.match(/^(\d+)/);
      if (match) majorVersion = parseInt(match[1], 10);
    }

    if (majorVersion <= 0) {
      throw new Error(`Odoo ana sürümü (major version) tespit edilemedi: "${serverVersion}".`);
    }

    return {
      server_version: serverVersion,
      server_version_info: serverVersionInfo,
      server_serie: serverSerie,
      protocol_version: protocolVersion,
      majorVersion,
    };
  }

  /**
   * Determine transport based on detected major version (§3.2):
   * Major >= 19: 'json2' (Modern JSON-2 REST API)
   * Major < 19: 'rpc' (Legacy XML-RPC / JSON-RPC)
   */
  static selectTransport(version: OdooVersionInfo): OdooTransportKind {
    return version.majorVersion >= 19 ? 'json2' : 'rpc';
  }
}
