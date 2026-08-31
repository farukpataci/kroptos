import { ArasCredentials, ArasOrderShipmentPayload } from './ArasTypes';

function escapeXml(unsafe: string): string {
  return String(unsafe ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export class ArasEnvelope {
  /**
   * Generates SOAP Envelope for SetOrder method.
   */
  static buildSetOrderEnvelope(
    creds: ArasCredentials,
    payload: ArasOrderShipmentPayload,
  ): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <SetOrder xmlns="http://tempuri.org/">
      <userName>${escapeXml(creds.userName)}</userName>
      <password>${escapeXml(creds.password)}</password>
      <orderInfo>
        <OrderInformation>
          <IntegrationCode>${escapeXml(payload.integrationCode)}</IntegrationCode>
          <TradingWaybillNumber>${escapeXml(payload.tradingWaybillNumber || payload.integrationCode)}</TradingWaybillNumber>
          <InvoiceNumber>${escapeXml(payload.invoiceNumber || '')}</InvoiceNumber>
          <ReceiverName>${escapeXml(payload.receiverName)}</ReceiverName>
          <ReceiverAddress>${escapeXml(payload.receiverAddress)}</ReceiverAddress>
          <ReceiverCityName>${escapeXml(payload.cityName)}</ReceiverCityName>
          <ReceiverTownName>${escapeXml(payload.townName)}</ReceiverTownName>
          <ReceiverPhone1>${escapeXml(payload.receiverPhone)}</ReceiverPhone1>
          <PayorTypeCode>${payload.payorTypeCode}</PayorTypeCode>
          <PieceCount>${payload.pieceCount}</PieceCount>
          <Desi>${payload.desi}</Desi>
          <Weight>${payload.weight}</Weight>
          <Description>${escapeXml(payload.description || '')}</Description>
        </OrderInformation>
      </orderInfo>
    </SetOrder>
  </soap:Body>
</soap:Envelope>`;
  }

  /**
   * Generates SOAP Envelope for GetOrderWithIntegrationCode method.
   */
  static buildGetOrderEnvelope(creds: ArasCredentials, integrationCode: string): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetOrderWithIntegrationCode xmlns="http://tempuri.org/">
      <userName>${escapeXml(creds.userName)}</userName>
      <password>${escapeXml(creds.password)}</password>
      <integrationCode>${escapeXml(integrationCode)}</integrationCode>
    </GetOrderWithIntegrationCode>
  </soap:Body>
</soap:Envelope>`;
  }

  /**
   * Generates SOAP Envelope for CancelOrder method.
   */
  static buildCancelOrderEnvelope(creds: ArasCredentials, integrationCode: string): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <CancelOrder xmlns="http://tempuri.org/">
      <userName>${escapeXml(creds.userName)}</userName>
      <password>${escapeXml(creds.password)}</password>
      <integrationCode>${escapeXml(integrationCode)}</integrationCode>
    </CancelOrder>
  </soap:Body>
</soap:Envelope>`;
  }
}
