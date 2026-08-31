import { PttCreateShipmentPayload, PttCredentials } from './PttTypes';

function escapeXml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export class PttEnvelope {
  static buildCreateShipmentEnvelope(creds: PttCredentials, data: PttCreateShipmentPayload): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <gonderiKabul xmlns="http://ptt.gov.tr/">
      <kullanici>${escapeXml(creds.username)}</kullanici>${creds.password ? `
      <sifre>${escapeXml(creds.password)}</sifre>` : ''}
      <musteriNo>${escapeXml(creds.customerCode)}</musteriNo>
      <gonderi>
        <barkodNo>${escapeXml(data.barcode)}</barkodNo>
        <referansNo>${escapeXml(data.referenceNo)}</referansNo>
        <aliciAdi>${escapeXml(data.recipientName)}</aliciAdi>
        <aliciAdres>${escapeXml(data.recipientAddress)}</aliciAdres>
        <aliciIl>${escapeXml(data.recipientCity)}</aliciIl>
        <aliciIlce>${escapeXml(data.recipientDistrict)}</aliciIlce>
        <aliciTel>${escapeXml(data.recipientPhone)}</aliciTel>
        <desi>${data.desi}</desi>
        <agirlik>${data.weightKg}</agirlik>
        <parcaSayisi>${data.pieceCount}</parcaSayisi>
        <aciklama>${escapeXml(data.description || '')}</aciklama>
      </gonderi>
    </gonderiKabul>
  </soap:Body>
</soap:Envelope>`;
  }

  static buildCancelShipmentEnvelope(creds: PttCredentials, barcode: string): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <gonderiIptal xmlns="http://ptt.gov.tr/">
      <kullanici>${escapeXml(creds.username)}</kullanici>${creds.password ? `
      <sifre>${escapeXml(creds.password)}</sifre>` : ''}
      <musteriNo>${escapeXml(creds.customerCode)}</musteriNo>
      <barkodNo>${escapeXml(barcode)}</barkodNo>
    </gonderiIptal>
  </soap:Body>
</soap:Envelope>`;
  }

  static buildTrackingEnvelope(creds: PttCredentials, barcode: string): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <gonderiSorgu xmlns="http://ptt.gov.tr/">
      <kullanici>${escapeXml(creds.username)}</kullanici>${creds.password ? `
      <sifre>${escapeXml(creds.password)}</sifre>` : ''}
      <musteriNo>${escapeXml(creds.customerCode)}</musteriNo>
      <barkodNo>${escapeXml(barcode)}</barkodNo>
    </gonderiSorgu>
  </soap:Body>
</soap:Envelope>`;
  }
}
