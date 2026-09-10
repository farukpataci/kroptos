import { XeroConnection } from './xero.types';
import connectionsFixture from './__fixtures__/connections.fixture.json';

export class XeroConnectionsService {
  private static readonly CONNECTIONS_URL = 'https://api.xero.com/connections';

  static async getConnections(accessToken: string, isMock: boolean = false): Promise<XeroConnection[]> {
    if (isMock) {
      return connectionsFixture as XeroConnection[];
    }

    const res = await fetch(XeroConnectionsService.CONNECTIONS_URL, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch Xero connections (HTTP ${res.status}): ${res.statusText}`);
    }

    return (await res.json()) as XeroConnection[];
  }
}
