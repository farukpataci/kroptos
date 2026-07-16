import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateStoreDto {
  @ApiProperty({ example: 'cuid-agency-id', description: 'Agency ID the store belongs to' })
  @IsString()
  agencyId: string;

  @ApiPropertyOptional({ example: 'cuid-client-id', description: 'Optional Client ID the store belongs to' })
  @IsString()
  @IsOptional()
  clientId?: string;

  @ApiProperty({ example: 'My Retail Store', description: 'Name of the store' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'my-retail-store', description: 'Unique slug' })
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiPropertyOptional({ example: 'www.my-retail-store.com', description: 'Store web domain' })
  @IsString()
  @IsOptional()
  domain?: string;

  @ApiPropertyOptional({ example: 'active', description: 'Store status: draft, active, suspended' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ example: 'USD', description: 'Store primary currency code' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ example: 'en-US', description: 'Store locale identifier' })
  @IsString()
  @IsOptional()
  locale?: string;

  @ApiPropertyOptional({ example: 'UTC', description: 'Store default timezone' })
  @IsString()
  @IsOptional()
  timezone?: string;

  @ApiPropertyOptional({ example: 'retail', description: 'Store type: retail, warehouse, pop' })
  @IsString()
  @IsOptional()
  type?: string;
}

export class UpdateStoreDto {
  @ApiPropertyOptional({ example: 'My Online Shop', description: 'Updated name of the store' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'my-online-shop', description: 'Updated unique slug' })
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiPropertyOptional({ example: 'shop.my-retail-store.com', description: 'Updated web domain' })
  @IsString()
  @IsOptional()
  domain?: string;

  @ApiPropertyOptional({ example: 'suspended', description: 'Updated status: draft, active, suspended' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ example: 'EUR', description: 'Updated primary currency code' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ example: 'de-DE', description: 'Updated locale identifier' })
  @IsString()
  @IsOptional()
  locale?: string;

  @ApiPropertyOptional({ example: 'Europe/Berlin', description: 'Updated default timezone' })
  @IsString()
  @IsOptional()
  timezone?: string;

  @ApiPropertyOptional({ example: 'warehouse', description: 'Updated type: retail, warehouse, pop' })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({ example: true, description: 'Toggle store active status' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class StoreResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  agencyId: string;

  @ApiPropertyOptional()
  clientId?: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiPropertyOptional()
  domain?: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  locale: string;

  @ApiProperty()
  timezone: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
