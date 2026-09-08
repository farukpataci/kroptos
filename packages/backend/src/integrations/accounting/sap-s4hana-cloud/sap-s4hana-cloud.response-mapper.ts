import { AccountingContactResult } from '../core/AccountingTypes';
import { SapBusinessPartner } from './sap-s4hana-cloud.types';

export class SapS4HanaCloudResponseMapper {
  /**
   * Maps SAP BusinessPartner entity to standard AccountingContactResult.
   */
  static toContactResult(bp: SapBusinessPartner): AccountingContactResult {
    return {
      externalId: bp.BusinessPartner,
      rawResponse: bp,
    };
  }

  /**
   * Formats display name from Business Partner fields.
   */
  static extractDisplayName(bp: SapBusinessPartner): string {
    if (bp.BusinessPartnerCategory === '2') {
      const orgName = [bp.OrganizationBPName1, bp.OrganizationBPName2].filter(Boolean).join(' ');
      if (orgName) return orgName;
    }

    if (bp.FirstName || bp.LastName) {
      return [bp.FirstName, bp.LastName].filter(Boolean).join(' ');
    }

    return bp.BusinessPartnerFullName || bp.BusinessPartnerName || bp.BusinessPartner;
  }

  /**
   * Extracts primary tax number from BP tax numbers.
   */
  static extractTaxNumber(bp: SapBusinessPartner): string | undefined {
    const taxes = bp.to_BusinessPartnerTaxNumber?.results;
    if (taxes && taxes.length > 0) {
      return taxes[0].BPTaxNumber;
    }
    return undefined;
  }

  /**
   * Extracts primary address details from BP addresses.
   */
  static extractAddress(bp: SapBusinessPartner) {
    const addresses = bp.to_BusinessPartnerAddress?.results;
    if (addresses && addresses.length > 0) {
      const addr = addresses[0];
      return {
        street: addr.StreetName,
        city: addr.CityName,
        country: addr.Country,
        postalCode: addr.PostalCode,
        district: addr.District,
      };
    }
    return undefined;
  }
}
