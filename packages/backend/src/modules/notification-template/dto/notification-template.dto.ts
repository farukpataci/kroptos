import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { NotificationChannel, NotificationEvent } from '@prisma/client';

const LOCALE = /^[a-z]{2}$/;

export class ListTemplatesQueryDto {
  @ApiPropertyOptional({ enum: NotificationChannel }) @IsOptional() @IsEnum(NotificationChannel) channel?: NotificationChannel;
  @ApiPropertyOptional({ enum: NotificationEvent }) @IsOptional() @IsEnum(NotificationEvent) event?: NotificationEvent;
  @ApiPropertyOptional({ default: 'tr' }) @IsOptional() @Matches(LOCALE) locale?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Boolean) @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) search?: string;
}

export class CreateTemplateDto {
  @ApiProperty({ enum: NotificationChannel }) @IsEnum(NotificationChannel) channel: NotificationChannel;
  @ApiProperty({ enum: NotificationEvent }) @IsEnum(NotificationEvent) event: NotificationEvent;
  @ApiPropertyOptional({ description: 'Yalnız ORDER_STATUS_CHANGED: özel durum anahtarı' }) @IsOptional() @IsString() @MaxLength(40) orderStatusKey?: string;
  @ApiPropertyOptional({ default: 'tr' }) @IsOptional() @Matches(LOCALE) locale?: string;
  @ApiProperty() @IsString() @MaxLength(120) name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) subject?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100_000) bodyHtml?: string;
  @ApiPropertyOptional({ description: 'SMS gövdesi veya e-postanın düz metin alternatifi' }) @IsOptional() @IsString() @MaxLength(10_000) bodyText?: string;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) senderName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) replyTo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(11) smsSenderId?: string;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsInt() @Min(0) @Max(7 * 24 * 60) sendDelayMinutes?: number;
}

export class UpdateTemplateDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) subject?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100_000) bodyHtml?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10_000) bodyText?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) senderName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) replyTo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(11) smsSenderId?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(7 * 24 * 60) sendDelayMinutes?: number;
}

export class PreviewDto {
  @ApiProperty({ enum: NotificationChannel }) @IsEnum(NotificationChannel) channel: NotificationChannel;
  @ApiProperty({ enum: NotificationEvent }) @IsEnum(NotificationEvent) event: NotificationEvent;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) subject?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100_000) bodyHtml?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10_000) bodyText?: string;
  @ApiPropertyOptional({ description: 'Verilirse gerçek sipariş verisi, yoksa örnek veri' }) @IsOptional() @IsString() @MaxLength(64) orderId?: string;
}

export class TestSendDto {
  @ApiProperty({ description: 'E-posta adresi veya telefon' }) @IsString() @MaxLength(255) recipient: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) orderId?: string;
  @ApiPropertyOptional({ description: 'Kaydedilmemiş gövde ile test' }) @IsOptional() @IsString() @MaxLength(255) subject?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100_000) bodyHtml?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10_000) bodyText?: string;
}
