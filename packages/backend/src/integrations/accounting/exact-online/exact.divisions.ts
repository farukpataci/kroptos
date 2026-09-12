import { IExactClient } from './exact.client';
import { ExactDivision, ExactMeResponse } from './exact.types';

export interface DiscoveredExactDivision {
  code: number;
  description: string;
  isCurrent: boolean;
  currency: string;
  country: string;
  customerName: string;
}

export class ExactDivisionService {
  /**
   * Exact Online kullanıcısının erişebildiği tüm bölümleri keşfeder (§3.1).
   * 1. GET /api/v1/current/Me -> CurrentDivision
   * 2. GET /api/v1/{division}/system/Divisions -> Tüm erişilebilir bölümler
   */
  static async discoverDivisions(client: IExactClient): Promise<{
    currentDivision: number;
    divisions: DiscoveredExactDivision[];
  }> {
    const me: ExactMeResponse = await client.getMe();
    const currentCode = me.CurrentDivision;

    let rawDivisions: ExactDivision[] = [];
    try {
      rawDivisions = await client.listDivisions();
    } catch {
      // system/Divisions çağrısı başarısız olursa en azından Me'deki bölümü listele
      rawDivisions = [
        {
          Code: currentCode,
          Description: me.DivisionCustomer || `Bölüm ${currentCode}`,
          HID: currentCode,
          Customer: me.UserID,
          CustomerName: me.FullName,
          Status: 1,
          Currency: 'EUR',
          Country: 'NL',
        },
      ];
    }

    const divisions: DiscoveredExactDivision[] = rawDivisions.map((d) => ({
      code: d.Code,
      description: d.Description || `Bölüm ${d.Code}`,
      isCurrent: d.Code === currentCode,
      currency: d.Currency || 'EUR',
      country: d.Country || 'NL',
      customerName: d.CustomerName || me.FullName,
    }));

    return {
      currentDivision: currentCode,
      divisions,
    };
  }
}
