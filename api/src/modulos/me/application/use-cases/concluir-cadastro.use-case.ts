import { Inject, Injectable } from '@nestjs/common';

import { VERSAO_TERMOS } from '../../../../config/termos.js';
import { RELOGIO, type Relogio } from '../../../../shared/domain/relogio.js';
import { normalizarApelido } from '../../../../shared/domain/texto.js';
import { BadRequest, ConflictError } from '../../../../shared/errors/index.js';
import {
  CONTAS_REPOSITORY,
  type ContasRepository,
} from '../../domain/repositories/contas.repository.js';
import type { ConcluirCadastroDto, PerfilResposta } from '../dto/me.dto.js';

/** Apelido público, declaração de 18 anos e aceite dos termos vigentes. */
@Injectable()
export class ConcluirCadastroUseCase {
  constructor(
    @Inject(CONTAS_REPOSITORY) private readonly contas: ContasRepository,
    @Inject(RELOGIO) private readonly relogio: Relogio,
  ) {}

  async executar(usuarioId: string, dto: ConcluirCadastroDto): Promise<PerfilResposta> {
    if (dto.termosVersao !== VERSAO_TERMOS) {
      throw new BadRequest(
        'Os termos de uso foram atualizados. Leia e aceite a versão atual.',
        'termos_desatualizados',
      );
    }
    if (await this.contas.perfilExiste(usuarioId)) {
      throw new ConflictError('Cadastro já concluído', 'cadastro_existente');
    }

    const resultado = await this.contas.criarPerfil({
      usuarioId,
      apelido: dto.apelido,
      apelidoNormalizado: normalizarApelido(dto.apelido),
      termosVersao: VERSAO_TERMOS,
      em: this.relogio.agora(),
    });
    if (resultado === 'apelido_em_uso') {
      throw new ConflictError('Esse apelido já está em uso', 'apelido_em_uso');
    }
    if (resultado === 'cadastro_existente') {
      throw new ConflictError('Cadastro já concluído', 'cadastro_existente');
    }
    return resultado;
  }
}
