import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsBoolean, IsEnum, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @ApiPropertyOptional({ example: 'cuid-category-id', description: 'Optional category ID' })
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiProperty({ example: 'LAPTOP-001', description: 'Unique SKU for the product' })
  @IsString()
  sku: string;

  @ApiProperty({ example: 'High-end Laptop', description: 'Name of the product' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'A very powerful laptop', description: 'Product description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 999.99, description: 'Selling price of the product' })
  @IsNumber()
  @Type(() => Number)
  price: number;

  @ApiPropertyOptional({ example: 800.00, description: 'Base/MSRP price of the product' })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  basePrice?: number;

  @ApiPropertyOptional({ example: 600.00, description: 'Cost price of the product' })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  costPrice?: number;

  @ApiPropertyOptional({ example: '1234567890123', description: 'Barcode' })
  @IsString()
  @IsOptional()
  barcode?: string;

  @ApiPropertyOptional({ example: 'USD', description: 'Currency' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ example: 100, description: 'Stock quantity' })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  stockQuantity?: number;

  @ApiPropertyOptional({ example: 'active', description: 'Status (active, draft, suspended)' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ example: true, description: 'Whether this product is a bundle' })
  @IsBoolean()
  @IsOptional()
  isBundle?: boolean;

  @ApiPropertyOptional({ example: 1.5, description: 'Weight in kg' })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  weight?: number;

  @ApiPropertyOptional({ example: 35.5, description: 'Width in cm' })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  width?: number;

  @ApiPropertyOptional({ example: 25.0, description: 'Height in cm' })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  height?: number;

  @ApiPropertyOptional({ example: 2.0, description: 'Depth in cm' })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  depth?: number;

  @ApiPropertyOptional({ example: 'https://example.com/image.jpg', description: 'Product image URL' })
  @IsString()
  @IsOptional()
  image?: string;

  @ApiPropertyOptional({ example: '120.01.001', description: 'ERP Accounting item code mapping' })
  @IsString()
  @IsOptional()
  erpCode?: string;

  @ApiPropertyOptional({ example: 'erp-item-guid', description: 'ERP internal identifier mapping' })
  @IsString()
  @IsOptional()
  erpId?: string;

  @ApiPropertyOptional({ example: 20, description: 'VAT/KDV Rate percentage (e.g. 20, 10, 1, 0)' })
  @IsNumber()
  @IsOptional()
  taxRate?: number;

  @ApiPropertyOptional({ enum: ['SIMPLE', 'BUNDLE', 'VARIANT_PARENT', 'VARIANT_CHILD'], default: 'SIMPLE' })
  @IsOptional()
  type?: 'SIMPLE' | 'BUNDLE' | 'VARIANT_PARENT' | 'VARIANT_CHILD';

  @ApiPropertyOptional({ description: 'JSON variant attributes, e.g. { Beden: "M", Renk: "Siyah" }' })
  @IsOptional()
  variantAttributes?: any;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  parentId?: string;

  @ApiPropertyOptional({ type: () => [CreateBundleItemDto] })
  @IsOptional()
  bundleItems?: CreateBundleItemDto[];

  @ApiPropertyOptional({ type: () => [CreateCrossSellProductDto] })
  @IsOptional()
  crossSellProducts?: CreateCrossSellProductDto[];

  @ApiPropertyOptional({ type: () => [CreateVariantChildDto] })
  @IsOptional()
  variants?: CreateVariantChildDto[];

  @ApiPropertyOptional({ example: 'loc-cuid-id', description: 'Warehouse location ID' })
  @IsString()
  @IsOptional()
  locationId?: string;

  @ApiPropertyOptional({ example: 'A01-R01-G01', description: 'Warehouse location code' })
  @IsString()
  @IsOptional()
  locationCode?: string;
}

export class CreateVariantChildDto {
  @ApiProperty()
  @IsString()
  sku: string;

  @ApiProperty()
  @IsNumber()
  price: number;

  @ApiProperty()
  @IsNumber()
  stockQuantity: number;

  @ApiProperty()
  variantAttributes: any;
}

export class CreateBundleItemDto {
  @ApiProperty()
  @IsString()
  childProductId: string;

  @ApiProperty()
  @IsNumber()
  quantity: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  discountRate?: number;
}

export class CreateCrossSellProductDto {
  @ApiProperty()
  @IsString()
  targetProductId: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  displayOrder?: number;
}

export class UpdateProductDto {
  @ApiPropertyOptional({ example: 'cuid-category-id', description: 'Updated category ID' })
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ example: 'LAPTOP-001', description: 'Updated SKU' })
  @IsString()
  @IsOptional()
  sku?: string;

  @ApiPropertyOptional({ example: 'Updated Laptop Name', description: 'Updated product name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'Updated product description', description: 'Updated description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 1049.99, description: 'Updated price' })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  price?: number;

  @ApiPropertyOptional({ example: 850.00, description: 'Updated base price' })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  basePrice?: number;

  @ApiPropertyOptional({ example: 620.00, description: 'Updated cost price' })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  costPrice?: number;

  @ApiPropertyOptional({ example: '1234567890123', description: 'Updated barcode' })
  @IsString()
  @IsOptional()
  barcode?: string;

  @ApiPropertyOptional({ example: 'USD', description: 'Updated currency' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ example: 120, description: 'Updated stock quantity' })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  stockQuantity?: number;

  @ApiPropertyOptional({ example: 'active', description: 'Updated status' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ example: true, description: 'Whether this product is a bundle' })
  @IsBoolean()
  @IsOptional()
  isBundle?: boolean;

  @ApiPropertyOptional({ example: 1.6, description: 'Updated weight' })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  weight?: number;

  @ApiPropertyOptional({ example: 36.0, description: 'Updated width' })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  width?: number;

  @ApiPropertyOptional({ example: 26.0, description: 'Updated height' })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  height?: number;

  @ApiPropertyOptional({ example: 2.5, description: 'Updated depth' })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  depth?: number;

  @ApiPropertyOptional({ example: 'https://example.com/updated-image.jpg', description: 'Updated image URL' })
  @IsString()
  @IsOptional()
  image?: string;

  @ApiPropertyOptional({ example: true, description: 'Toggle visibility' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ example: '120.01.001', description: 'ERP Accounting item code mapping' })
  @IsString()
  @IsOptional()
  erpCode?: string;

  @ApiPropertyOptional({ example: 'erp-item-guid', description: 'ERP internal identifier mapping' })
  @IsString()
  @IsOptional()
  erpId?: string;

  @ApiPropertyOptional({ example: 20, description: 'VAT/KDV Rate percentage (e.g. 20, 10, 1, 0)' })
  @IsNumber()
  @IsOptional()
  taxRate?: number;

  @ApiPropertyOptional({ enum: ['SIMPLE', 'BUNDLE', 'VARIANT_PARENT', 'VARIANT_CHILD'] })
  @IsOptional()
  type?: 'SIMPLE' | 'BUNDLE' | 'VARIANT_PARENT' | 'VARIANT_CHILD';

  @ApiPropertyOptional()
  @IsOptional()
  variantAttributes?: any;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  parentId?: string;

  @ApiPropertyOptional({ type: () => [CreateBundleItemDto] })
  @IsOptional()
  bundleItems?: CreateBundleItemDto[];

  @ApiPropertyOptional({ type: () => [CreateCrossSellProductDto] })
  @IsOptional()
  crossSellProducts?: CreateCrossSellProductDto[];

  @ApiPropertyOptional({ type: () => [CreateVariantChildDto] })
  @IsOptional()
  variants?: CreateVariantChildDto[];

  @ApiPropertyOptional({ example: 'loc-cuid-id', description: 'Warehouse location ID' })
  @IsString()
  @IsOptional()
  locationId?: string;

  @ApiPropertyOptional({ example: 'A01-R01-G01', description: 'Warehouse location code' })
  @IsString()
  @IsOptional()
  locationCode?: string;
}

export class ProductResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  agencyId: string;

  @ApiProperty()
  clientId: string;

  @ApiProperty()
  storeId: string;

  @ApiPropertyOptional()
  categoryId?: string;

  @ApiProperty()
  sku: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  price: number;

  @ApiProperty()
  basePrice: number;

  @ApiPropertyOptional()
  costPrice?: number;

  @ApiPropertyOptional()
  barcode?: string;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  stockQuantity: number;

  @ApiProperty()
  status: string;

  @ApiPropertyOptional()
  weight?: number;

  @ApiPropertyOptional()
  width?: number;

  @ApiPropertyOptional()
  height?: number;

  @ApiPropertyOptional()
  depth?: number;

  @ApiPropertyOptional()
  image?: string;

  @ApiProperty()
  isActive: boolean;

  @ApiPropertyOptional()
  erpCode?: string;

  @ApiPropertyOptional()
  erpId?: string;

  @ApiPropertyOptional()
  taxRate?: number;

  @ApiProperty()
  type: string;

  @ApiPropertyOptional()
  variantAttributes?: any;

  @ApiPropertyOptional()
  parentId?: string;

  @ApiPropertyOptional()
  bundleItems?: any[];

  @ApiPropertyOptional()
  crossSellProducts?: any[];

  @ApiPropertyOptional()
  locationId?: string;

  @ApiPropertyOptional()
  locationCode?: string;

  @ApiPropertyOptional()
  locationBarcode?: string;

  @ApiPropertyOptional()
  warehouseName?: string;

  @ApiPropertyOptional()
  zoneName?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class BulkActionDto {
  @ApiProperty({ example: ['cuid1', 'cuid2'], description: 'List of product IDs' })
  @IsArray()
  productIds: string[];

  @ApiProperty({ example: 'update_status', description: 'Action: update_status, update_location, delete' })
  @IsString()
  action: 'update_status' | 'update_location' | 'delete';

  @ApiPropertyOptional({ description: 'Extra data for action e.g. { status: "active", locationCode: "A01-R01-G01" }' })
  @IsOptional()
  data?: any;
}
