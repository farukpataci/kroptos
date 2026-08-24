import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { CreateShipmentForOrderDto } from '../../../shipment/dto/shipment.dto';

/**
 * The body of POST /api/wms/labels.
 *
 * Identical to what POST /api/shipments/bulk takes for one order, and that is
 * the point: both endpoints create a shipment from an order, and when the shape
 * lived in two files they were free to drift — one of them accepting a
 * recipient address from the caller while the other read it off the order.
 *
 * What this endpoint adds on top is the WmsShippingLabel row and the WMS audit
 * entry, not a different contract. See `CreateShipmentForOrderDto` for why
 * there is no address field and why `parcels` has no default.
 */
export class CreateWmsLabelDto extends CreateShipmentForOrderDto {}

/**
 * One packing round: several orders, each with its own measured boxes.
 *
 * Delegates to the same body as POST /api/shipments/bulk; the difference is the
 * label row per order, which only the WMS side needs.
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
