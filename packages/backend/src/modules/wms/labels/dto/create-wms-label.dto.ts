import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Trimmed before validation: `@IsNotEmpty` rejects '' but not '   ', and a
 * whitespace id passes straight through to the database, where it becomes the
 * foreign key error this DTO exists to prevent.
 */
const trimmed = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

/**
 * The body of POST /api/wms/labels.
 *
 * It exists because the handler used to take an inline `{ orderId, shipmentId? }`
 * type, which the global ValidationPipe cannot validate: a request with no
 * shipmentId sailed through and the handler substituted a fixed placeholder id.
 * Once WmsShippingLabel.shipmentId became a real foreign key that placeholder
 * pointed at no row, and every such call died with a Prisma P2003 the caller
 * saw as a 500.
 *
 * Both fields are required and named, so the missing one is answered with a 400
 * that says which.
 */
export class CreateWmsLabelDto {
  @ApiProperty({ description: 'Order the label is printed for' })
  @trimmed()
  @IsString({ message: 'orderId zorunlu bir metin alanidir.' })
  @IsNotEmpty({ message: 'orderId zorunludur: etiket bir siparise bagli olmadan basilamaz.' })
  orderId: string;

  @ApiProperty({ description: 'Shipment the label belongs to, in the active tenant' })
  @trimmed()
  @IsString({ message: 'shipmentId zorunlu bir metin alanidir.' })
  @IsNotEmpty({
    message:
      'shipmentId zorunludur: etiket bir gonderinin turevidir, once gonderi olusturulmalidir.',
  })
  shipmentId: string;
}
