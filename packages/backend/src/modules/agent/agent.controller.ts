import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PROTOCOL_VERSION } from '../../integrations/accounting/core/agent/AgentProtocol';
import { AgentService, AgentScope, ActorInfo } from './agent.service';
import { AgentGatewayService } from './agent-gateway.service';
import { AgentJobService } from './agent-job.service';
import { AssignAgentDto, CreateEnrollmentCodeDto, EnrollAgentDto, SubmitCredentialEnvelopeDto } from './dto/agent.dto';

/** Tenant bağlamı YALNIZCA TenantMiddleware'in doğruladığı alandan okunur — ham header asla (CLAUDE.md #2). */
function scopeOf(req: Request): AgentScope {
  const r = req as any;
  const agencyId: string | undefined = r.activeAgency?.id ?? r.user?.agencyId;
  if (!agencyId) throw new Error('Aktif ajans bağlamı yok');
  return { agencyId, clientId: r.activeClient?.id ?? null };
}
function actorOf(req: Request): ActorInfo {
  const u = (req as any).user ?? {};
  return { id: u.userId ?? u.id, email: u.email, name: u.name ?? u.username, ip: req.ip };
}

@ApiTags('Agents')
@ApiBearerAuth()
@ApiHeader({ name: 'x-agency-id', required: true, description: 'Active Agency ID' })
@ApiHeader({ name: 'x-client-id', required: false, description: 'Active Client ID' })
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@Controller('/api/agents')
export class AgentController {
  constructor(
    private readonly agents: AgentService,
    private readonly gateway: AgentGatewayService,
    private readonly jobs: AgentJobService,
  ) {}

  @Get()
  @HttpCode(200)
  @RequirePermission('agent.read')
  @ApiOperation({ summary: 'Agent listesi — bağlantı durumu üç değerli: Bağlı / Bağlı değil (son görülme) / İptal edildi' })
  @ApiResponse({ status: 200 })
  async list(@Req() req: Request) {
    const rows = await this.agents.list(scopeOf(req));
    return rows.map((a) => ({ ...a, connected: a.status !== 'REVOKED' && this.gateway.isConnected(a.id), protocolVersionServer: PROTOCOL_VERSION }));
  }

  @Post('enrollment-codes')
  @HttpCode(201)
  @RequirePermission('agent.manage')
  @ApiOperation({ summary: 'Tek kullanımlık kayıt kodu üret (TTL 15 dk) — kod yalnızca bu cevapta görünür' })
  @ApiResponse({ status: 201 })
  createCode(@Req() req: Request, @Body() dto: CreateEnrollmentCodeDto) {
    return this.agents.createEnrollmentCode(scopeOf(req), dto, actorOf(req));
  }

  @Post(':id/revoke')
  @HttpCode(200)
  @RequirePermission('agent.manage')
  @ApiOperation({ summary: 'Agent iptal: yeni oturum yok, açık tünel kapanır, Agent kasasını siler' })
  @ApiResponse({ status: 200 })
  async revoke(@Req() req: Request, @Param('id') id: string) {
    const r = await this.agents.revoke(scopeOf(req), id, actorOf(req));
    await this.gateway.pushToAgent(id, { kind: 'revoked', protocolVersion: PROTOCOL_VERSION, reason: 'revoked by panel' });
    return r;
  }

  @Post('integrations/:integrationId/assign')
  @HttpCode(200)
  @RequirePermission('agent.manage')
  @ApiOperation({ summary: 'Bağlantıya Agent ata (rota AGENT, tek aktif Agent — K9)' })
  @ApiResponse({ status: 200 })
  assign(@Req() req: Request, @Param('integrationId') integrationId: string, @Body() dto: AssignAgentDto) {
    return this.agents.assignToIntegration(scopeOf(req), integrationId, dto, actorOf(req));
  }

  @Post('credential-envelope')
  @HttpCode(201)
  @RequirePermission('accounting.credential.manage') // agent.manage'den AYRI izin (§10)
  @ApiOperation({ summary: 'Tarayıcıda Agent açık anahtarıyla şifrelenmiş ERP kimlik zarfını kuyruğa al — sunucu çözemez' })
  @ApiResponse({ status: 201 })
  async submitEnvelope(@Req() req: Request, @Body() dto: SubmitCredentialEnvelopeDto) {
    const r = await this.agents.submitCredentialEnvelope(scopeOf(req), dto, actorOf(req));
    await this.gateway.pushToAgent(r.agentId, { kind: 'credential_envelope', protocolVersion: PROTOCOL_VERSION, envelopeId: r.envelopeId, integrationId: dto.integrationId, blob: dto.blob, fingerprint: dto.fingerprint });
    return { envelopeId: r.envelopeId, expiresAt: r.expiresAt };
  }

  @Get('jobs')
  @HttpCode(200)
  @RequirePermission('agent.read')
  @ApiOperation({ summary: 'Agent iş kuyruğu (payload maskeli — kimlik zaten hiç girmez)' })
  @ApiResponse({ status: 200 })
  listJobs(@Req() req: Request, @Query('integrationId') integrationId?: string, @Query('status') status?: string) {
    return this.jobs.listJobs(scopeOf(req).agencyId, { integrationId, status });
  }
}

/** Kimliksiz uç: tek kullanımlık kod yetkidir. TenantMiddleware public listesinde. */
@ApiTags('Agents')
@Controller('/api/agents/enroll')
export class AgentEnrollController {
  constructor(private readonly agents: AgentService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Agent kaydı: kod + makine açık anahtarı → agentId + tünel sırrı; kod yakılır' })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 403, description: 'Kod geçersiz / kullanılmış / süresi dolmuş' })
  enroll(@Body() dto: EnrollAgentDto) {
    return this.agents.enroll(dto);
  }
}
