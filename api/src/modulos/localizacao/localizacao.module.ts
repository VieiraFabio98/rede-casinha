import { Module } from '@nestjs/common';

import { LocalizacaoService } from './localizacao.service.js';

@Module({
  providers: [LocalizacaoService],
  exports: [LocalizacaoService],
})
export class LocalizacaoModule {}
