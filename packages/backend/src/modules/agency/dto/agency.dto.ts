import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateAgencyDto {
  @ApiProperty({ example: 'My Global Commerce Agency', description: 'Name of the agency' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'my-global-commerce-agency', description: 'Unique slug. Generated automatically if omitted.' })
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiPropertyOptional({ example: 'An enterprise ecommerce management agency', description: 'Description of the agency' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'https://example.com/logo.png', description: 'URL link to the agency logo' })
  @IsString()
  @IsOptional()
  logo?: string;

  @ApiPropertyOptional({ example: 'https://example.com', description: 'Official website URL' })
  @IsString()
  @IsOptional()
  website?: string;
}

export class UpdateAgencyDto {
  @ApiPropertyOptional({ example: 'New Name Inc', description: 'Updated name of the agency' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'new-name-inc', description: 'Updated unique slug' })
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiPropertyOptional({ example: 'Updated description details', description: 'Updated description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'https://example.com/new-logo.png', description: 'Updated logo URL' })
  @IsString()
  @IsOptional()
  logo?: string;

  @ApiPropertyOptional({ example: 'https://new-website.com', description: 'Updated website URL' })
  @IsString()
  @IsOptional()
  website?: string;

  @ApiPropertyOptional({ example: true, description: 'Toggle agency status active/inactive' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class AgencyResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  logo?: string;

  @ApiPropertyOptional()
  website?: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
