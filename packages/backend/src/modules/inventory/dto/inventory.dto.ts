import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export enum AdjustmentType {
  INBOUND = 'Inbound',
  OUTBOUND = 'Outbound',
  TRANSFER = 'Transfer',
  DAMAGE = 'Damage',
  LOST = 'Lost',
  COUNT = 'Cycle Count',
}

export class AdjustInventoryDto {
  @ApiProperty({ example: 'cuid-product-id', description: 'Product ID' })
  @IsString()
  productId: string;

  @ApiProperty({ enum: AdjustmentType, example: 'Inbound' })
  @IsEnum(AdjustmentType)
  type: AdjustmentType;

  @ApiProperty({ example: 10, description: 'Quantity to adjust' })
  @IsNumber()
  @Type(() => Number)
  quantity: number;

  @ApiPropertyOptional({ example: 'PO #29810 received', description: 'Reason for adjustment' })
  @IsString()
  @IsOptional()
  reason?: string;
}

export class InventoryResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  productId: string;

  @ApiProperty()
  availableQty: number;

  @ApiProperty()
  reservedQty: number;

  @ApiProperty()
  defectiveQty: number;

  @ApiProperty()
  reorderLevel: number;
}
