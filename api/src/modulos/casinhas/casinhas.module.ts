import { Module } from '@nestjs/common';

import { LocalizacaoModule } from '../localizacao/localizacao.module.js';
import { CasinhasController, MinhasCasinhasController } from './casinhas.controller.js';
import { CasinhasService } from './casinhas.service.js';

@Module({
  imports: [LocalizacaoModule],
  controllers: [CasinhasController, MinhasCasinhasController],
  providers: [CasinhasService],
})
export class CasinhasModule {}
