import { Module } from '@nestjs/common';

import { LimitesModule } from '../limites/limites.module.js';
import { LocalizacaoModule } from '../localizacao/localizacao.module.js';
import { StatusModule } from '../status/status.module.js';
import { NecessidadesController } from './necessidades.controller.js';
import { NecessidadesService } from './necessidades.service.js';

@Module({
  imports: [LocalizacaoModule, StatusModule, LimitesModule],
  controllers: [NecessidadesController],
  providers: [NecessidadesService],
})
export class NecessidadesModule {}
