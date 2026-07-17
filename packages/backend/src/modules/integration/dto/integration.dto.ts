import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject, IsIn } from 'class-validator';

export class CreateIntegrationDto {
  @ApiProperty({ example: 'cuid-agency-id', description: 'Agency ID context' })
  @IsString()
  agencyId: string;

  @ApiPropertyOptional({ example: 'cuid-client-id', description: 'Optional Client ID context' })
  @IsString()
  @IsOptional()
  clientId?: string;

  @ApiPropertyOptional({ example: 'cuid-store-id', description: 'Optional Store ID context' })
  @IsString()
  @IsOptional()
  storeId?: string;

  @ApiProperty({ example: 'trendyol', description: 'Integration provider name' })
  @IsString()
  provider: string;

  @ApiProperty({ example: 'marketplace', description: 'Type of provider: marketplace, erp, cargo, payment' })
  @IsString()
  @IsIn(['marketplace', 'erp', 'cargo', 'payment'])
  providerType: string;

  @ApiProperty({ example: 'Trendyol Store Connection', description: 'Friendly name of integration' })
  @IsString()
  name: string;

  @ApiProperty({ example: { apiKey: 'secret-key', apiSecret: 'secret-val' }, description: 'Credentials object containing credentials to encrypt' })
  @IsObject()
  credentials: Record<string, any>;
}

export class UpdateIntegrationDto {
  @ApiPropertyOptional({ example: 'Updated Integration Name', description: 'Updated friendly name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'active', description: 'Updated status (active, inactive, error)' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ example: { apiKey: 'new-key' }, description: 'Updated credentials dictionary to encrypt' })
  @IsObject()
  @IsOptional()
  credentials?: Record<string, any>;
}

export class IntegrationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  agencyId: string;

  @ApiPropertyOptional()
  clientId?: string;

  @ApiPropertyOptional()
  storeId?: string;

  @ApiProperty()
  provider: string;

  @ApiProperty()
  providerType: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  status: string;

  @ApiPropertyOptional()
  lastSyncAt?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class UpsertProductMappingDto {
  @ApiProperty({ example: 'cuid-integration-id', description: 'Integration ID' })
  @IsString()
  integrationId: string;

  @ApiProperty({ example: '387', description: 'Marketplace Category ID' })
  @IsString()
  marketplaceCategoryId: string;

  @ApiProperty({ example: 'Tişört', description: 'Marketplace Category Name' })
  @IsString()
  marketplaceCategoryName: string;

  @ApiProperty({ example: { "338": "M" }, description: 'Attribute Mappings JSON values' })
  @IsObject()
  @IsOptional()
  attributesMapping?: Record<string, any>;
}
