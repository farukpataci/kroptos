import { XMLParser } from 'fast-xml-parser';
import { ArasShipmentQueryResult } from './ArasTypes';

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  parseTagValue: false,
});

export class ArasParser {
  /**
   * Safely parses SOAP XML response text into a JavaScript object.
   * Throws an Error with fault string if a SOAP Fault is present.
   */
  static parseRawSoap(xmlText: string): any {
    if (!xmlText || typeof xmlText !== 'string') {
      throw new Error('Aras Kargo yanıtı boş.');
    }

    try {
      const parsed = parser.parse(xmlText);
      const envelope = parsed?.Envelope || parsed;
      const body = envelope?.Body || envelope;

      if (body?.Fault) {
        const fault = body.Fault;
        const faultStr = fault.faultstring || fault.faultcode || 'SOAP Hatası';
        throw new Error(`Aras Kargo SOAP Hatası: ${faultStr}`);
      }

      return body;
    } catch (error: any) {
      if (error?.message?.startsWith('Aras Kargo SOAP Hatası')) {
        throw error;
      }
      throw new Error(`Aras Kargo yanıtı ayrıştırılamadı: ${error?.message || error}`);
    }
  }

  /**
   * Parses SetOrderResponse and extracts ResultCode / ResultMessage.
   */
  static parseSetOrderResult(xmlText: string): {
    resultCode: string;
    resultMessage: string;
    integrationCode?: string;
  } {
    const body = this.parseRawSoap(xmlText);

    const responseObj =
      body?.SetOrderResponse?.SetOrderResult ||
      body?.SetOrderResult ||
      body;

    const resultCode = String(responseObj?.ResultCode ?? responseObj?.resultCode ?? '0');
    const resultMessage = String(
      responseObj?.ResultMessage ?? responseObj?.resultMessage ?? responseObj?.Message ?? '',
    );
    const integrationCode = responseObj?.IntegrationCode ? String(responseObj.IntegrationCode) : undefined;

    return {
      resultCode,
      resultMessage,
      integrationCode,
    };
  }

  /**
   * Parses CancelOrderResponse.
   */
  static parseCancelOrderResult(xmlText: string): {
    resultCode: string;
    resultMessage: string;
  } {
    const body = this.parseRawSoap(xmlText);

    const responseObj =
      body?.CancelOrderResponse?.CancelOrderResult ||
      body?.CancelOrderResult ||
      body;

    const resultCode = String(responseObj?.ResultCode ?? responseObj?.resultCode ?? '0');
    const resultMessage = String(
      responseObj?.ResultMessage ?? responseObj?.resultMessage ?? responseObj?.Message ?? '',
    );

    return {
      resultCode,
      resultMessage,
    };
  }

  /**
   * Parses GetOrderWithIntegrationCodeResponse into ArasShipmentQueryResult.
   */
  static parseGetOrderResult(xmlText: string): ArasShipmentQueryResult {
    const body = this.parseRawSoap(xmlText);

    const responseObj =
      body?.GetOrderWithIntegrationCodeResponse?.GetOrderWithIntegrationCodeResult ||
      body?.GetOrderWithIntegrationCodeResult ||
      body;

    const orderInfo = responseObj?.OrderInformation || responseObj?.Order || responseObj;
    const statusCode = String(orderInfo?.StatusCode ?? orderInfo?.Status ?? orderInfo?.ResultCode ?? '');
    const statusName = String(orderInfo?.StatusName ?? orderInfo?.StatusText ?? orderInfo?.ResultMessage ?? '');
    const cargoKey = orderInfo?.CargoKey ? String(orderInfo.CargoKey) : undefined;
    const integrationCode = orderInfo?.IntegrationCode ? String(orderInfo.IntegrationCode) : undefined;

    const rawEvents = orderInfo?.Events?.Event || orderInfo?.EventDetails || [];
    const eventsArray = Array.isArray(rawEvents) ? rawEvents : rawEvents ? [rawEvents] : [];

    const events = eventsArray.map((e: any) => ({
      date: String(e.Date || e.EventDate || new Date().toISOString()),
      statusCode: String(e.StatusCode || e.Status || 'IN_TRANSIT'),
      description: String(e.Description || e.StatusName || 'Kargo hareketi'),
      location: e.Location ? String(e.Location) : undefined,
    }));

    return {
      orderId: orderInfo?.OrderId ? String(orderInfo.OrderId) : undefined,
      integrationCode,
      cargoKey,
      statusCode,
      statusName,
      events,
    };
  }
}
