import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@common/prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { AgentService } from './agent.service';
import { AgentGatewayService } from './agent-gateway.service';
import { AgentJobService } from './agent-job.service';
import { AgentController, AgentEnrollController } from './agent.controller';

/** docs/mikro.agent.md GÖREV 6 — modules/agent: kayıt, tünel (WSS), iş yönlendirme, kimlik zarfı. */
@Module({
  imports: [ConfigModule, PrismaModule, AuditModule],
  controllers: [AgentController, AgentEnrollController],
  providers: [AgentService, AgentGatewayService, AgentJobService],
  exports: [AgentService, AgentGatewayService, AgentJobService],
})
export class AgentModule {}
