import { YurticiCreateShipmentData, YurticiCredentials } from './YurticiTypes';

function escapeXml(str?: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export class YurticiEnvelope {
  /**
   * Generates SOAP XML envelope for createShipment.
   * Authentication fields: wsUserName, wsPassword, userLanguage (TR)
   */
  static buildCreateShipment(
    creds: YurticiCredentials,
    data: YurticiCreateShipmentData,
  ): string {
    const userLanguage = creds.userLanguage || 'TR';

    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ship="http://yurticikargo.com.tr/ShippingOrderDispatcherServices">
   <soapenv:Header/>
   <soapenv:Body>
      <ship:createShipment>
         <wsUserName>${escapeXml(creds.wsUserName)}</wsUserName>
         <wsPassword>${escapeXml(creds.wsPassword)}</wsPassword>
         <userLanguage>${escapeXml(userLanguage)}</userLanguage>
         <ShippingOrderVK>
            <cargoKey>${escapeXml(data.cargoKey)}</cargoKey>
            <invoiceKey>${escapeXml(data.invoiceKey)}</invoiceKey>
            <receiverCustName>${escapeXml(data.receiverCustName)}</receiverCustName>
            <receiverAddress>${escapeXml(data.receiverAddress)}</receiverAddress>
            <receiverPhone1>${escapeXml(data.receiverPhone1)}</receiverPhone1>
            ${data.receiverPhone2 ? `<receiverPhone2>${escapeXml(data.receiverPhone2)}</receiverPhone2>` : ''}
            ${data.cityName ? `<cityName>${escapeXml(data.cityName)}</cityName>` : ''}
            ${data.townName ? `<townName>${escapeXml(data.townName)}</townName>` : ''}
            ${data.emailAddress ? `<emailAddress>${escapeXml(data.emailAddress)}</emailAddress>` : ''}
            <desi>${data.desi}</desi>
            <kg>${data.kg}</kg>
            <cargoCount>${data.cargoCount}</cargoCount>
            ${data.waybillNo ? `<waybillNo>${escapeXml(data.waybillNo)}</waybillNo>` : ''}
            ${data.description ? `<description>${escapeXml(data.description)}</description>` : ''}
         </ShippingOrderVK>
      </ship:createShipment>
   </soapenv:Body>
</soapenv:Envelope>`;
  }

  /**
   * Generates SOAP XML envelope for cancelShipment.
   * Authentication fields: wsUserName, wsPassword, userLanguage (TR)
   */
  static buildCancelShipment(creds: YurticiCredentials, cargoKey: string): string {
    const userLanguage = creds.userLanguage || 'TR';

    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ship="http://yurticikargo.com.tr/ShippingOrderDispatcherServices">
   <soapenv:Header/>
   <soapenv:Body>
      <ship:cancelShipment>
         <wsUserName>${escapeXml(creds.wsUserName)}</wsUserName>
         <wsPassword>${escapeXml(creds.wsPassword)}</wsPassword>
         <userLanguage>${escapeXml(userLanguage)}</userLanguage>
         <cargoKeys>${escapeXml(cargoKey)}</cargoKeys>
      </ship:cancelShipment>
   </soapenv:Body>
</soapenv:Envelope>`;
  }

  /**
   * Generates SOAP XML envelope for queryShipment.
   * Authentication fields: wsUserName, wsPassword, wsLanguage (TR)
   * CRITICAL: Notice field is wsLanguage for queryShipment, NOT userLanguage!
   */
  static buildQueryShipment(creds: YurticiCredentials, cargoKey: string): string {
    const wsLanguage = creds.wsLanguage || creds.userLanguage || 'TR';

    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ship="http://yurticikargo.com.tr/ShippingOrderDispatcherServices">
   <soapenv:Header/>
   <soapenv:Body>
      <ship:queryShipment>
         <wsUserName>${escapeXml(creds.wsUserName)}</wsUserName>
         <wsPassword>${escapeXml(creds.wsPassword)}</wsPassword>
         <wsLanguage>${escapeXml(wsLanguage)}</wsLanguage>
         <keys>${escapeXml(cargoKey)}</keys>
         <keyType>0</keyType>
         <addHistoricalData>1</addHistoricalData>
         <onlyTracking>0</onlyTracking>
      </ship:queryShipment>
   </soapenv:Body>
</soapenv:Envelope>`;
  }
}
