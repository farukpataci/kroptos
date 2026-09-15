import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ListUsersQueryDto {
  @ApiPropertyOptional({ description: 'Ad, soyad veya e-posta icinde arama' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ description: 'Rol anahtari (agency_owner, store_manager...)' })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({ enum: ['active', 'inactive'] })
  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';

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

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;
}

/**
 * Aktif ajanstaki rolu DEGISTIRIR: kullanicinin bu ajanstaki tum aktif
 * UserRole satirlari kapatilir, verilen rol + kapsam tek satir olarak acilir.
 * Ek rol vermek icin POST /api/rbac/assign.
 */
export class ChangeUserRoleDto {
  @ApiProperty()
  @IsString()
  roleId: string;

  @ApiPropertyOptional({ description: 'Client kapsami; bos = ajans geneli' })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({ description: 'Magaza kapsami; bos = ajans/client geneli' })
  @IsOptional()
  @IsString()
  storeId?: string;
}

export class UserScopeDto {
  @ApiProperty() userRoleId: string;
  @ApiProperty() roleId: string;
  @ApiProperty() roleKey: string;
  @ApiProperty() roleName: string;
  @ApiPropertyOptional({ nullable: true }) clientId: string | null;
  @ApiPropertyOptional({ nullable: true }) clientName: string | null;
  @ApiPropertyOptional({ nullable: true }) storeId: string | null;
  @ApiPropertyOptional({ nullable: true }) storeName: string | null;
}

/** passwordHash / twoFactorSecret / twoFactorBackupCodes ASLA yok: servis explicit select kullanir. */
export class UserResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiPropertyOptional({ nullable: true }) firstName: string | null;
  @ApiPropertyOptional({ nullable: true }) lastName: string | null;
  @ApiPropertyOptional({ nullable: true }) phone: string | null;
  @ApiPropertyOptional({ nullable: true }) avatar: string | null;
  @ApiProperty() isActive: boolean;
  @ApiProperty() twoFactorEnabled: boolean;
  @ApiProperty() createdAt: Date;
  @ApiProperty({ type: [UserScopeDto] }) scopes: UserScopeDto[];
  @ApiProperty({ type: [String], description: 'StoreUser ile atanmis magaza idleri' }) allowedStoreIds: string[];
}
