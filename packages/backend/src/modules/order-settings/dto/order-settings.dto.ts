import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SettingChangeItemDto {
  @ApiProperty({ description: 'Setting key, e.g. order.general.currency' })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty({ description: 'Setting value to set' })
  value: any;
}

export class UpdateOrderSettingsDto {
  @ApiProperty({ type: [SettingChangeItemDto], description: 'List of changes' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SettingChangeItemDto)
  changes: SettingChangeItemDto[];

  @ApiPropertyOptional({ description: 'Optional reason for the change set' })
  @IsString()
  @IsOptional()
  reason?: string;
}

export class ResetOrderSettingsDto {
  @ApiProperty({ type: [String], description: 'List of setting keys to reset' })
  @IsArray()
  @IsString({ each: true })
  keys: string[];
}

export class LockOrderSettingsDto {
  @ApiProperty({ type: [String], description: 'List of setting keys to lock/unlock' })
  @IsArray()
  @IsString({ each: true })
  keys: string[];

  @ApiProperty({ description: 'Whether to lock (true) or unlock (false)' })
  @IsBoolean()
  locked: boolean;
}

export class CopyOrderSettingsDto {
  @ApiProperty({ description: 'Source store ID to copy from' })
  @IsString()
  @IsNotEmpty()
  sourceStoreId: string;

  @ApiProperty({ type: [String], description: 'Target store IDs to copy to' })
  @IsArray()
  @IsString({ each: true })
  targetStoreIds: string[];
}

export interface OrderSettingsDto {
  general: {
    timezone: string;
    currency: string;
    pricesIncludeTax: boolean;
    defaultLocale: string;
    minOrderAmount: number;
    maxItemsPerOrder: number;
  };
  numbering: {
    prefix: string;
    suffix: string;
    padding: number;
    pattern: string;
    resetPeriod: 'NEVER' | 'YEARLY' | 'MONTHLY';
    nextSequence: number;
    separateMarketplaceSeries: boolean;
  };
  flow: {
    initialStatusId: string;
    autoConfirm: boolean;
    autoConfirmDelayMinutes: number;
    autoCompleteAfterDeliveredDays: number;
    unpaidCancelAfterHours: number;
    editableUntilStatusId: string;
    cancellableUntilStatusId: string;
    requireCancelReason: boolean;
    cancelReasons: string[];
  };
  stock: {
    reserveOn: 'ORDER_CREATED' | 'PAYMENT_RECEIVED' | 'CONFIRMED';
    deductOn: 'CONFIRMED' | 'SHIPPED';
    releaseOnCancel: boolean;
    allowBackorder: boolean;
    reservationTimeoutMinutes: number;
    defaultWarehouseId?: string;
    warehouseSelection: 'DEFAULT' | 'NEAREST' | 'PRIORITY_LIST';
  };
  payment: {
    enabledMethods: string[];
  };
  cod: {
    enabled: boolean;
    fee: number;
    feeType: 'FIXED' | 'PERCENT';
    minAmount: number;
    maxAmount: number;
    cashOnly: boolean;
    excludedCities: string[];
    requireConfirmationAbove: number;
  };
  transfer: {
    discountPercent: number;
    paymentWindowHours: number;
  };
  shipping: {
    defaultCarrierId?: string;
    freeShippingThreshold: number;
    defaultDesi: number;
    desiCalculation: 'MAX_OF_WEIGHT_VOLUME' | 'WEIGHT' | 'VOLUME';
    volumetricDivisor: number;
    handlingTimeDays: number;
    cutoffTime: string;
    autoCreateShipmentOn: string;
    labelFormat: 'THERMAL_10X10' | 'A4';
  };
  invoice: {
    autoCreateOn: 'NEVER' | 'PAYMENT_RECEIVED' | 'CONFIRMED' | 'SHIPPED';
    provider: string;
    series: string;
    defaultTaxRate: number;
    includeShippingAsLine: boolean;
    sendToCustomer: boolean;
    individualTaxIdPlaceholder: string;
  };
  returns: {
    enabled: boolean;
    windowDays: number;
    windowStartsFrom: 'DELIVERED' | 'SHIPPED';
    reasons: string[];
    requireApproval: boolean;
    shippingPaidBy: 'STORE' | 'CUSTOMER' | 'BY_REASON';
    defaultReturnCarrierId?: string;
    refundMethod: 'ORIGINAL' | 'STORE_CREDIT' | 'CHOICE';
    autoRefundOnReceived: boolean;
  };
  exchange: {
    enabled: boolean;
  };
  risk: {
    requirePhoneVerificationAbove: number;
    maxOrdersPerCustomerPerDay: number;
    blockedPhones: string[];
    blockedEmails: string[];
    holdIfBillingShippingDiffer: boolean;
    holdNewCustomerCodAbove: number;
  };
  checkout: {
    requiredFields: string[];
    allowGuest: boolean;
    orderNoteEnabled: boolean;
    giftNoteEnabled: boolean;
    phoneFormat: string;
  };
  retention: {
    notificationLogDays: number;
    automationRunDays: number;
    exportFileDays: number;
    importFileDays: number;
    rollbackHours: number;
    maxRangeMonths: number;
    defaultDelimiter: string;
    defaultSenderName: string;
    quietHoursStart: string;
    quietHoursEnd: string;
  };
}

export function mapValuesToOrderSettingsDto(values: Record<string, any>): OrderSettingsDto {
  return {
    general: {
      timezone: values['order.general.timezone'] ?? 'Europe/Istanbul',
      currency: values['order.general.currency'] ?? 'TRY',
      pricesIncludeTax: values['order.general.pricesIncludeTax'] ?? true,
      defaultLocale: values['order.general.defaultLocale'] ?? 'tr-TR',
      minOrderAmount: Number(values['order.general.minOrderAmount'] ?? 0),
      maxItemsPerOrder: Number(values['order.general.maxItemsPerOrder'] ?? 50),
    },
    numbering: {
      prefix: values['order.numbering.prefix'] ?? 'KP',
      suffix: values['order.numbering.suffix'] ?? '',
      padding: Number(values['order.numbering.padding'] ?? 5),
      pattern: values['order.numbering.pattern'] ?? '{PREFIX}-{YYYY}{MM}-{SEQ}',
      resetPeriod: values['order.numbering.resetPeriod'] ?? 'YEARLY',
      nextSequence: Number(values['order.numbering.nextSequence'] ?? 1),
      separateMarketplaceSeries: values['order.numbering.separateMarketplaceSeries'] ?? false,
    },
    flow: {
      initialStatusId: values['order.flow.initialStatusId'] ?? 'pending',
      autoConfirm: values['order.flow.autoConfirm'] ?? false,
      autoConfirmDelayMinutes: Number(values['order.flow.autoConfirmDelayMinutes'] ?? 15),
      autoCompleteAfterDeliveredDays: Number(values['order.flow.autoCompleteAfterDeliveredDays'] ?? 14),
      unpaidCancelAfterHours: Number(values['order.flow.unpaidCancelAfterHours'] ?? 48),
      editableUntilStatusId: values['order.flow.editableUntilStatusId'] ?? 'processing',
      cancellableUntilStatusId: values['order.flow.cancellableUntilStatusId'] ?? 'shipped',
      requireCancelReason: values['order.flow.requireCancelReason'] ?? true,
      cancelReasons: values['order.flow.cancelReasons'] ?? ['Müşteri Vazgeçti', 'Hatalı Sipariş'],
    },
    stock: {
      reserveOn: values['order.stock.reserveOn'] ?? 'ORDER_CREATED',
      deductOn: values['order.stock.deductOn'] ?? 'CONFIRMED',
      releaseOnCancel: values['order.stock.releaseOnCancel'] ?? true,
      allowBackorder: values['order.stock.allowBackorder'] ?? false,
      reservationTimeoutMinutes: Number(values['order.stock.reservationTimeoutMinutes'] ?? 60),
      defaultWarehouseId: values['order.stock.defaultWarehouseId'] || undefined,
      warehouseSelection: values['order.stock.warehouseSelection'] ?? 'DEFAULT',
    },
    payment: {
      enabledMethods: values['order.payment.enabledMethods'] ?? ['CREDIT_CARD', 'BANK_TRANSFER', 'CASH_ON_DELIVERY'],
    },
    cod: {
      enabled: values['order.cod.enabled'] ?? true,
      fee: Number(values['order.cod.fee'] ?? 35.0),
      feeType: values['order.cod.feeType'] ?? 'FIXED',
      minAmount: Number(values['order.cod.minAmount'] ?? 100.0),
      maxAmount: Number(values['order.cod.maxAmount'] ?? 5000.0),
      cashOnly: values['order.cod.cashOnly'] ?? false,
      excludedCities: values['order.cod.excludedCities'] ?? [],
      requireConfirmationAbove: Number(values['order.cod.requireConfirmationAbove'] ?? 2000.0),
    },
    transfer: {
      discountPercent: Number(values['order.transfer.discountPercent'] ?? 0),
      paymentWindowHours: Number(values['order.transfer.paymentWindowHours'] ?? 48),
    },
    shipping: {
      defaultCarrierId: values['order.shipping.defaultCarrierId'] || undefined,
      freeShippingThreshold: Number(values['order.shipping.freeShippingThreshold'] ?? 750.0),
      defaultDesi: Number(values['order.shipping.defaultDesi'] ?? 1.0),
      desiCalculation: values['order.shipping.desiCalculation'] ?? 'MAX_OF_WEIGHT_VOLUME',
      volumetricDivisor: Number(values['order.shipping.volumetricDivisor'] ?? 3000),
      handlingTimeDays: Number(values['order.shipping.handlingTimeDays'] ?? 1),
      cutoffTime: values['order.shipping.cutoffTime'] ?? '16:00',
      autoCreateShipmentOn: values['order.shipping.autoCreateShipmentOn'] ?? 'confirmed',
      labelFormat: values['order.shipping.labelFormat'] ?? 'THERMAL_10X10',
    },
    invoice: {
      autoCreateOn: values['order.invoice.autoCreateOn'] ?? 'SHIPPED',
      provider: values['order.invoice.provider'] ?? 'parasut',
      series: values['order.invoice.series'] ?? 'KRP',
      defaultTaxRate: Number(values['order.invoice.defaultTaxRate'] ?? 20),
      includeShippingAsLine: values['order.invoice.includeShippingAsLine'] ?? true,
      sendToCustomer: values['order.invoice.sendToCustomer'] ?? true,
      individualTaxIdPlaceholder: values['order.invoice.individualTaxIdPlaceholder'] ?? '11111111111',
    },
    returns: {
      enabled: values['order.returns.enabled'] ?? true,
      windowDays: Number(values['order.returns.windowDays'] ?? 14),
      windowStartsFrom: values['order.returns.windowStartsFrom'] ?? 'DELIVERED',
      reasons: values['order.returns.reasons'] ?? [],
      requireApproval: values['order.returns.requireApproval'] ?? true,
      shippingPaidBy: values['order.returns.shippingPaidBy'] ?? 'STORE',
      defaultReturnCarrierId: values['order.returns.defaultReturnCarrierId'] || undefined,
      refundMethod: values['order.returns.refundMethod'] ?? 'ORIGINAL',
      autoRefundOnReceived: values['order.returns.autoRefundOnReceived'] ?? false,
    },
    exchange: {
      enabled: values['order.exchange.enabled'] ?? false,
    },
    risk: {
      requirePhoneVerificationAbove: Number(values['order.risk.requirePhoneVerificationAbove'] ?? 10000.0),
      maxOrdersPerCustomerPerDay: Number(values['order.risk.maxOrdersPerCustomerPerDay'] ?? 5),
      blockedPhones: values['order.risk.blockedPhones'] ?? [],
      blockedEmails: values['order.risk.blockedEmails'] ?? [],
      holdIfBillingShippingDiffer: values['order.risk.holdIfBillingShippingDiffer'] ?? false,
      holdNewCustomerCodAbove: Number(values['order.risk.holdNewCustomerCodAbove'] ?? 1500.0),
    },
    checkout: {
      requiredFields: values['order.checkout.requiredFields'] ?? ['customerName', 'customerPhone', 'shippingAddress'],
      allowGuest: values['order.checkout.allowGuest'] ?? true,
      orderNoteEnabled: values['order.checkout.orderNoteEnabled'] ?? true,
      giftNoteEnabled: values['order.checkout.giftNoteEnabled'] ?? true,
      phoneFormat: values['order.checkout.phoneFormat'] ?? '+90',
    },
    retention: {
      notificationLogDays: Number(values['order.retention.notificationLogDays'] ?? 180),
      automationRunDays: Number(values['order.retention.automationRunDays'] ?? 90),
      exportFileDays: Number(values['order.retention.exportFileDays'] ?? 7),
      importFileDays: Number(values['order.retention.importFileDays'] ?? 30),
      rollbackHours: Number(values['order.import.rollbackHours'] ?? 24),
      maxRangeMonths: Number(values['order.export.maxRangeMonths'] ?? 12),
      defaultDelimiter: values['order.export.defaultDelimiter'] ?? ';',
      defaultSenderName: values['order.notifications.defaultSenderName'] ?? 'KroptOS',
      quietHoursStart: values['order.notifications.quietHoursStart'] ?? '22:00',
      quietHoursEnd: values['order.notifications.quietHoursEnd'] ?? '08:00',
    },
  };
}
