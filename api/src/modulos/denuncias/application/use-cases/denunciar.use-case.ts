import { Inject, Injectable } from '@nestjs/common';

import { RELOGIO, type Relogio } from '../../../../shared/domain/relogio.js';
import { TRANSACAO, type Transacao } from '../../../../shared/domain/transacao.js';
import type { UsuarioLogado } from '../../../../shared/domain/usuario-logado.js';
import { BadRequest, NotFoundError } from '../../../../shared/errors/index.js';
import type { Alvo } from '../../../moderacao/domain/entities/denuncia.js';
import {
  ACESSO_CASINHA,
  type AcessoCasinha,
  CONTROLE_DE_LIMITES,
  type ControleDeLimites,
  OCULTACAO_AUTOMATICA,
  type OcultacaoAutomatica,
} from '../../domain/providers/portas.js';
import { contasQueContamAte, DENUNCIAS_PARA_OCULTAR } from '../../domain/regras.js';
import {
  DENUNCIAS_REPOSITORY,
  type DenunciasRepository,
} from '../../domain/repositories/denuncias.repository.js';
import type { DenunciarDto, RecebidoResposta } from '../dto/denuncias.dto.js';

/**
 * RF06.1. Uma denúncia por pessoa e alvo (repetir devolve `ok`). Com 3 denúncias abertas de
 * contas antigas, casinha e foto são ocultadas e a necessidade é cancelada (RF06.2).
 * A resposta é sempre `ok`: não revela quantas denúncias o alvo tem nem se foi ocultado.
 */
@Injectable()
export class DenunciarUseCase {
  constructor(
    @Inject(TRANSACAO) private readonly transacao: Transacao,
    @Inject(DENUNCIAS_REPOSITORY) private readonly denuncias: DenunciasRepository,
    @Inject(ACESSO_CASINHA) private readonly acesso: AcessoCasinha,
    @Inject(CONTROLE_DE_LIMITES) private readonly limites: ControleDeLimites,
    @Inject(OCULTACAO_AUTOMATICA) private readonly ocultacao: OcultacaoAutomatica,
    @Inject(RELOGIO) private readonly relogio: Relogio,
  ) {}

  executar(usuario: UsuarioLogado, dto: DenunciarDto): Promise<RecebidoResposta> {
    const alvo: Alvo = { alvoTipo: dto.alvoTipo, alvoId: dto.alvoId };
    return this.transacao.executar(async () => {
      const casinhaId = await this.conferirAlvo(usuario, alvo);
      if (await this.denuncias.jaDenunciou(alvo.alvoId, usuario.id)) return { resultado: 'ok' };

      const agora = this.relogio.agora();
      await this.limites.consumirDenuncia(usuario.id, agora);
      await this.denuncias.criar({
        ...alvo,
        motivo: dto.motivo,
        descricao: dto.descricao,
        denuncianteId: usuario.id,
      });

      const contam = await this.denuncias.contarAbertasDeContasAntigas(
        alvo.alvoId,
        contasQueContamAte(agora),
      );
      if (contam >= DENUNCIAS_PARA_OCULTAR) await this.ocultacao.ocultar(alvo, casinhaId, agora);
      return { resultado: 'ok' };
    });
  }

  /**
   * O alvo existe e o denunciante pode vê-lo? (não dá para denunciar o que não se vê).
   * Trava a casinha do alvo e a devolve, quando há.
   */
  private async conferirAlvo(usuario: UsuarioLogado, alvo: Alvo): Promise<string | null> {
    if (alvo.alvoTipo === 'perfil') {
      if (alvo.alvoId === usuario.id) throw new BadRequest('Não dá para denunciar a si mesmo');
      if (!(await this.denuncias.perfilExiste(alvo.alvoId))) {
        throw new NotFoundError('Alvo não encontrado');
      }
      return null;
    }
    const casinhaId = await this.denuncias.casinhaDoAlvo(alvo);
    if (!casinhaId) throw new NotFoundError('Alvo não encontrado');
    await this.acesso.travarParaAcao(usuario, casinhaId);
    return casinhaId;
  }
}
