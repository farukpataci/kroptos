import { XMLParser } from 'fast-xml-parser';
import {
  SuratCancelResult,
  SuratCreateShipmentResult,
  SuratTrackingEvent,
  SuratTrackingResult,
} from './SuratTypes';

export class SuratParser {
  private static parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
  });

  static parseRawSoap(xmlText: string): any {
    if (!xmlText || typeof xmlText !== 'string') {
      throw new Error('Sürat Kargo SOAP yanıtı boş veya geçersiz.');
    }

    const parsed = this.parser.parse(xmlText);
    const body = parsed?.Envelope?.Body || parsed?.Body;

    if (!body) {
      throw new Error('Sürat Kargo SOAP yanıt gövdesi okunamadı.');
    }

    if (body.Fault) {
      const faultStr = body.Fault.faultstring || body.Fault.faultcode || 'Bilinmeyen SOAP Hatası';
      throw new Error(`Sürat Kargo SOAP servisi hata döndürdü: ${faultStr}`);
    }

    return body;
  }

  static parseCreateShipmentResult(xmlText: string): SuratCreateShipmentResult {
    const body = this.parseRawSoap(xmlText);
    const response =
      body.GonderiyiKargoyaGonderYeniSiparisBarkodOlusturResponse ||
      body.gonderiResponse ||
      body;

    const res =
      response.GonderiyiKargoyaGonderYeniSiparisBarkodOlusturResult ||
      response.return ||
      response;

    const isStringRes = typeof res === 'string';
    const resultCode = isStringRes
      ? res.includes('OK') || res.includes('BAŞARILI') || res.startsWith('1')
        ? '1'
        : '0'
      : String(res.ResultCode ?? res.SonucKodu ?? res.isSuccess ?? res.Sonuc ?? '1');

    const resultMessage = isStringRes
      ? res
      : String(res.ResultMessage ?? res.SonucAciklamasi ?? res.Aciklama ?? 'İşlem Tamamlandı');

    const barcode = res.Barcode || res.Barkod || res.TakipNo || res.KargoTakipNo;
    const trackingNumber = res.TrackingNumber || res.TakipNo || res.OzelKargoTakipNo;

    return {
      resultCode,
      resultMessage,
      barcode,
      trackingNumber,
      cargoKey: trackingNumber,
      raw: res,
    };
  }

  static parseCancelResult(xmlText: string): SuratCancelResult {
    const body = this.parseRawSoap(xmlText);
    const response = body.GonderiGeriCekResponse || body.GonderiGeriCekResult || body;
    const res = response.GonderiGeriCekResult || response.return || response;

    const isStringRes = typeof res === 'string';
    const resultCode = isStringRes
      ? res.includes('OK') || res.includes('İPTAL') || res.startsWith('1')
        ? '1'
        : '0'
      : String(res.ResultCode ?? res.SonucKodu ?? '1');

    const resultMessage = isStringRes
      ? res
      : String(res.ResultMessage ?? res.SonucAciklamasi ?? 'İptal İşlemi Tamamlandı');

    return {
      resultCode,
      resultMessage,
    };
  }

  static parseTrackingResult(xmlText: string, defaultTrackingNo = ''): SuratTrackingResult {
    const body = this.parseRawSoap(xmlText);
    const response = body.KargoTakipHareketDetayliV2Response || body;
    const res = response.KargoTakipHareketDetayliV2Result || response.return || response;

    const trackingNumber =
      res.TakipNo || res.OzelKargoTakipNo || res.KargoTakipNo || defaultTrackingNo;
    const statusCode = String(res.SonucKodu || res.DurumKodu || res.StatusCode || 'YOLDA');
    const statusName = String(res.SonucAciklamasi || res.DurumAciklamasi || res.StatusName || 'Kargo Yolda');
    const deliveredAt = res.TeslimTarihi || res.DeliveryDate;
    const recipientName = res.TeslimAlan || res.RecipientName;

    const rawMovements = res.Hareketler || res.TakipHareketleri || res.Movements || res.DetailList || [];
    const normalizedMovements = Array.isArray(rawMovements)
      ? rawMovements
      : typeof rawMovements === 'object' && rawMovements !== null
        ? rawMovements.Hareket || rawMovements.Movement || [rawMovements]
        : [];

    const movementsArray = Array.isArray(normalizedMovements)
      ? normalizedMovements
      : [normalizedMovements];

    const events: SuratTrackingEvent[] = movementsArray
      .filter((m: any) => m && typeof m === 'object')
      .map((m: any) => ({
        date: String(m.Tarih || m.Date || new Date().toISOString()),
        statusCode: String(m.IslemKodu || m.DurumKodu || m.StatusCode || 'HAREKET'),
        description: String(m.IslemAciklamasi || m.Aciklama || m.Description || 'Kargo Hareketi'),
        location: m.BirimAdi || m.SubeAdi || m.Location,
      }));

    return {
      trackingNumber,
      statusCode,
      statusName,
      events,
      deliveredAt,
      recipientName,
    };
  }
}
