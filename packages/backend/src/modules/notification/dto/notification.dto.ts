import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { NotificationChannel, NotificationEvent, NotificationLogStatus } from '@prisma/client';

export class ListLogsQueryDto {
  @ApiPropertyOptional({ enum: NotificationChannel }) @IsOptional() @IsEnum(NotificationChannel) channel?: NotificationChannel;
  @ApiPropertyOptional({ enum: NotificationLogStatus }) @IsOptional() @IsEnum(NotificationLogStatus) status?: NotificationLogStatus;
  @ApiPropertyOptional({ enum: NotificationEvent }) @IsOptional() @IsEnum(NotificationEvent) event?: NotificationEvent;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) orderId?: string;
  @ApiPropertyOptional({ description: 'ISO tarih (dahil)' }) @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional({ description: 'ISO tarih (dahil)' }) @IsOptional() @IsDateString() to?: string;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page: number = 1;
  @ApiPropertyOptional({ default: 25, maximum: 100 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize: number = 25;
}

export class UpsertProviderDto {
  @ApiProperty({ enum: NotificationChannel }) @IsEnum(NotificationChannel) channel: NotificationChannel;
  @ApiProperty({ example: 'smtp', description: 'EMAIL: smtp|console · SMS: netgsm|console' }) @IsString() @IsIn(['smtp', 'netgsm', 'console']) provider: string;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional({ description: 'Gizli olmayan alanlar (host, port, fromEmail, senderId…)' }) @IsOptional() @IsObject() config?: Record<string, unknown>;
  @ApiPropertyOptional({ description: 'Gizli alanlar; boş bırakılan alan mevcut değeri korur' }) @IsOptional() @IsObject() secrets?: Record<string, string>;
}

export class TestProviderDto {
  @ApiProperty({ enum: NotificationChannel }) @IsEnum(NotificationChannel) channel: NotificationChannel;
}
