import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { DatevConfig, DatevEncoding, DatevKontenrahmen } from '../../../integrations/accounting/datev/datev.types';

export class DatevExportRequestDto {
  @ApiProperty({ description: 'Accounting Company ID' })
  @IsString()
  companyId: string;

  @ApiProperty({ example: '2026-01-01', description: 'Start date (YYYY-MM-DD)' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dateFrom formatı YYYY-MM-DD olmalıdır.' })
  dateFrom: string;

  @ApiProperty({ example: '2026-01-31', description: 'End date (YYYY-MM-DD)' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dateTo formatı YYYY-MM-DD olmalıdır.' })
  dateTo: string;

  @ApiPropertyOptional({
    description: 'GoBD Tekrar Dışa Aktarım Onayı: Daha önce aktarılmış kayıtlar varsa mükerrerliği göze alarak aktarır.',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  acknowledgeReexport?: boolean;

  @ApiPropertyOptional({ description: 'Optional config overrides for this export' })
  @IsObject()
  @IsOptional()
  overrideConfig?: Partial<DatevConfig>;
}

export class DatevConfigDto {
  @ApiProperty({ example: 1001, description: 'Berater-Nr (1001-9999999)' })
  @IsNumber()
  @Min(1001)
  @Max(9999999)
  beraterNummer: number;

  @ApiProperty({ example: 12345, description: 'Mandanten-Nr (1-99999)' })
  @IsNumber()
  @Min(1)
  @Max(99999)
  mandantenNummer: number;

  @ApiProperty({ example: '2026-01-01', description: 'Wirtschaftsjahresbeginn (YYYY-MM-DD)' })
  @IsString()
  wjBeginn: string;

  @ApiProperty({ example: 4, description: 'Sachkontenlänge (4-8)' })
  @IsNumber()
  @Min(4)
  @Max(8)
  sachkontenLaenge: number;

  @ApiProperty({ example: 'SKR03', enum: ['SKR03', 'SKR04'], description: 'Kontenrahmen (Zorunludur, varsayılan yoktur)' })
  @IsIn(['SKR03', 'SKR04'])
  kontenrahmen: DatevKontenrahmen;

  @ApiPropertyOptional({ example: 10000 })
  @IsNumber()
  @IsOptional()
  debitorNummernkreisStart?: number;

  @ApiPropertyOptional({ example: 69999 })
  @IsNumber()
  @IsOptional()
  debitorNummernkreisEnde?: number;

  @ApiPropertyOptional({ example: 'WINDOWS-1252', enum: ['WINDOWS-1252', 'UTF-8'] })
  @IsIn(['WINDOWS-1252', 'UTF-8'])
  @IsOptional()
  encoding?: DatevEncoding;

  @ApiPropertyOptional({ example: 0, enum: [0, 1] })
  @IsIn([0, 1])
  @IsOptional()
  festschreibung?: 0 | 1;

  @ApiPropertyOptional({ example: 'KO' })
  @IsString()
  @IsOptional()
  diktatKuerzel?: string;

  @ApiPropertyOptional({ example: 'Buchungsstapel' })
  @IsString()
  @IsOptional()
  bezeichnung?: string;
}
