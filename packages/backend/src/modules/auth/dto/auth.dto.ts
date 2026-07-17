import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com', description: 'User email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecurePass123!', description: 'User password (min 8 chars)' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'John', description: 'First name' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Doe', description: 'Last name' })
  @IsString()
  lastName: string;

  @ApiProperty({ example: 'XYZ Inc', description: 'Name of the first agency' })
  @IsString()
  agencyName: string;
}

export class LoginDto {
  @ApiProperty({ example: 'user@example.com', description: 'User email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecurePass123!', description: 'User password' })
  @IsString()
  password: string;
}

export class RefreshDto {
  @ApiProperty({ description: 'The active refresh token' })
  @IsString()
  refreshToken: string;
}

export class SwitchTenantDto {
  @ApiProperty({ example: 'cuid-agency-id', description: 'Agency ID to switch to' })
  @IsString()
  agencyId: string;

  @ApiPropertyOptional({ example: 'cuid-client-id', description: 'Optional Client ID to switch to' })
  @IsString()
  @IsOptional()
  clientId?: string;

  @ApiPropertyOptional({ example: 'cuid-store-id', description: 'Optional Store ID to switch to' })
  @IsString()
  @IsOptional()
  storeId?: string;
}

export class UserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiPropertyOptional()
  firstName?: string;

  @ApiPropertyOptional()
  lastName?: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  twoFactorEnabled: boolean;
}

export class AgencyTenantDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ required: false, nullable: true })
  publicId?: string | null;

  @ApiProperty()
  name: string;

  @ApiProperty()
  role: string;

  @ApiProperty({ required: false, nullable: true })
  clientId?: string | null;

  @ApiProperty({ required: false, nullable: true })
  storeId?: string | null;
}

export class AuthResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;

  @ApiProperty({ type: [AgencyTenantDto] })
  agencies: AgencyTenantDto[];
}
