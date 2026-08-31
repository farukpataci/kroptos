/**
 * Yurtiçi Kargo (SOAP) carrier API constants and types.
 */

export const YURTICI_GATEWAY = {
  TEST: 'http://testwebservices.yurticikargo.com:9090',
  PRODUCTION: 'https://webservices.yurticikargo.com:8080',
} as const;

export const YURTICI_DISPATCHER_PATH = '/KOPSWebServices/ShippingOrderDispatcherServices';

export interface YurticiCredentials {
  wsUserName: string;
  wsPassword: string;
  userLanguage?: string;
  wsLanguage?: string;
}

export interface YurticiCreateShipmentData {
  cargoKey: string;
  invoiceKey: string;
  receiverCustName: string;
  receiverAddress: string;
  receiverPhone1: string;
  receiverPhone2?: string;
  cityName?: string;
  townName?: string;
  emailAddress?: string;
  desi: number;
  kg: number;
  cargoCount: number;
  description?: string;
  waybillNo?: string;
}

export interface YurticiShippingOrderResult {
  outFlag?: string;
  outResult?: string;
  errCode?: string;
  errMessage?: string;
  jobId?: string;
  shippingDataDetailVVO?: {
    cargoKey?: string;
    docId?: string;
    docNo?: string;
    trackingUrl?: string;
  };
}

export interface YurticiTrackingEventVO {
  operationDate?: string;
  operationTime?: string;
  operationCode?: string;
  operationName?: string;
  unitName?: string;
  unitCode?: string;
}

export interface YurticiShipmentDetailVO {
  cargoKey?: string;
  docId?: string;
  docNo?: string;
  jobId?: string;
  operationCode?: string;
  operationMessage?: string;
  errCode?: string;
  errMessage?: string;
  shippingDeliveryItemDetailVOArray?: YurticiTrackingEventVO[];
}
