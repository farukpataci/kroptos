import { Module } from '@nestjs/common';
import { PrismaModule } from '@common/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { RbacModule } from '../rbac/rbac.module';
import { InvitationController, PublicInvitationController } from './invitation.controller';
import { InvitationService } from './invitation.service';

@Module({
  imports: [PrismaModule, AuthModule, RbacModule, MailModule],
  controllers: [InvitationController, PublicInvitationController],
  providers: [InvitationService],
  exports: [InvitationService],
})
export class InvitationModule {}
