import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
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

export class BulkCreateShipmentDto {
  @ApiProperty({ type: [CreateShipmentDto], description: 'Packing station batch' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateShipmentDto)
  shipments: CreateShipmentDto[];
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
