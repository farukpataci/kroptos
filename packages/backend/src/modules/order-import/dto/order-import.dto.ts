import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsObject,
  IsArray,
  IsNumber,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type ImportMode = 'CREATE_ONLY' | 'UPDATE_ONLY' | 'UPSERT';
export type MatchKey = 'orderNumber' | 'marketplaceOrderNumber' | 'publicId';

export class SaveMappingDto {
  @ApiPropertyOptional({ enum: ['CREATE_ONLY', 'UPDATE_ONLY', 'UPSERT'] })
  @IsOptional()
  @IsString()
  mode?: ImportMode;

  @ApiPropertyOptional({ enum: ['orderNumber', 'marketplaceOrderNumber', 'publicId'] })
  @IsOptional()
  @IsString()
  matchKey?: MatchKey;

  @ApiProperty({ description: 'Map of file column header to canonical system field key' })
  @IsObject()
  columnMap!: Record<string, string>;

  @ApiPropertyOptional({ description: 'Additional options (decimal separator, timezone, etc.)' })
  @IsOptional()
  @IsObject()
  options?: Record<string, any>;
}

export class SaveValueMapsDto {
  @ApiProperty({ description: 'Nested map of fieldName -> { fileValue: systemValue }' })
  @IsObject()
  valueMaps!: Record<string, Record<string, string>>;

  @ApiPropertyOptional({ description: 'Allow unmapped products as non-catalog items' })
  @IsOptional()
  @IsBoolean()
  allowNonCatalogProducts?: boolean;
}

export class StartImportDto {
  @ApiPropertyOptional({ description: 'All-or-nothing mode: if any row fails, abort all' })
  @IsOptional()
  @IsBoolean()
  allOrNothing?: boolean;

  @ApiPropertyOptional({ description: 'Suppress stock movements (default: true)' })
  @IsOptional()
  @IsBoolean()
  suppressStock?: boolean;

  @ApiPropertyOptional({ description: 'Suppress customer notification emails (default: true)' })
  @IsOptional()
  @IsBoolean()
  suppressNotifications?: boolean;

  @ApiPropertyOptional({ description: 'Suppress order automation rules (default: true)' })
  @IsOptional()
  @IsBoolean()
  suppressAutomation?: boolean;

  @ApiPropertyOptional({ description: 'Suppress marketplace sync (default: true)' })
  @IsOptional()
  @IsBoolean()
  suppressMarketplace?: boolean;
}

export class CreateMappingTemplateDto {
  @ApiProperty({ description: 'Template name' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: 'Template description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isShared?: boolean;

  @ApiProperty({ enum: ['CREATE_ONLY', 'UPDATE_ONLY', 'UPSERT'] })
  @IsString()
  mode!: ImportMode;

  @ApiProperty({ enum: ['orderNumber', 'marketplaceOrderNumber', 'publicId'] })
  @IsString()
  matchKey!: MatchKey;

  @ApiProperty()
  @IsObject()
  columnMap!: Record<string, string>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  valueMaps?: Record<string, Record<string, string>>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  defaults?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  fileHints?: Record<string, any>;
}

export class UpdateMappingTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isShared?: boolean;

  @ApiPropertyOptional({ enum: ['CREATE_ONLY', 'UPDATE_ONLY', 'UPSERT'] })
  @IsOptional()
  @IsString()
  mode?: ImportMode;

  @ApiPropertyOptional({ enum: ['orderNumber', 'marketplaceOrderNumber', 'publicId'] })
  @IsOptional()
  @IsString()
  matchKey?: MatchKey;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  columnMap?: Record<string, string>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  valueMaps?: Record<string, Record<string, string>>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  defaults?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  fileHints?: Record<string, any>;
}
