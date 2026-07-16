import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderItemDto {
  @ApiProperty({ example: 'cuid-product-id', description: 'ID of the product' })
  @IsString()
  productId: string;

  @ApiProperty({ example: 2, description: 'Quantity purchased' })
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  quantity: number;
}

export class CreateOrderDto {
  @ApiPropertyOptional({ example: 'cuid-channel-id', description: 'Optional sales channel context' })
  @IsString()
  @IsOptional()
  channelId?: string;

  @ApiPropertyOptional({ example: 'cuid-customer-id', description: 'Optional customer ID link' })
  @IsString()
  @IsOptional()
  customerId?: string;

  @ApiProperty({ example: 'John Doe', description: 'Name of the customer' })
  @IsString()
  customerName: string;

  @ApiPropertyOptional({ example: 'johndoe@example.com', description: 'Email address of the customer' })
  @IsString()
  @IsOptional()
  customerEmail?: string;

  @ApiPropertyOptional({ example: '+1234567890', description: 'Phone number of the customer' })
  @IsString()
  @IsOptional()
  customerPhone?: string;

  @ApiPropertyOptional({ example: '123 Main St, New York, NY', description: 'Shipping address for order delivery' })
  @IsString()
  @IsOptional()
  shippingAddress?: string;

  @ApiPropertyOptional({ example: 'USD', description: 'Currency code (default USD)' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ example: 'shopify', description: 'Order origin source (default manual)' })
  @IsString()
  @IsOptional()
  source?: string;

  @ApiPropertyOptional({ example: 'Please leave at the door', description: 'Order delivery notes' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ type: [CreateOrderItemDto], description: 'Items in the order' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}

export class UpdateOrderStatusDto {
  @ApiPropertyOptional({ example: 'processing', description: 'Updated order workflow status' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ example: 'paid', description: 'Updated payment status' })
  @IsString()
  @IsOptional()
  paymentStatus?: string;

  @ApiPropertyOptional({ example: 'fulfilled', description: 'Updated fulfillment status' })
  @IsString()
  @IsOptional()
  fulfillmentStatus?: string;

  @ApiPropertyOptional({ example: 'Transitioning order state', description: 'Internal action details note' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class OrderItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  productId: string;

  @ApiProperty()
  sku: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  unitPrice: number;

  @ApiProperty()
  totalPrice: number;
}

export class OrderTimelineResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  eventType: string;

  @ApiPropertyOptional()
  oldValue?: string;

  @ApiPropertyOptional()
  newValue?: string;

  @ApiPropertyOptional()
  userId?: string;

  @ApiProperty()
  createdAt: Date;
}

export class OrderResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  agencyId: string;

  @ApiPropertyOptional()
  clientId?: string;

  @ApiProperty()
  storeId: string;

  @ApiPropertyOptional()
  channelId?: string;

  @ApiProperty()
  orderNumber: string;

  @ApiPropertyOptional()
  customerId?: string;

  @ApiProperty()
  customerName: string;

  @ApiPropertyOptional()
  customerEmail?: string;

  @ApiPropertyOptional()
  customerPhone?: string;

  @ApiPropertyOptional()
  shippingAddress?: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  paymentStatus: string;

  @ApiProperty()
  fulfillmentStatus: string;

  @ApiProperty()
  source: string;

  @ApiProperty()
  totalAmount: number;

  @ApiProperty()
  currency: string;

  @ApiPropertyOptional()
  idempotencyKey?: string;

  @ApiPropertyOptional()
  notes?: string;

  @ApiProperty()
  createdBy: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: [OrderItemResponseDto] })
  items: OrderItemResponseDto[];

  @ApiProperty({ type: [OrderTimelineResponseDto] })
  timeline: OrderTimelineResponseDto[];
}
