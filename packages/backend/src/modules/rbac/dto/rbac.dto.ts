import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class AssignRoleDto {
  @ApiProperty({ example: 'cuid-user-id', description: 'User ID to assign the role to' })
  @IsString()
  userId: string;

  @ApiProperty({ example: 'cuid-agency-id', description: 'Agency ID context' })
  @IsString()
  agencyId: string;

  @ApiPropertyOptional({ example: 'cuid-client-id', description: 'Optional Client ID context' })
  @IsString()
  @IsOptional()
  clientId?: string;

  @ApiPropertyOptional({ example: 'cuid-store-id', description: 'Optional Store ID context' })
  @IsString()
  @IsOptional()
  storeId?: string;

  @ApiProperty({ example: 'cuid-role-id', description: 'Role ID to assign' })
  @IsString()
  roleId: string;
}

export class RevokeRoleDto {
  @ApiProperty({ example: 'cuid-user-role-id', description: 'UserRole relation ID to revoke (soft-delete)' })
  @IsString()
  userRoleId: string;
}

export class PermissionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;
}

export class RoleResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ type: [PermissionResponseDto] })
  permissions: PermissionResponseDto[];
}
