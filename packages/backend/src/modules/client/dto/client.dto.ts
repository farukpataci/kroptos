import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateClientDto {
  @ApiProperty({ example: 'cuid-agency-id', description: 'Agency ID the client belongs to' })
  @IsString()
  agencyId: string;

  @ApiProperty({ example: 'Acme Corp', description: 'Firma / Müşteri Adı' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Acme International Corporation LLC', description: 'Firma Resmi Ünvanı' })
  @IsString()
  @IsOptional()
  legalName?: string;

  @ApiPropertyOptional({ example: '1234567890', description: 'Vergi Numarası' })
  @IsString()
  @IsOptional()
  taxNumber?: string;

  @ApiPropertyOptional({ example: 'Kadikoy Vergi Dairesi', description: 'Vergi Dairesi' })
  @IsString()
  @IsOptional()
  taxOffice?: string;

  @ApiProperty({ example: 'finance@acme.com', description: 'Contact email' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: '+905551234567', description: 'Contact phone' })
  @IsString()
  @IsOptional()
  phone?: string;
}

export class UpdateClientDto {
  @ApiPropertyOptional({ example: 'Acme Corp Updated', description: 'Updated Client Name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'Acme LLC', description: 'Updated Legal Name' })
  @IsString()
  @IsOptional()
  legalName?: string;

  @ApiPropertyOptional({ example: '0987654321', description: 'Updated Tax Number' })
  @IsString()
  @IsOptional()
  taxNumber?: string;

  @ApiPropertyOptional({ example: 'Besiktas Vergi Dairesi', description: 'Updated Tax Office' })
  @IsString()
  @IsOptional()
  taxOffice?: string;

  @ApiPropertyOptional({ example: 'info@acme.com', description: 'Updated Contact email' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: '+905559876543', description: 'Updated Contact phone' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: true, description: 'Toggle client status active/inactive' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 'active', description: 'Client status string' })
  @IsString()
  @IsOptional()
  status?: string;
}

export class ClientResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  agencyId: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  legalName?: string;

  @ApiPropertyOptional()
  taxNumber?: string;

  @ApiPropertyOptional()
  taxOffice?: string;

  @ApiProperty()
  email: string;

  @ApiPropertyOptional()
  phone?: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  status: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
