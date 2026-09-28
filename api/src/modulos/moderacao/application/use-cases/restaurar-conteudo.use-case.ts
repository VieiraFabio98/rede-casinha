import { Inject, Injectable } from '@nestjs/common';

import { RELOGIO, type Relogio } from '../../../../shared/domain/relogio.js';
import { TRANSACAO, type Transacao } from '../../../../shared/domain/transacao.js';
import type { UsuarioLogado } from '../../../../shared/domain/usuario-logado.js';
import { ConflictError, NotFoundError } from '../../../../shared/errors/index.js';
import { prazoExpiracao } from '../../../status/domain/regras.js';
import {
  RECALCULADOR_DE_STATUS,
  type RecalculadorDeStatus,
} from '../../domain/providers/portas.js';
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
import type { AlvoDto, FeitoResposta } from '../dto/moderacao.dto.js';
import { exigirAlvo } from './conteudo.js';

/**
 * Desfaz a ocultação (necessidade cancelada volta a aberta, se não houver outra aberta do mesmo
 * tipo). As denúncias abertas do alvo viram improcedentes.
 */
@Injectable()
export class RestaurarConteudoUseCase {
  constructor(
    @Inject(TRANSACAO) private readonly transacao: Transacao,
    @Inject(CONTEUDO_REPOSITORY) private readonly conteudo: ConteudoRepository,
    @Inject(CASINHAS_MODERACAO_REPOSITORY) private readonly casinhas: CasinhasModeracaoRepository,
    @Inject(DENUNCIAS_MODERACAO_REPOSITORY)
    private readonly denuncias: DenunciasModeracaoRepository,
    @Inject(AUDITORIA_REPOSITORY) private readonly auditoria: AuditoriaRepository,
    @Inject(RECALCULADOR_DE_STATUS) private readonly status: RecalculadorDeStatus,
    @Inject(RELOGIO) private readonly relogio: Relogio,
  ) {}

  executar(moderador: UsuarioLogado, dto: AlvoDto): Promise<FeitoResposta> {
    const alvo = { alvoTipo: dto.alvoTipo, alvoId: dto.alvoId };
    return this.transacao.executar(async () => {
      const casinhaId = await exigirAlvo(alvo, this.conteudo, this.casinhas);
      const agora = this.relogio.agora();
      if (alvo.alvoTipo === 'necessidade') {
        await this.reabrir(alvo.alvoId, agora);
      } else if (!(await this.conteudo.tornarVisivel(alvo))) {
        throw new NotFoundError('Alvo não encontrado');
      }
      await this.denuncias.fecharDoAlvo(alvo.alvoId, false, moderador.id, agora);
      await this.auditoria.registrar({
        moderadorId: moderador.id,
        acao: 'restaurar',
        ...alvo,
        motivo: dto.motivo,
      });
      if (alvo.alvoTipo === 'necessidade') await this.status.recalcular(casinhaId, agora);
      return { resultado: 'ok' };
    });
  }

  private async reabrir(necessidadeId: string, agora: Date) {
    const n = await this.conteudo.necessidade(necessidadeId);
    if (!n) throw new NotFoundError('Alvo não encontrado');
    if (n.status !== 'cancelada') return;
    if (await this.conteudo.existeAbertaDoTipo(n.casinhaId, n.tipo)) {
      throw new ConflictError(
        'Já existe outra necessidade aberta deste tipo nesta casinha',
        'ja_existe_aberta',
      );
    }
    await this.conteudo.reabrirNecessidade(necessidadeId, prazoExpiracao(n.tipo, agora));
  }
}
