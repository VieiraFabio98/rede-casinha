import { Inject, Injectable } from '@nestjs/common';

import { RELOGIO, type Relogio } from '../../../../shared/domain/relogio.js';
import { TRANSACAO, type Transacao } from '../../../../shared/domain/transacao.js';
import type { UsuarioLogado } from '../../../../shared/domain/usuario-logado.js';
import {
  ACESSO_CASINHA,
  type AcessoCasinha,
  CONTROLE_DE_LIMITES,
  type ControleDeLimites,
} from '../../domain/providers/portas.js';
import {
  DENUNCIAS_REPOSITORY,
  type DenunciasRepository,
} from '../../domain/repositories/denuncias.repository.js';
import type { PedirDesativacaoDto, RecebidoResposta } from '../dto/denuncias.dto.js';

/**
 * RF02.7: "a casinha não existe mais". Vai para a fila de moderação; não desativa sozinho.
 * Idempotente pelo `atividadeId` (vem pela fila offline).
 */
@Injectable()
export class PedirDesativacaoUseCase {
  constructor(
    @Inject(TRANSACAO) private readonly transacao: Transacao,
    @Inject(DENUNCIAS_REPOSITORY) private readonly denuncias: DenunciasRepository,
    @Inject(ACESSO_CASINHA) private readonly acesso: AcessoCasinha,
    @Inject(CONTROLE_DE_LIMITES) private readonly limites: ControleDeLimites,
    @Inject(RELOGIO) private readonly relogio: Relogio,
  ) {}

  executar(
    usuario: UsuarioLogado,
    casinhaId: string,
    dto: PedirDesativacaoDto,
  ): Promise<RecebidoResposta> {
    return this.transacao.executar(async () => {
      await this.acesso.travarParaAcao(usuario, casinhaId);
      if (await this.denuncias.atividadeExiste(dto.atividadeId)) return { resultado: 'ok' };
      const agora = this.relogio.agora();
      await this.limites.consumirDenuncia(usuario.id, agora);
      await this.denuncias.registrarPedidoDeDesativacao({
        atividadeId: dto.atividadeId,
        casinhaId,
        usuarioId: usuario.id,
        motivo: dto.motivo,
        em: agora,
      });
      return { resultado: 'ok' };
    });
  }
}
