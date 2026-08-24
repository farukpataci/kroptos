import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  LABEL_FORMATS,
  PAYMENT_TYPES,
  SERVICE_LEVELS,
  SHIPMENT_PROBLEMS,
  SHIPMENT_STATUSES,
} from '../../../integrations/carriers/core/CarrierTypes';
import { CarrierAddressDto } from './carrier-integration.dto';

/**
 * Trimmed before validation: `@IsNotEmpty` rejects '' but not '   ', and a
 * whitespace value passes straight through to the database.
 */
const trimmed = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export class ParcelDto {
  @ApiProperty({ example: 1.5 })
  @IsNumber()
  @IsPositive()
  @Max(1000)
  weightKg: number;

  @ApiProperty({ example: 30 })
  @IsNumber()
  @IsPositive()
  @Max(500)
  lengthCm: number;

  @ApiProperty({ example: 20 })
  @IsNumber()
  @IsPositive()
  @Max(500)
  widthCm: number;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @IsPositive()
  @Max(500)
  heightCm: number;

  @ApiPropertyOptional({ example: 'Tekstil ürünü' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  contentDescription?: string;
}

export class CreateShipmentDto {
  @ApiProperty({ description: 'CarrierIntegration id inside the active tenant' })
  @IsString()
  carrierIntegrationId: string;

  @ApiPropertyOptional({ description: 'Order this shipment fulfils' })
  @IsString()
  @IsOptional()
  orderId?: string;

  @ApiProperty({ example: 'ORD-1042' })
  @IsString()
  @MaxLength(64)
  orderNumber: string;

  @ApiPropertyOptional({
    type: CarrierAddressDto,
    description: "Falls back to the integration's stored sender address.",
  })
  @ValidateNested()
  @Type(() => CarrierAddressDto)
  @IsOptional()
  sender?: CarrierAddressDto;

  @ApiProperty({ type: CarrierAddressDto })
  @ValidateNested()
  @Type(() => CarrierAddressDto)
  recipient: CarrierAddressDto;

  @ApiProperty({ type: [ParcelDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ParcelDto)
  parcels: ParcelDto[];

  @ApiProperty({ enum: PAYMENT_TYPES, default: 'sender_pays' })
  @IsIn(PAYMENT_TYPES as readonly string[])
  paymentType: string;

  @ApiPropertyOptional({ example: 249.9 })
  @IsNumber()
  @IsPositive()
  @IsOptional()
  codAmount?: number;

  @ApiPropertyOptional({ example: 'TRY' })
  @IsString()
  @IsOptional()
  @MaxLength(3)
  codCurrency?: string;

  @ApiPropertyOptional({ enum: SERVICE_LEVELS })
  @IsIn(SERVICE_LEVELS as readonly string[])
  @IsOptional()
  serviceLevel?: string;

  @ApiPropertyOptional({
    description: 'Idempotency key. Defaults to the order id, so one order gets one barcode.',
  })
  @IsString()
  @IsOptional()
  @MaxLength(120)
  referenceCode?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(500)
  notes?: string;
}

/**
 * One order in a packing round.
 *
 * There is no recipient field and there will not be one. The address is read
 * from the order's own structured columns on the server, which is both the only
 * place it is trustworthy and the reason the packing screens can stay free of
 * it: a body that accepted an address would be an open door for PII to be
 * posted from a client that was never given any.
 *
 * `parcels` has no default. The measurement is the price — desi is
 * (l*w*h)/divisor and the carrier bills whichever is larger, that or the weight
 * — so a stand-in like 1 kg / 20x20x20 would invoice the tenant for a parcel
 * nobody put on the scale.
 */
export class CreateShipmentForOrderDto {
  @ApiProperty({ description: 'Order the shipment fulfils; its address is used' })
  @trimmed()
  @IsString({ message: 'orderId zorunlu bir metin alanidir.' })
  @IsNotEmpty({ message: 'orderId zorunludur: gonderi bir siparise bagli olmadan olusturulamaz.' })
  orderId: string;

  @ApiProperty({
    type: [ParcelDto],
    description: 'Measured at the packing station. One entry per box.',
  })
  @IsArray({ message: 'parcels zorunludur: paket olculeri olmadan desi ve ucret hesaplanamaz.' })
  @ArrayMinSize(1, {
    message: 'parcels en az bir paket icermelidir: olculmemis kutu icin gonderi olusturulamaz.',
  })
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ParcelDto)
  parcels: ParcelDto[];

  @ApiPropertyOptional({
    description:
      'Which carrier connection to use. Only needed when the store has more than one active.',
  })
  @trimmed()
  @IsString()
  @IsOptional()
  carrierIntegrationId?: string;

  @ApiPropertyOptional({ enum: PAYMENT_TYPES, default: 'sender_pays' })
  @IsIn(PAYMENT_TYPES as readonly string[])
  @IsOptional()
  paymentType?: string;

  @ApiPropertyOptional({ description: 'Required when paymentType is cod' })
  @IsNumber()
  @IsPositive()
  @IsOptional()
  codAmount?: number;

  @ApiPropertyOptional({ example: 'TRY' })
  @trimmed()
  @IsString()
  @IsOptional()
  @MaxLength(3)
  codCurrency?: string;

  @ApiPropertyOptional({ enum: SERVICE_LEVELS })
  @IsIn(SERVICE_LEVELS as readonly string[])
  @IsOptional()
  serviceLevel?: string;
}

export class BulkCreateShipmentDto {
  @ApiProperty({ type: [CreateShipmentForOrderDto], description: 'Packing station batch' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateShipmentForOrderDto)
  items: CreateShipmentForOrderDto[];
}

/**
 * The parcels going onto one courier's van. Ids rather than a filter: a manifest
 * is signed for a pile someone counted, not for whatever a query returned a
 * second later.
 */
export class HandoverShipmentsDto {
  @ApiProperty({ type: [String], description: 'Shipment ids in the active tenant' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsString({ each: true })
  shipmentIds: string[];
}

export class ListShipmentsQueryDto {
  @ApiPropertyOptional({ enum: SHIPMENT_STATUSES })
  @IsIn(SHIPMENT_STATUSES as readonly string[])
  @IsOptional()
  status?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  provider?: string;

  @ApiPropertyOptional({
    enum: SHIPMENT_PROBLEMS,
    description:
      'Only the shipments someone has to chase: a claim with no barcode, or a cancel the carrier refused.',
  })
  @IsIn(SHIPMENT_PROBLEMS as readonly string[])
  @IsOptional()
  problem?: string;

  @ApiPropertyOptional({
    description:
      'Free-text search over the tracking number, the barcode, our reference and the order number.',
  })
  @IsString()
  @MaxLength(120)
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({ description: 'ISO date, inclusive lower bound on createdAt' })
  @IsDateString()
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO date, exclusive upper bound on createdAt' })
  @IsDateString()
  @IsOptional()
  to?: string;

  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 50, maximum: 200 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  @IsOptional()
  pageSize?: number;
}

export class LabelQueryDto {
  @ApiPropertyOptional({ enum: LABEL_FORMATS, default: 'PDF' })
  @IsIn(LABEL_FORMATS as readonly string[])
  @IsOptional()
  format?: string;
}

export class CancelShipmentDto {
  @ApiPropertyOptional({ example: 'Müşteri siparişi iptal etti' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  reason?: string;
}

export class QuoteShipmentDto {
  @ApiProperty({ description: 'CarrierIntegration ids to compare' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  carrierIntegrationIds: string[];

  @ApiPropertyOptional({ type: CarrierAddressDto })
  @ValidateNested()
  @Type(() => CarrierAddressDto)
  @IsOptional()
  sender?: CarrierAddressDto;

  @ApiProperty({ type: CarrierAddressDto })
  @ValidateNested()
  @Type(() => CarrierAddressDto)
  recipient: CarrierAddressDto;

  @ApiProperty({ type: [ParcelDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ParcelDto)
  parcels: ParcelDto[];

  @ApiPropertyOptional({ enum: PAYMENT_TYPES })
  @IsIn(PAYMENT_TYPES as readonly string[])
  @IsOptional()
  paymentType?: string;

  @ApiPropertyOptional({
    enum: SERVICE_LEVELS,
    description: 'Quote the level that will actually ship; omitting it prices standard.',
  })
  @IsIn(SERVICE_LEVELS as readonly string[])
  @IsOptional()
  serviceLevel?: string;

  @ApiPropertyOptional({ description: 'Include carriers still in test mode' })
  @IsBoolean()
  @IsOptional()
  includeTestMode?: boolean;
}

/**
 * The list row, field for field as ShipmentService.toListItem builds it.
 *
 * No sender or recipient address: those are KVKK data and a paged list is the
 * module's widest exposure of them. The detail endpoint returns them, with the
 * packages and the tracking timeline, to an operator who opened one shipment.
 */
export class ShipmentResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() publicId: string;
  @ApiProperty() provider: string;
  @ApiProperty({ enum: SHIPMENT_STATUSES }) status: string;
  @ApiPropertyOptional({ description: "Carrier's own code, never used for filtering" })
  carrierStatusCode?: string;
  @ApiPropertyOptional() trackingNumber?: string;
  @ApiPropertyOptional() barcode?: string;
  @ApiPropertyOptional() orderId?: string;
  @ApiPropertyOptional({ description: 'Idempotency key this shipment claimed' })
  referenceCode?: string;
  @ApiPropertyOptional({ enum: SERVICE_LEVELS }) serviceLevel?: string;
  @ApiProperty({ enum: PAYMENT_TYPES }) paymentType: string;
  @ApiPropertyOptional({ type: Number }) codAmount?: number;
  @ApiPropertyOptional() codCurrency?: string;
  @ApiPropertyOptional({ type: Number }) totalDesi?: number;
  @ApiPropertyOptional({ type: Number }) totalWeightKg?: number;
  @ApiPropertyOptional({ type: Number, description: 'max(weight, desi) per parcel, summed' })
  chargeableWeightKg?: number;
  @ApiPropertyOptional({ enum: LABEL_FORMATS }) labelFormat?: string;
  @ApiProperty() isTestMode: boolean;
  @ApiPropertyOptional() handedOverAt?: Date;
  @ApiPropertyOptional() deliveredAt?: Date;
  @ApiPropertyOptional() cancelledAt?: Date;
  @ApiPropertyOptional({ description: 'Set only when the carrier confirmed the cancellation' })
  carrierCancelledAt?: Date;
  @ApiPropertyOptional({
    description: 'Filled with carrierCancelledAt empty = the barcode is still live at the carrier',
  })
  carrierCancelError?: string;
  @ApiProperty() createdAt: Date;
}
