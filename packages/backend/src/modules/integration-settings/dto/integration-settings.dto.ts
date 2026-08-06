import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class SaveIntegrationSettingsDto {
  @ApiProperty({
    example: { 'stock.bufferQuantity': 5, 'orders.autoImport': true },
    description: 'Flat "<section>.<field>" map of the values the user set',
  })
  @IsObject()
  values: Record<string, unknown>;

  @ApiPropertyOptional({ example: 'Buffer raised for the campaign week' })
  @IsString()
  @IsOptional()
  note?: string;
}

export class ValidateIntegrationSettingsDto {
  @ApiProperty({ description: 'Values to validate without persisting them' })
  @IsObject()
  values: Record<string, unknown>;

  @ApiPropertyOptional({
    example: 'stock',
    description: 'Limit validation to one wizard step; omit to validate everything',
  })
  @IsString()
  @IsOptional()
  stepId?: string;
}

export class ResetIntegrationSettingsDto {
  @ApiPropertyOptional({
    example: 'stock.policy',
    description: 'Section to reset; omit to reset the whole integration',
  })
  @IsString()
  @IsOptional()
  sectionId?: string;
}

export class CompleteWizardStepDto {
  @ApiProperty({ example: 'stock', description: 'Wizard step that was just finished' })
  @IsString()
  stepId: string;

  @ApiPropertyOptional({ description: 'Values captured on this step, saved before completing it' })
  @IsObject()
  @IsOptional()
  values?: Record<string, unknown>;
}
