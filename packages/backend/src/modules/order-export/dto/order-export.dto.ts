import { IsString, IsOptional, IsArray, IsBoolean, IsIn, IsObject, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OrderExportFiltersDto {
  @ApiPropertyOptional({ description: 'Filter date field: createdAt, updatedAt, paymentDate, shippedAt, deliveredAt' })
  @IsOptional()
  @IsString()
  dateField?: string;

  @ApiPropertyOptional({ description: 'ISO start date' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'ISO end date' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Order statuses' })
  @IsOptional()
  @IsArray()
  statuses?: string[];

  @ApiPropertyOptional({ description: 'Payment statuses' })
  @IsOptional()
  @IsArray()
  paymentStatuses?: string[];

  @ApiPropertyOptional({ description: 'Fulfillment statuses' })
  @IsOptional()
  @IsArray()
  fulfillmentStatuses?: string[];

  @ApiPropertyOptional({ description: 'Sales source / marketplace' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ description: 'Store ID' })
  @IsOptional()
  @IsString()
  storeId?: string;

  @ApiPropertyOptional({ description: 'Client ID' })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({ description: 'List of order numbers or search string' })
  @IsOptional()
  @IsArray()
  orderNumbers?: string[];

  @ApiPropertyOptional({ description: 'Free text search (order no, customer name)' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class CreateExportJobDto {
  @ApiPropertyOptional({ description: 'Preset ID if based on a saved preset' })
  @IsOptional()
  @IsString()
  presetId?: string;

  @ApiProperty({ description: 'Row mode: ORDER or LINE_ITEM', enum: ['ORDER', 'LINE_ITEM'] })
  @IsIn(['ORDER', 'LINE_ITEM'])
  rowMode!: 'ORDER' | 'LINE_ITEM';

  @ApiProperty({ description: 'Format: CSV or XLSX', enum: ['CSV', 'XLSX'] })
  @IsIn(['CSV', 'XLSX'])
  format!: 'CSV' | 'XLSX';

  @ApiProperty({ description: 'Ordered array of column keys to export' })
  @IsArray()
  columns!: string[];

  @ApiPropertyOptional({ description: 'Filter criteria' })
  @IsOptional()
  @IsObject()
  filters?: OrderExportFiltersDto;

  @ApiPropertyOptional({ description: 'Format options like delimiter, timezone, encoding' })
  @IsOptional()
  @IsObject()
  formatOptions?: {
    delimiter?: ';' | ',';
    encoding?: string;
    useBOM?: boolean;
    timezone?: string;
    customHeaders?: Record<string, string>;
  };
}

export class PreviewExportDto {
  @ApiProperty({ description: 'Row mode: ORDER or LINE_ITEM', enum: ['ORDER', 'LINE_ITEM'] })
  @IsIn(['ORDER', 'LINE_ITEM'])
  rowMode!: 'ORDER' | 'LINE_ITEM';

  @ApiProperty({ description: 'Columns to preview' })
  @IsArray()
  columns!: string[];

  @ApiPropertyOptional({ description: 'Filters' })
  @IsOptional()
  @IsObject()
  filters?: OrderExportFiltersDto;

  @ApiPropertyOptional({ description: 'Format options' })
  @IsOptional()
  @IsObject()
  formatOptions?: Record<string, any>;
}

export class CreatePresetDto {
  @ApiProperty({ description: 'Preset name' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: 'Preset description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Whether preset is shared with team', default: true })
  @IsOptional()
  @IsBoolean()
  isShared?: boolean;

  @ApiProperty({ description: 'Row mode', enum: ['ORDER', 'LINE_ITEM'] })
  @IsIn(['ORDER', 'LINE_ITEM'])
  rowMode!: 'ORDER' | 'LINE_ITEM';

  @ApiProperty({ description: 'Format', enum: ['CSV', 'XLSX'] })
  @IsIn(['CSV', 'XLSX'])
  format!: 'CSV' | 'XLSX';

  @ApiProperty({ description: 'Column keys' })
  @IsArray()
  columns!: string[];

  @ApiPropertyOptional({ description: 'Saved filters' })
  @IsOptional()
  @IsObject()
  filters?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Format options' })
  @IsOptional()
  @IsObject()
  formatOptions?: Record<string, any>;
}

export class UpdatePresetDto {
  @ApiPropertyOptional({ description: 'Preset name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Preset description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Whether preset is shared' })
  @IsOptional()
  @IsBoolean()
  isShared?: boolean;

  @ApiPropertyOptional({ description: 'Row mode', enum: ['ORDER', 'LINE_ITEM'] })
  @IsOptional()
  @IsIn(['ORDER', 'LINE_ITEM'])
  rowMode?: 'ORDER' | 'LINE_ITEM';

  @ApiPropertyOptional({ description: 'Format', enum: ['CSV', 'XLSX'] })
  @IsOptional()
  @IsIn(['CSV', 'XLSX'])
  format?: 'CSV' | 'XLSX';

  @ApiPropertyOptional({ description: 'Columns' })
  @IsOptional()
  @IsArray()
  columns?: string[];

  @ApiPropertyOptional({ description: 'Filters' })
  @IsOptional()
  @IsObject()
  filters?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Format options' })
  @IsOptional()
  @IsObject()
  formatOptions?: Record<string, any>;
}

export class CreateScheduleDto {
  @ApiProperty({ description: 'Schedule name' })
  @IsString()
  name!: string;

  @ApiProperty({ description: 'Preset ID' })
  @IsString()
  presetId!: string;

  @ApiProperty({ description: 'Cron expression e.g. 0 8 * * 1' })
  @IsString()
  cron!: string;

  @ApiPropertyOptional({ description: 'Timezone', default: 'Europe/Istanbul' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiProperty({ description: 'Relative date range', enum: ['YESTERDAY', 'LAST_7_DAYS', 'LAST_WEEK', 'LAST_MONTH', 'MONTH_TO_DATE'] })
  @IsIn(['YESTERDAY', 'LAST_7_DAYS', 'LAST_WEEK', 'LAST_MONTH', 'MONTH_TO_DATE'])
  relativeRange!: 'YESTERDAY' | 'LAST_7_DAYS' | 'LAST_WEEK' | 'LAST_MONTH' | 'MONTH_TO_DATE';

  @ApiPropertyOptional({ description: 'Recipient emails' })
  @IsOptional()
  @IsArray()
  recipients?: string[];

  @ApiPropertyOptional({ description: 'Is active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateScheduleDto {
  @ApiPropertyOptional({ description: 'Schedule name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Preset ID' })
  @IsOptional()
  @IsString()
  presetId?: string;

  @ApiPropertyOptional({ description: 'Cron expression' })
  @IsOptional()
  @IsString()
  cron?: string;

  @ApiPropertyOptional({ description: 'Timezone' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ description: 'Relative date range' })
  @IsOptional()
  @IsIn(['YESTERDAY', 'LAST_7_DAYS', 'LAST_WEEK', 'LAST_MONTH', 'MONTH_TO_DATE'])
  relativeRange?: 'YESTERDAY' | 'LAST_7_DAYS' | 'LAST_WEEK' | 'LAST_MONTH' | 'MONTH_TO_DATE';

  @ApiPropertyOptional({ description: 'Recipient emails' })
  @IsOptional()
  @IsArray()
  recipients?: string[];

  @ApiPropertyOptional({ description: 'Is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
