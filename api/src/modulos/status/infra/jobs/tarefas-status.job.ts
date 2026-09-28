import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { ExpirarNecessidadesUseCase } from '../../application/use-cases/expirar-necessidades.use-case.js';
import { RecalcularStatusDeTodasUseCase } from '../../application/use-cases/recalcular-status-de-todas.use-case.js';

/**
 * Agenda as transições por tempo (RN01, RN02). Pressupõe uma instância só da API; com mais de
 * uma, trocar por um advisory lock no Postgres.
 */
@Injectable()
export class TarefasStatusJob {
  private readonly log = new Logger('TarefasStatus');
  private readonly emAndamento = new Set<string>();

  constructor(
    private readonly expirar: ExpirarNecessidadesUseCase,
    private readonly recalcular: RecalcularStatusDeTodasUseCase,
  ) {}

  @Cron('*/15 * * * *', { name: 'expirar-necessidades' })
  expirarNecessidades() {
    return this.umaPorVez('expirar-necessidades', () => this.expirar.executar());
  }

  @Cron('5 * * * *', { name: 'recalcular-status' })
  recalcularStatus() {
    return this.umaPorVez('recalcular-status', () => this.recalcular.executar());
  }

  /** Não deixa uma rodada começar enquanto a anterior (do mesmo job) ainda roda. */
  private async umaPorVez(nome: string, tarefa: () => Promise<number>) {
    if (this.emAndamento.has(nome)) return;
    this.emAndamento.add(nome);
    try {
      const quantidade = await tarefa();
      if (quantidade > 0) this.log.log(`${nome}: ${quantidade}`);
    } catch (erro) {
      this.log.error(`${nome} falhou`, erro instanceof Error ? erro.stack : String(erro));
    } finally {
      this.emAndamento.delete(nome);
    }
  }
}
