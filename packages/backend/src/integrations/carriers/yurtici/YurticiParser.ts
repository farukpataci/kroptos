import { XMLParser } from 'fast-xml-parser';
import {
  YurticiShipmentDetailVO,
  YurticiShippingOrderResult,
  YurticiTrackingEventVO,
} from './YurticiTypes';

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  parseTagValue: false,
});

export class YurticiParser {
  /**
   * Safely parses SOAP XML response text into a JavaScript object.
   * Throws an Error with fault string if a SOAP Fault is present.
   */
  static parseRawSoap(xmlText: string): any {
    if (!xmlText || typeof xmlText !== 'string') {
      throw new Error('Yurtiçi Kargo yanıtı boş.');
    }

    try {
      const parsed = parser.parse(xmlText);
      const envelope = parsed?.Envelope || parsed;
      const body = envelope?.Body || envelope;

      if (body?.Fault) {
        const fault = body.Fault;
        const faultStr = fault.faultstring || fault.faultcode || 'SOAP Hatası';
        throw new Error(`Yurtiçi Kargo SOAP Hatası: ${faultStr}`);
      }

      return body;
    } catch (error: any) {
      if (error?.message?.startsWith('Yurtiçi Kargo SOAP Hatası')) {
        throw error;
      }
      throw new Error(`Yurtiçi Kargo yanıtı ayrıştırılamadı: ${error?.message || error}`);
    }
  }

  /**
   * Extracts ShippingOrderResult from createShipmentResponse or cancelShipmentResponse.
   */
  static parseShippingOrderResult(xmlText: string): YurticiShippingOrderResult {
    const body = this.parseRawSoap(xmlText);

    const responseObj =
      body?.createShipmentResponse?.ShippingOrderResult ||
      body?.cancelShipmentResponse?.ShippingOrderResult ||
      body?.ShippingOrderResult ||
      body;

    return {
      outFlag: responseObj?.outFlag ? String(responseObj.outFlag) : undefined,
      outResult: responseObj?.outResult ? String(responseObj.outResult) : undefined,
      errCode: responseObj?.errCode ? String(responseObj.errCode) : undefined,
      errMessage: responseObj?.errMessage ? String(responseObj.errMessage) : undefined,
      jobId: responseObj?.jobId ? String(responseObj.jobId) : undefined,
      shippingDataDetailVVO: responseObj?.shippingDataDetailVVO
        ? {
            cargoKey: responseObj.shippingDataDetailVVO.cargoKey,
            docId: responseObj.shippingDataDetailVVO.docId,
            docNo: responseObj.shippingDataDetailVVO.docNo,
            trackingUrl: responseObj.shippingDataDetailVVO.trackingUrl,
          }
        : undefined,
    };
  }

  /**
   * Extracts ShipmentDetailVO array from queryShipmentResponse.
   */
  static parseQueryShipmentResult(xmlText: string): YurticiShipmentDetailVO[] {
    const body = this.parseRawSoap(xmlText);

    const responseObj = body?.queryShipmentResponse?.ShippingOrderResult || body;
    const detailList =
      responseObj?.shippingDeliveryDetailVOArray ||
      responseObj?.shippingDeliveryDetailVO ||
      [];

    const rawArray = Array.isArray(detailList) ? detailList : [detailList];

    return rawArray.map((item: any) => {
      const rawEvents =
        item?.shippingDeliveryItemDetailVOArray ||
        item?.shippingDeliveryItemDetailVO ||
        [];
      const eventsArray = Array.isArray(rawEvents) ? rawEvents : rawEvents ? [rawEvents] : [];

      const events: YurticiTrackingEventVO[] = eventsArray.map((evt: any) => ({
        operationDate: evt?.operationDate ? String(evt.operationDate) : undefined,
        operationTime: evt?.operationTime ? String(evt.operationTime) : undefined,
        operationCode: evt?.operationCode ? String(evt.operationCode) : undefined,
        operationName: evt?.operationName ? String(evt.operationName) : undefined,
        unitName: evt?.unitName ? String(evt.unitName) : undefined,
        unitCode: evt?.unitCode ? String(evt.unitCode) : undefined,
      }));

      return {
        cargoKey: item?.cargoKey ? String(item.cargoKey) : undefined,
        docId: item?.docId ? String(item.docId) : undefined,
        docNo: item?.docNo ? String(item.docNo) : undefined,
        jobId: item?.jobId ? String(item.jobId) : undefined,
        operationCode: item?.operationCode ? String(item.operationCode) : undefined,
        operationMessage: item?.operationMessage ? String(item.operationMessage) : undefined,
        errCode: item?.errCode ? String(item.errCode) : undefined,
        errMessage: item?.errMessage ? String(item.errMessage) : undefined,
        shippingDeliveryItemDetailVOArray: events,
      };
    });
  }
}
