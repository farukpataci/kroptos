import { Controller, Get, Post, Patch, Delete, Param, Body, Req, UseGuards, HttpCode } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { Request } from 'express';
import { IntegrationService } from './integration.service';
import { CreateIntegrationDto, UpdateIntegrationDto, IntegrationResponseDto, UpsertProductMappingDto } from './dto/integration.dto';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { decrypt } from '../../common/utils/encryption.util';

@ApiTags('Integrations')
@ApiBearerAuth()
@ApiHeader({ name: 'x-agency-id', required: true, description: 'Active Agency ID context' })
@ApiHeader({ name: 'x-client-id', required: false, description: 'Active Client ID context' })
@ApiHeader({ name: 'x-store-id', required: false, description: 'Active Store ID context' })
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@Controller('/api/integrations')
export class IntegrationController {
  constructor(private integrationService: IntegrationService) {}

  private checkSuperAdmin(req: Request): boolean {
    const user = (req as any).user;
    return user?.role === 'super_admin' || user?.role === 'Super Admin';
  }

  private sanitizeResponse(integration: any) {
    if (!integration) return null;
    const sanitized = { ...integration };
    if (integration.credentialsEncrypted) {
      try {
        const decryptedStr = decrypt(integration.credentialsEncrypted);
        let decrypted = {};
        if (decryptedStr.startsWith('{')) {
          decrypted = JSON.parse(decryptedStr);
        }
        
        const maskedCredentials: Record<string, any> = {};
        for (const [key, value] of Object.entries(decrypted)) {
          if (['password', 'apiSecret', 'awsSecretKey', 'token', 'apiKey', 'awsAccessKey', 'refreshToken'].includes(key)) {
            maskedCredentials[key] = '••••••••••••';
          } else {
            maskedCredentials[key] = value;
          }
        }
        sanitized.credentials = maskedCredentials;
      } catch (err) {
        // Fallback silently if not JSON
      }
    }
    delete sanitized.credentialsEncrypted;
    return sanitized;
  }

  @Get()
  @HttpCode(200)
  @RequirePermission('integrations.manage')
  @ApiOperation({ summary: 'List all active integrations in the active tenant context' })
  @ApiResponse({ status: 200, type: [IntegrationResponseDto] })
  async list(@Req() req: Request) {
    const activeAgency = (req as any).activeAgency;
    const activeClient = (req as any).activeClient;
    const activeStore = (req as any).activeStore;
    const isSuperAdmin = this.checkSuperAdmin(req);

    const list = await this.integrationService.list(
      activeAgency?.id,
      activeClient?.id,
      activeStore?.id,
      isSuperAdmin,
    );
    return list.map((item) => this.sanitizeResponse(item));
  }

  @Get(':id')
  @HttpCode(200)
  @RequirePermission('integrations.manage')
  @ApiOperation({ summary: 'Get active integration details' })
  @ApiResponse({ status: 200, type: IntegrationResponseDto })
  async get(@Param('id') id: string, @Req() req: Request) {
    const activeAgency = (req as any).activeAgency;
    const activeClient = (req as any).activeClient;
    const activeStore = (req as any).activeStore;
    const isSuperAdmin = this.checkSuperAdmin(req);

    const integration = await this.integrationService.get(
      id,
      activeAgency?.id,
      activeClient?.id,
      activeStore?.id,
      isSuperAdmin,
    );
    return this.sanitizeResponse(integration);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission('integrations.manage')
  @ApiOperation({ summary: 'Create a new integration provider config' })
  @ApiResponse({ status: 201, type: IntegrationResponseDto })
  async create(@Body() dto: CreateIntegrationDto, @Req() req: Request) {
    const user = req.user as any;
    const activeAgency = (req as any).activeAgency;
    const activeClient = (req as any).activeClient;
    const activeStore = (req as any).activeStore;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;

    const integration = await this.integrationService.create(
      dto,
      user.userId,
      activeAgency?.id,
      activeClient?.id,
      activeStore?.id,
      ipAddress,
    );
    return this.sanitizeResponse(integration);
  }

  @Patch(':id')
  @HttpCode(200)
  @RequirePermission('integrations.manage')
  @ApiOperation({ summary: 'Update integration provider settings' })
  @ApiResponse({ status: 200, type: IntegrationResponseDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateIntegrationDto,
    @Req() req: Request,
  ) {
    const user = req.user as any;
    const activeAgency = (req as any).activeAgency;
    const activeClient = (req as any).activeClient;
    const activeStore = (req as any).activeStore;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;

    const integration = await this.integrationService.update(
      id,
      dto,
      user.userId,
      activeAgency?.id,
      activeClient?.id,
      activeStore?.id,
      ipAddress,
    );
    return this.sanitizeResponse(integration);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('integrations.manage')
  @ApiOperation({ summary: 'Soft delete integration config' })
  @ApiResponse({ status: 204, description: 'Integration soft-deleted successfully' })
  async delete(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as any;
    const activeAgency = (req as any).activeAgency;
    const activeClient = (req as any).activeClient;
    const activeStore = (req as any).activeStore;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;

    await this.integrationService.delete(
      id,
      user.userId,
      activeAgency?.id,
      activeClient?.id,
      activeStore?.id,
      ipAddress,
    );
    return;
  }

  @Post(':id/test-connection')
  @HttpCode(200)
  @RequirePermission('integrations.manage')
  @ApiOperation({ summary: 'Test external connection parameters' })
  @ApiResponse({ status: 200, description: 'Connection testing results' })
  async testConnection(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as any;
    const activeAgency = (req as any).activeAgency;
    const activeClient = (req as any).activeClient;
    const activeStore = (req as any).activeStore;
    const isSuperAdmin = this.checkSuperAdmin(req);

    return this.integrationService.testConnection(
      id,
      user.userId,
      activeAgency?.id,
      activeClient?.id,
      activeStore?.id,
      isSuperAdmin,
    );
  }

  @Post(':id/sync')
  @HttpCode(200)
  @RequirePermission('integrations.manage')
  @ApiOperation({ summary: 'Trigger dynamic integration sync' })
  @ApiResponse({ status: 200, description: 'Sync job status and execution details' })
  async triggerSync(@Param('id') id: string, @Req() req: Request) {
    const activeAgency = (req as any).activeAgency;
    const activeClient = (req as any).activeClient;
    const activeStore = (req as any).activeStore;

    return this.integrationService.triggerSync(
      id,
      activeAgency?.id,
      activeClient?.id,
      activeStore?.id,
    );
  }

  @Post(':id/connect')
  @HttpCode(200)
  @RequirePermission('integrations.manage')
  @ApiOperation({ summary: 'Connect and verify integration' })
  @ApiResponse({ status: 200, description: 'Integration connected and verified successfully' })
  async connect(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as any;
    const activeAgency = (req as any).activeAgency;
    const activeClient = (req as any).activeClient;
    const activeStore = (req as any).activeStore;
    const isSuperAdmin = this.checkSuperAdmin(req);

    return this.integrationService.testConnection(
      id,
      user.userId,
      activeAgency?.id,
      activeClient?.id,
      activeStore?.id,
      isSuperAdmin,
    );
  }

  // ==================== Category & Attributes Mapping Endpoints ====================

  @Get(':id/categories/trendyol-tree')
  @HttpCode(200)
  @RequirePermission('integrations.manage')
  @ApiOperation({ summary: 'Get Trendyol official categories tree' })
  async getTrendyolCategories(@Param('id') id: string, @Req() req: Request) {
    const activeAgency = (req as any).activeAgency;
    const activeClient = (req as any).activeClient;
    const activeStore = (req as any).activeStore;
    const isSuperAdmin = this.checkSuperAdmin(req);

    return this.integrationService.getTrendyolCategories(
      id,
      activeAgency?.id,
      activeClient?.id,
      activeStore?.id,
      isSuperAdmin,
    );
  }

  @Get(':id/categories/trendyol-attributes/:categoryId')
  @HttpCode(200)
  @RequirePermission('integrations.manage')
  @ApiOperation({ summary: 'Get Trendyol category specific attributes' })
  async getTrendyolCategoryAttributes(
    @Param('id') id: string,
    @Param('categoryId') categoryId: string,
    @Req() req: Request,
  ) {
    const activeAgency = (req as any).activeAgency;
    const activeClient = (req as any).activeClient;
    const activeStore = (req as any).activeStore;
    const isSuperAdmin = this.checkSuperAdmin(req);

    return this.integrationService.getTrendyolCategoryAttributes(
      id,
      categoryId,
      activeAgency?.id,
      activeClient?.id,
      activeStore?.id,
      isSuperAdmin,
    );
  }

  @Get('products/:productId/mappings')
  @HttpCode(200)
  @RequirePermission('integrations.manage')
  @ApiOperation({ summary: 'Get product mappings list' })
  async getProductMappings(@Param('productId') productId: string, @Req() req: Request) {
    const activeAgency = (req as any).activeAgency;
    const activeClient = (req as any).activeClient;
    const activeStore = (req as any).activeStore;
    const isSuperAdmin = this.checkSuperAdmin(req);

    return this.integrationService.getProductMappings(
      productId,
      activeAgency?.id,
      activeClient?.id,
      activeStore?.id,
      isSuperAdmin,
    );
  }

  @Post('products/:productId/mappings')
  @HttpCode(200)
  @RequirePermission('integrations.manage')
  @ApiOperation({ summary: 'Create or update a product mapping' })
  async upsertProductMapping(
    @Param('productId') productId: string,
    @Body() dto: UpsertProductMappingDto,
    @Req() req: Request,
  ) {
    const activeAgency = (req as any).activeAgency;
    const activeClient = (req as any).activeClient;
    const activeStore = (req as any).activeStore;
    const isSuperAdmin = this.checkSuperAdmin(req);

    return this.integrationService.upsertProductMapping(
      productId,
      dto.integrationId,
      dto.marketplaceCategoryId,
      dto.marketplaceCategoryName,
      dto.attributesMapping,
      activeAgency?.id,
      activeClient?.id,
      activeStore?.id,
      isSuperAdmin,
    );
  }

  @Delete('products/:productId/mappings/:mappingId')
  @HttpCode(200)
  @RequirePermission('integrations.manage')
  @ApiOperation({ summary: 'Delete product mapping' })
  async deleteProductMapping(
    @Param('productId') productId: string,
    @Param('mappingId') mappingId: string,
    @Req() req: Request,
  ) {
    const activeAgency = (req as any).activeAgency;
    const activeClient = (req as any).activeClient;
    const activeStore = (req as any).activeStore;
    const isSuperAdmin = this.checkSuperAdmin(req);

    return this.integrationService.deleteProductMapping(
      productId,
      mappingId,
      activeAgency?.id,
      activeClient?.id,
      activeStore?.id,
      isSuperAdmin,
    );
  }
}
