import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { LimparFotosExpiradasUseCase } from '../../application/use-cases/limpar-fotos-expiradas.use-case.js';

/** Uma vez por dia, de madrugada: fotos de atividade com mais de 90 dias (RN06). */
@Injectable()
export class LimparFotosJob {
  private readonly log = new Logger('LimparFotos');
  private emAndamento = false;

  constructor(private readonly limpar: LimparFotosExpiradasUseCase) {}

  @Cron('30 4 * * *', { name: 'limpar-fotos', timeZone: 'America/Sao_Paulo' })
  async executar() {
    if (this.emAndamento) return;
    this.emAndamento = true;
    try {
      const apagadas = await this.limpar.executar();
      if (apagadas > 0) this.log.log(`limpar-fotos: ${apagadas}`);
    } catch (erro) {
      this.log.error('limpar-fotos falhou', erro instanceof Error ? erro.stack : String(erro));
    } finally {
      this.emAndamento = false;
    }
  }
}
