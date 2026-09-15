import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateEnrollmentCodeDto {
  @IsOptional()
  @IsString()
  clientId?: string;
}

/** Agent tarafından, kimlik doğrulaması OLMADAN gönderilir — tek kullanımlık kod yetkidir. */
export class EnrollAgentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  name!: string;

  /** SPKI PEM — K2: credential zarfı bununla şifrelenir */
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  publicKey!: string;

  @IsString()
  @MaxLength(32)
  agentVersion!: string;

  @IsString()
  @MaxLength(128)
  osVersion!: string;

  @IsInt()
  @Min(1)
  protocolVersion!: number;
}

/** K2: sunucu blob'u çözemez; yalnızca taşır ve teslimde siler. */
export class SubmitCredentialEnvelopeDto {
  @IsString()
  @IsNotEmpty()
  integrationId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(65536)
  blob!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  fingerprint!: string;
}

export class AssignAgentDto {
  @IsString()
  @IsNotEmpty()
  agentId!: string;

  /** K10: Agent Mikro makinesinde değilse açıkça işaretlenir */
  @IsOptional()
  @IsString()
  transportSecurity?: 'PLAINTEXT_LAN';
}
