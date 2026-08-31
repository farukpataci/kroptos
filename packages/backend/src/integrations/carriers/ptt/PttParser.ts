import { XMLParser } from 'fast-xml-parser';
import {
  PttCancelShipmentResult,
  PttCreateShipmentResult,
  PttTrackingResult,
} from './PttTypes';

export class PttParser {
  private static parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
  });

  static parseRawSoap(xmlText: string): any {
    if (!xmlText || typeof xmlText !== 'string') {
      throw new Error('PTT SOAP yanıtı boş veya geçersiz.');
    }

    const parsed = this.parser.parse(xmlText);
    const body = parsed?.Envelope?.Body || parsed?.Body;

    if (!body) {
      throw new Error('PTT SOAP yanıt gövdesi okunamadı.');
    }

    if (body.Fault) {
      const faultStr = body.Fault.faultstring || body.Fault.faultcode || 'Bilinmeyen SOAP Hatası';
      throw new Error(`PTT SOAP servisi hata döndürdü: ${faultStr}`);
    }

    return body;
  }

  static parseCreateShipmentResult(xmlText: string): PttCreateShipmentResult {
    const body = this.parseRawSoap(xmlText);
    const res = body.gonderiKabulResponse?.return || body.gonderiKabulResponse || body.return || {};

    return {
      resultCode: String(res.sonucKodu ?? res.resultCode ?? '0'),
      resultMessage: String(res.sonucAciklamasi ?? res.resultMessage ?? 'İşlem Başarılı'),
      barcode: res.barkodNo || res.barcode,
      referenceNo: res.referansNo || res.referenceNo,
    };
  }

  static parseCancelShipmentResult(xmlText: string): PttCancelShipmentResult {
    const body = this.parseRawSoap(xmlText);
    const res = body.gonderiIptalResponse?.return || body.gonderiIptalResponse || body.return || {};

    return {
      resultCode: String(res.sonucKodu ?? res.resultCode ?? '0'),
      resultMessage: String(res.sonucAciklamasi ?? res.resultMessage ?? 'İptal Edildi'),
    };
  }

  static parseTrackingResult(xmlText: string): PttTrackingResult {
    const body = this.parseRawSoap(xmlText);
    const res = body.gonderiSorguResponse?.return || body.gonderiSorguResponse || body.return || {};

    const eventsList = res.dongu || res.events || res.hareketler || [];
    const normalizedEvents = Array.isArray(eventsList) ? eventsList : eventsList ? [eventsList] : [];

    const events = normalizedEvents.map((ev: any) => ({
      date: String(ev.tarih || ev.date || new Date().toISOString()),
      statusCode: String(ev.durumKodu || ev.statusCode || 'YOLDA'),
      description: String(ev.durumAciklamasi || ev.description || 'Kargo hareketi'),
      location: ev.islemYeri || ev.location,
    }));

    return {
      barcode: res.barkodNo || res.barcode,
      statusCode: String(res.sonucKodu || res.durumKodu || res.statusCode || 'YOLDA'),
      statusName: String(res.sonucAciklamasi || res.durumAciklamasi || res.statusName || 'Kargo Yolda'),
      events,
    };
  }
}
