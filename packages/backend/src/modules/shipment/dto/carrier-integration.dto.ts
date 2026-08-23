import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CARRIER_PROVIDERS } from '../../../integrations/carriers/core/CarrierTypes';

export class CarrierAddressDto {
  @ApiProperty({ example: 'Kroptos Depo' })
  @IsString()
  @MaxLength(120)
  fullName: string;

  @ApiProperty({ example: '+905551112233' })
  @IsString()
  @MaxLength(32)
  phone: string;

  @ApiPropertyOptional({ example: 'depo@example.com' })
  @IsString()
  @IsOptional()
  @MaxLength(180)
  email?: string;

  @ApiProperty({ example: 'Atatürk Mah. 123. Sk. No:4' })
  @IsString()
  @MaxLength(255)
  line1: string;

  @ApiPropertyOptional({ example: 'Kat 2 Daire 5' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  line2?: string;

  @ApiProperty({ example: 'Kadıköy', description: 'İlçe' })
  @IsString()
  @MaxLength(80)
  district: string;

  @ApiProperty({ example: 'İstanbul', description: 'İl' })
  @IsString()
  @MaxLength(80)
  city: string;

  @ApiPropertyOptional({ example: '34710' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  postalCode?: string;

  @ApiProperty({ example: 'TR', description: 'ISO-3166-1 alpha-2' })
  @IsString()
  @Length(2, 2)
  countryCode: string;

  @ApiPropertyOptional({ example: '1234567890' })
  @IsString()
  @IsOptional()
  @MaxLength(32)
  taxId?: string;
}

export class CreateCarrierIntegrationDto {
  @ApiProperty({ enum: CARRIER_PROVIDERS, example: 'MOCK' })
  @IsIn(CARRIER_PROVIDERS as readonly string[])
  provider: string;

  @ApiProperty({ example: 'Örnek Kargo - İstanbul Deposu' })
  @IsString()
  @MaxLength(120)
  displayName: string;

  @ApiProperty({
    example: { customerCode: 'ABC123', password: 'secret' },
    description: 'Encrypted at rest; masked in every response.',
  })
  @IsObject()
  credentials: Record<string, any>;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ default: true, description: 'Test environment of the carrier' })
  @IsBoolean()
  @IsOptional()
  isTestMode?: boolean;

  @ApiPropertyOptional({ type: CarrierAddressDto })
  @ValidateNested()
  @Type(() => CarrierAddressDto)
  @IsOptional()
  senderAddress?: CarrierAddressDto;

  @ApiPropertyOptional({ example: { labelFormat: 'PDF', desiDivisor: 3000 } })
  @IsObject()
  @IsOptional()
  settings?: Record<string, any>;
}

/**
 * Provider is deliberately absent: changing it would keep credentials that
 * belong to a different carrier and leave existing shipments pointing at a
 * connector that never created them.
 */
export class UpdateCarrierIntegrationDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(120)
  displayName?: string;

  @ApiPropertyOptional({ description: 'Blank/masked secrets keep the stored value.' })
  @IsObject()
  @IsOptional()
  credentials?: Record<string, any>;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isTestMode?: boolean;

  @ApiPropertyOptional({ type: CarrierAddressDto })
  @ValidateNested()
  @Type(() => CarrierAddressDto)
  @IsOptional()
  senderAddress?: CarrierAddressDto;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  settings?: Record<string, any>;
}

export class CarrierIntegrationResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() publicId: string;
  @ApiProperty() provider: string;
  @ApiProperty() displayName: string;
  @ApiProperty() isActive: boolean;
  @ApiProperty() isTestMode: boolean;
  @ApiProperty({ description: 'Masked — secrets never leave the server.' })
  credentials: Record<string, any>;
  @ApiPropertyOptional() senderAddress?: Record<string, any>;
  @ApiPropertyOptional() settings?: Record<string, any>;
  @ApiPropertyOptional() lastTestedAt?: Date;
  @ApiPropertyOptional() lastTestOk?: boolean;
  @ApiProperty() createdAt: Date;
}

export class ConnectionTestResponseDto {
  @ApiProperty() success: boolean;
  @ApiProperty() message: string;
  @ApiProperty() durationMs: number;
}
