import { Module } from '@nestjs/common';
import { ConsoleMailProvider, MAIL_PROVIDER, MailService } from './mail.service';

@Module({
  providers: [MailService, { provide: MAIL_PROVIDER, useClass: ConsoleMailProvider }],
  exports: [MailService],
})
export class MailModule {}
