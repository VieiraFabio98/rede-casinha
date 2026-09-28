import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Ambiente } from '../../../config/ambiente.js';
import { EmailConsole, EmailMemoria, EmailResend, EmailService } from './email.service.js';

@Global()
@Module({
  providers: [
    {
      provide: EmailService,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Ambiente, true>): EmailService => {
        switch (config.get('EMAIL_DRIVER', { infer: true })) {
          case 'resend':
            return new EmailResend(
              config.get('RESEND_API_KEY', { infer: true })!,
              config.get('EMAIL_REMETENTE', { infer: true }),
            );
          case 'memoria':
            return new EmailMemoria();
          default:
            return new EmailConsole();
        }
      },
    },
  ],
  exports: [EmailService],
})
export class EmailModule {}
