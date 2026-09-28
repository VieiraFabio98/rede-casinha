import { Inject, Injectable } from '@nestjs/common';

import { RELOGIO, type Relogio } from '../../../../shared/domain/relogio.js';
import type { DenunciaAberta } from '../../domain/entities/denuncia.js';
import { BUSCA_DE_DUPLICATAS, type BuscaDeDuplicatas } from '../../domain/providers/portas.js';
import { ehPrioritaria, ordemDaFila } from '../../domain/regras.js';
import {
  AUDITORIA_REPOSITORY,
  type AuditoriaRepository,
} from '../../domain/repositories/auditoria.repository.js';
import {
  CASINHAS_MODERACAO_REPOSITORY,
  type CasinhasModeracaoRepository,
} from '../../domain/repositories/casinhas-moderacao.repository.js';
import {
  CONTEUDO_REPOSITORY,
  type ConteudoRepository,
} from '../../domain/repositories/conteudo.repository.js';
import {
  DENUNCIAS_MODERACAO_REPOSITORY,
  type DenunciasModeracaoRepository,
} from '../../domain/repositories/denuncias.repository.js';
import type { DenunciasDoAlvo, FilaModeracao } from '../dto/moderacao.dto.js';

/**
 * A fila de moderação: denúncias abertas agrupadas por alvo (prioritárias primeiro), casinhas em
 * revisão, pedidos de desativação ainda não decididos e possíveis duplicatas.
 */
@Injectable()
export class VerFilaUseCase {
  constructor(
    @Inject(DENUNCIAS_MODERACAO_REPOSITORY)
    private readonly denuncias: DenunciasModeracaoRepository,
    @Inject(CONTEUDO_REPOSITORY) private readonly conteudo: ConteudoRepository,
    @Inject(CASINHAS_MODERACAO_REPOSITORY) private readonly casinhas: CasinhasModeracaoRepository,
    @Inject(AUDITORIA_REPOSITORY) private readonly auditoria: AuditoriaRepository,
    @Inject(BUSCA_DE_DUPLICATAS) private readonly duplicatas: BuscaDeDuplicatas,
    @Inject(RELOGIO) private readonly relogio: Relogio,
  ) {}

  async executar(): Promise<FilaModeracao> {
    const [denuncias, casinhasEmRevisao, pedidosDesativacao, possiveisDuplicatas] =
      await Promise.all([
        this.denunciasPorAlvo(),
        this.casinhas.emRevisao(),
        this.pedidosNaoDecididos(),
        this.paresDeDuplicatas(),
      ]);
    return { denuncias, casinhasEmRevisao, pedidosDesativacao, possiveisDuplicatas };
  }

  private async denunciasPorAlvo(): Promise<DenunciasDoAlvo[]> {
    const porAlvo = new Map<string, DenunciaAberta[]>();
    for (const d of await this.denuncias.abertas()) {
      porAlvo.set(d.alvoId, [...(porAlvo.get(d.alvoId) ?? []), d]);
    }
    const agora = this.relogio.agora();
    const grupos = await Promise.all(
      [...porAlvo.values()].map(async (lista) => {
        const { alvoTipo, alvoId } = lista[0];
        const motivos = [...new Set(lista.map((d) => d.motivo))];
        return {
          alvoTipo,
          alvoId,
          ...(await this.conteudo.descrever({ alvoTipo, alvoId }, agora)),
          total: lista.length,
          motivos,
          prioridade: ehPrioritaria(motivos),
          maisAntigaEm: lista[0].criadaEm,
          denuncias: lista.map(({ id, motivo, descricao, apelido, criadaEm }) => ({
            id,
            motivo,
            descricao,
            apelido,
            criadaEm,
          })),
        };
      }),
    );
    return grupos.sort(ordemDaFila);
  }

  /** Pedidos feitos depois da última vez que a casinha foi "ativada" (mantida) pela moderação. */
  private async pedidosNaoDecididos() {
    const pedidos = await this.casinhas.pedidosDeDesativacao();
    const ativacoes = await this.auditoria.ultimasAtivacoes(pedidos.map((p) => p.casinha.id));
    return pedidos.filter(
      (p) => p.criadoEm.getTime() > (ativacoes.get(p.casinha.id)?.getTime() ?? 0),
    );
  }

  private async paresDeDuplicatas() {
    const pares = await this.duplicatas.paresProximos();
    const casinhas = new Map(
      (await this.casinhas.porIds(pares.flatMap((p) => [p.a, p.b]))).map((c) => [c.id, c]),
    );
    return pares.map((p) => ({
      a: casinhas.get(p.a)!,
      b: casinhas.get(p.b)!,
      distanciaM: p.distanciaM,
    }));
  }
}
