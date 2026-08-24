import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  PAYMENT_TYPES,
  SERVICE_LEVELS,
} from '../../../../integrations/carriers/core/CarrierTypes';
import { ParcelDto } from '../../../shipment/dto/shipment.dto';

/**
 * Trimmed before validation: `@IsNotEmpty` rejects '' but not '   ', and a
 * whitespace value passes straight through to the database.
 */
const trimmed = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

/**
 * The body of POST /api/wms/labels.
 *
 * The endpoint no longer takes a shipment id — it creates the shipment. What it
 * cannot create is the measurement: the packing station has the box on the
 * scale and nothing else in the system does. `WmsPackagingTask` records who
 * packed and when, not how big; `Product` carries weight, width and height but
 * no length, and a box is not the sum of its contents anyway.
 *
 * So `parcels` is required with no default. A stand-in like 1 kg / 20x20x20
 * would be the one invented value that sets the price: desi is (l*w*h)/divisor
 * and the carrier bills whichever is larger, that or the weight. Guessing it
 * invoices the tenant for a parcel nobody measured.
 *
 * Several boxes for one order are accepted from the start. The tables are new,
 * so the plural costs nothing today; adding it later means reopening every
 * connector that assumed one.
 */
export class CreateWmsLabelDto {
  @ApiProperty({ description: 'Order the label is printed for' })
  @trimmed()
  @IsString({ message: 'orderId zorunlu bir metin alanidir.' })
  @IsNotEmpty({ message: 'orderId zorunludur: etiket bir siparise bagli olmadan basilamaz.' })
  orderId: string;

  @ApiProperty({
    type: [ParcelDto],
    description: 'Measured at the packing station. One entry per box.',
  })
  @IsArray({ message: 'parcels zorunludur: paket olculeri olmadan desi ve ucret hesaplanamaz.' })
  @ArrayMinSize(1, {
    message: 'parcels en az bir paket icermelidir: olculmemis kutu icin etiket basilamaz.',
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

  @ApiPropertyOptional({
    enum: PAYMENT_TYPES,
    default: 'sender_pays',
    description:
      'Order carries no cash-on-delivery flag anywhere, so the packer states it when the parcel is collected on delivery.',
  })
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

/**
 * One packing round: several orders, each with its own measured boxes.
 *
 * Not `POST /api/shipments/bulk`, which the packing station cannot use — that
 * endpoint wants the recipient address in the body, and the screens the packer
 * works from deliberately never receive it (KVKK: the shipment list withholds
 * addresses). Here the address comes off the order on the server, exactly as
 * the single-label endpoint already does.
 */
export class CreateWmsLabelsBulkDto {
  @ApiProperty({ type: [CreateWmsLabelDto], description: 'One entry per order' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateWmsLabelDto)
  items: CreateWmsLabelDto[];
}
