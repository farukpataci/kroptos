import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAccountingIntegrationDto {
  @ApiProperty({ example: 'cuid-agency-id', description: 'Agency ID context' })
  @IsString()
  agencyId: string;

  @ApiPropertyOptional({ example: 'cuid-client-id' })
  @IsString()
  @IsOptional()
  clientId?: string;

  @ApiPropertyOptional({ example: 'cuid-store-id' })
  @IsString()
  @IsOptional()
  storeId?: string;

  @ApiProperty({ example: 'PARASUT', description: 'Accounting provider identifier' })
  @IsString()
  provider: string;

  @ApiProperty({ example: 'Ana Paraşüt Hesabı', description: 'Friendly name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'MOCK', enum: ['MOCK', 'TEST', 'PRODUCTION'] })
  @IsString()
  @IsIn(['MOCK', 'TEST', 'PRODUCTION'])
  @IsOptional()
  environment?: 'MOCK' | 'TEST' | 'PRODUCTION';

  @ApiProperty({ example: { clientId: '...', clientSecret: '...' } })
  @IsObject()
  credentials: Record<string, any>;
}

export class UpdateAccountingIntegrationDto {
  @ApiPropertyOptional({ example: 'Yeni Paraşüt Başlığı' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'connected', enum: ['connected', 'disconnected', 'error'] })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ example: 'MOCK', enum: ['MOCK', 'TEST', 'PRODUCTION'] })
  @IsString()
  @IsIn(['MOCK', 'TEST', 'PRODUCTION'])
  @IsOptional()
  environment?: 'MOCK' | 'TEST' | 'PRODUCTION';

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  credentials?: Record<string, any>;
}

export class CreateAccountingCompanyDto {
  @ApiProperty({ description: 'Integration ID to bind company' })
  @IsString()
  integrationId: string;

  @ApiProperty({ example: '123456', description: 'External company ID in accounting system' })
  @IsString()
  externalCompanyId: string;

  @ApiPropertyOptional({ example: 'KroptOS Ticaret A.Ş.' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'TRY', default: 'TRY' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @ApiPropertyOptional({ example: 'KRP' })
  @IsString()
  @IsOptional()
  invoiceSeries?: string;

  @ApiPropertyOptional({ example: 'retail-contact-123', description: 'B2C fallback perakende cari ID' })
  @IsString()
  @IsOptional()
  defaultRetailContactId?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  defaultAccountCodes?: Record<string, any>;
}

export class UpdateAccountingCompanyDto {
  @ApiPropertyOptional({ example: 'KroptOS Ticaret A.Ş.' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'TRY' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @ApiPropertyOptional({ example: 'KRP' })
  @IsString()
  @IsOptional()
  invoiceSeries?: string;

  @ApiPropertyOptional({ example: 'retail-contact-123', description: 'B2C fallback perakende cari ID' })
  @IsString()
  @IsOptional()
  defaultRetailContactId?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  defaultAccountCodes?: Record<string, any>;
}

export class AccountingInvoiceItemDto {
  @ApiProperty({ example: 'SKU-100' })
  @IsString()
  sku: string;

  @ApiProperty({ example: 'Kablosuz Kulaklık' })
  @IsString()
  name: string;

  @ApiProperty({ example: 2 })
  @IsNumber()
  quantity: number;

  @ApiProperty({ example: 150.0 })
  @IsNumber()
  unitPrice: number;

  @ApiProperty({ example: 20 })
  @IsNumber()
  vatRate: number;

  @ApiPropertyOptional({ example: 60.0 })
  @IsNumber()
  @IsOptional()
  vatAmount?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsNumber()
  @IsOptional()
  discountAmount?: number;

  @ApiProperty({ example: 360.0 })
  @IsNumber()
  totalAmount: number;
}

export class AccountingContactDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  id?: string;

  @ApiProperty({ example: 'Ahmet Yılmaz' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: '12345678901' })
  @IsString()
  @IsOptional()
  taxNumber?: string;

  @ApiPropertyOptional({ example: 'Kadıköy' })
  @IsString()
  @IsOptional()
  taxOffice?: string;

  @ApiPropertyOptional({ example: 'ahmet@example.com' })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: '+905551234567' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'Bağdat Cad. No: 1' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ example: 'İstanbul' })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({ example: 'Kadıköy' })
  @IsString()
  @IsOptional()
  district?: string;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  isCompany?: boolean;
}

export class CreateAccountingInvoiceDocumentDto {
  @ApiProperty({ description: 'Integration ID' })
  @IsString()
  integrationId: string;

  @ApiProperty({ description: 'Accounting Company ID' })
  @IsString()
  companyId: string;

  @ApiProperty({ description: 'Store ID context' })
  @IsString()
  storeId: string;

  @ApiPropertyOptional({ description: 'Client ID context' })
  @IsString()
  @IsOptional()
  clientId?: string;

  @ApiProperty({ example: 'ORD-2026-9999', description: 'Order or reference code' })
  @IsString()
  referenceCode: string;

  @ApiProperty({ example: '2026-09-08' })
  @IsString()
  issueDate: string;

  @ApiPropertyOptional({ example: '2026-09-15' })
  @IsString()
  @IsOptional()
  dueDate?: string;

  @ApiProperty({ example: 'TRY' })
  @IsString()
  currency: string;

  @ApiProperty({ type: AccountingContactDto })
  @ValidateNested()
  @Type(() => AccountingContactDto)
  contact: AccountingContactDto;

  @ApiProperty({ type: [AccountingInvoiceItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AccountingInvoiceItemDto)
  items: AccountingInvoiceItemDto[];

  @ApiProperty({ example: 300.0 })
  @IsNumber()
  subtotal: number;

  @ApiProperty({ example: 60.0 })
  @IsNumber()
  vatTotal: number;

  @ApiPropertyOptional({ example: 0 })
  @IsNumber()
  @IsOptional()
  discountTotal?: number;

  @ApiProperty({ example: 360.0 })
  @IsNumber()
  grandTotal: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateAccountingPaymentDocumentDto {
  @ApiProperty({ description: 'Integration ID' })
  @IsString()
  integrationId: string;

  @ApiProperty({ description: 'Accounting Company ID' })
  @IsString()
  companyId: string;

  @ApiProperty({ description: 'Store ID context' })
  @IsString()
  storeId: string;

  @ApiPropertyOptional({ description: 'Client ID context' })
  @IsString()
  @IsOptional()
  clientId?: string;

  @ApiProperty({ description: 'External Invoice ID in accounting system' })
  @IsString()
  invoiceExternalId: string;

  @ApiProperty({ example: 'PAY-ORD-2026-9999' })
  @IsString()
  referenceCode: string;

  @ApiProperty({ example: 360.0 })
  @IsNumber()
  amount: number;

  @ApiProperty({ example: 'TRY' })
  @IsString()
  currency: string;

  @ApiProperty({ example: '2026-09-08' })
  @IsString()
  paymentDate: string;

  @ApiPropertyOptional({ example: 'credit_card' })
  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class AccountingQueryDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  page?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  limit?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  provider?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  companyId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  storeId?: string;
}
