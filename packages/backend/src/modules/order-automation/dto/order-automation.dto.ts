import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateAutomationRuleDto {
  @ApiProperty({ description: 'Kuralın adı', example: 'Ödeme Alınınca Onayla' })
  @IsString()
  @IsNotEmpty({ message: 'Kural adı boş bırakılamaz.' })
  name: string;

  @ApiPropertyOptional({ description: 'Kural açıklaması' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Tetikleyici tipi', example: 'ORDER_CREATED' })
  @IsString()
  @IsNotEmpty({ message: 'Tetikleyici seçilmelidir.' })
  triggerType: string;

  @ApiPropertyOptional({ description: 'Tetikleyici yapılandırması' })
  @IsObject()
  @IsOptional()
  triggerConfig?: Record<string, any>;

  @ApiProperty({ description: 'Koşul ağacı' })
  @IsObject()
  @IsNotEmpty({ message: 'Koşul ağacı tanımlanmalıdır.' })
  conditions: Record<string, any>;

  @ApiProperty({ description: 'Sıralı aksiyon listesi' })
  @IsArray()
  @IsNotEmpty({ message: 'En az bir aksiyon tanımlanmalıdır.' })
  actions: Array<{ type: string; config: Record<string, any> }>;

  @ApiPropertyOptional({ description: 'Çalışma önceliği (küçük sayı önce çalışır)', default: 100 })
  @IsInt()
  @Min(1)
  @Max(1000)
  @IsOptional()
  priority?: number = 100;

  @ApiPropertyOptional({ description: 'Bu kural eşleştiğinde sonraki kuralları durdur', default: false })
  @IsBoolean()
  @IsOptional()
  stopProcessing?: boolean = false;

  @ApiPropertyOptional({ description: 'Sipariş başına yalnızca bir kez çalıştır', default: false })
  @IsBoolean()
  @IsOptional()
  runOncePerOrder?: boolean = false;

  @ApiPropertyOptional({ description: 'Aktiflik durumu', default: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean = false;

  @ApiPropertyOptional({ description: 'Kapsam seviyesi (STORE, CLIENT, AGENCY)', default: 'STORE' })
  @IsString()
  @IsOptional()
  scopeLevel?: string = 'STORE';
}

export class UpdateAutomationRuleDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  triggerType?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  triggerConfig?: Record<string, any>;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  conditions?: Record<string, any>;

  @ApiPropertyOptional()
  @IsArray()
  @IsOptional()
  actions?: Array<{ type: string; config: Record<string, any> }>;

  @ApiPropertyOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  @IsOptional()
  priority?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  stopProcessing?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  runOncePerOrder?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class ReorderRulesDto {
  @ApiProperty({ description: 'Öncelik sırasına göre kural ID dizisi' })
  @IsArray()
  @IsString({ each: true })
  ruleIds: string[];
}

export class TestRuleDto {
  @ApiPropertyOptional({ description: 'Kaydedilmiş kural ID (veya rule payload)' })
  @IsString()
  @IsOptional()
  ruleId?: string;

  @ApiPropertyOptional({ description: 'Geçici kural tanımı' })
  @IsObject()
  @IsOptional()
  rule?: CreateAutomationRuleDto;

  @ApiProperty({ description: 'Test edilecek sipariş ID' })
  @IsString()
  @IsNotEmpty()
  orderId: string;
}

export class BacktestRuleDto {
  @ApiPropertyOptional({ description: 'Son kaç günlük sipariş taranacak (varsayılan 30)', default: 30 })
  @IsInt()
  @Min(1)
  @Max(90)
  @IsOptional()
  days?: number = 30;
}

export class RunRuleDto {
  @ApiPropertyOptional({ description: 'Elle çalıştırılacak sipariş ID listesi' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  orderIds?: string[];
}
