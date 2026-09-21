import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateCategoryDto {
  // P12a: agencyId/clientId/storeId gövdeden alınmaz; kapsam yalnızca doğrulanmış aktif bağlamdan gelir.
  @ApiPropertyOptional({ example: 'cuid-parent-id', description: 'Optional parent category ID' })
  @IsString()
  @IsOptional()
  parentId?: string;

  @ApiProperty({ example: 'Electronics', description: 'Name of the category' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'electronics', description: 'URL-friendly slug (auto-generated if omitted)' })
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiPropertyOptional({ example: 'active', description: 'Status (active or inactive)' })
  @IsString()
  @IsOptional()
  status?: string;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional({ example: 'cuid-parent-id', description: 'Updated parent category ID' })
  @IsString()
  @IsOptional()
  parentId?: string;

  @ApiPropertyOptional({ example: 'Home Appliances', description: 'Updated name of the category' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'home-appliances', description: 'Updated slug' })
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiPropertyOptional({ example: 'active', description: 'Updated status' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ example: true, description: 'Toggle visibility' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CategoryResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  agencyId: string;

  @ApiPropertyOptional()
  clientId?: string;

  @ApiPropertyOptional()
  storeId?: string;

  @ApiPropertyOptional()
  parentId?: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
