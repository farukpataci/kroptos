import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEmail, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { PASSWORD_MIN_LENGTH } from '@kroptos/shared';

export const INVITATION_STATUSES = ['pending', 'accepted', 'revoked', 'expired'] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export class CreateInvitationDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  roleId: string;

  @ApiPropertyOptional({ description: 'Client kapsami; bos = ajans geneli' })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({ description: 'Magaza kapsami (UserRole.storeId); StoreUser YAZILMAZ' })
  @IsOptional()
  @IsString()
  storeId?: string;
}

export class ListInvitationsQueryDto {
  @ApiPropertyOptional({ enum: INVITATION_STATUSES })
  @IsOptional()
  @IsIn(INVITATION_STATUSES as unknown as string[])
  status?: InvitationStatus;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 50, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit: number = 50;
}

/** Kullanici sistemde YOKSA zorunlu; VARSA yok sayilir (sifre istenmez). */
export class AcceptInvitationDto {
  @ApiPropertyOptional({ description: 'Yeni kullanici icin zorunlu (PASSWORD_MIN_LENGTH, shared)' })
  @IsOptional()
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  password?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;
}
