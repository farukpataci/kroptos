import { SuratCreateShipmentInput, SuratCredentials } from './SuratTypes';

export class SuratEnvelope {
  /** Escapes XML special characters. */
  private static escapeXml(str: string | number | undefined | null): string {
    if (str === undefined || str === null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Builds SOAP envelope for GonderiyiKargoyaGonderYeniSiparisBarkodOlustur
   */
  static buildCreateShipment(creds: SuratCredentials, input: SuratCreateShipmentInput): string {
    const paymentTypeCode = input.paymentType === 'recipient_pays' ? '2' : '1';

    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GonderiyiKargoyaGonderYeniSiparisBarkodOlustur xmlns="http://tempuri.org/">
      <KullaniciAdi>${this.escapeXml(creds.userName)}</KullaniciAdi>
      <Sifre>${this.escapeXml(creds.password)}</Sifre>
      <GonderiCariKodu>${this.escapeXml(creds.customerCode || creds.userName)}</GonderiCariKodu>
      <OzelKargoTakipNo>${this.escapeXml(input.cargoKey)}</OzelKargoTakipNo>
      <AliciMusteriAdi>${this.escapeXml(input.recipientName)}</AliciMusteriAdi>
      <AliciAdres>${this.escapeXml(input.recipientAddress)}</AliciAdres>
      <AliciIl>${this.escapeXml(input.recipientCity)}</AliciIl>
      <AliciIlce>${this.escapeXml(input.recipientDistrict)}</AliciIlce>
      <AliciTelefon>${this.escapeXml(input.recipientPhone)}</AliciTelefon>
      <AliciEposta>${this.escapeXml(input.recipientEmail)}</AliciEposta>
      <AliciVergiNo>${this.escapeXml(input.recipientTaxId)}</AliciVergiNo>
      <KargoTuru>1</KargoTuru>
      <OdemeTuru>${paymentTypeCode}</OdemeTuru>
      <Desi>${this.escapeXml(input.desi)}</Desi>
      <Kilo>${this.escapeXml(input.weightKg)}</Kilo>
      <ParcaSayisi>${this.escapeXml(input.parcelCount)}</ParcaSayisi>
      <TahsilatliKargoTutar>${this.escapeXml(input.codAmount || 0)}</TahsilatliKargoTutar>
      <Aciklama>${this.escapeXml(input.notes)}</Aciklama>
    </GonderiyiKargoyaGonderYeniSiparisBarkodOlustur>
  </soap:Body>
</soap:Envelope>`;
  }

  /**
   * Builds SOAP envelope for KargoTakipHareketDetayliV2
   */
  static buildQueryTracking(creds: SuratCredentials, trackingNumber: string): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <KargoTakipHareketDetayliV2 xmlns="http://tempuri.org/">
      <KullaniciAdi>${this.escapeXml(creds.userName)}</KullaniciAdi>
      <Sifre>${this.escapeXml(creds.password)}</Sifre>
      <TakipNo>${this.escapeXml(trackingNumber)}</TakipNo>
    </KargoTakipHareketDetayliV2>
  </soap:Body>
</soap:Envelope>`;
  }

  /**
   * Builds SOAP envelope for GonderiGeriCek
   */
  static buildCancelShipment(creds: SuratCredentials, trackingNumber: string): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GonderiGeriCek xmlns="http://tempuri.org/">
      <KullaniciAdi>${this.escapeXml(creds.userName)}</KullaniciAdi>
      <Sifre>${this.escapeXml(creds.password)}</Sifre>
      <OzelKargoTakipNo>${this.escapeXml(trackingNumber)}</OzelKargoTakipNo>
    </GonderiGeriCek>
  </soap:Body>
</soap:Envelope>`;
  }
}
