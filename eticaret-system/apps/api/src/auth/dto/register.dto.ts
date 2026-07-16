import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  agencyName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  clientName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  storeName!: string;
}
