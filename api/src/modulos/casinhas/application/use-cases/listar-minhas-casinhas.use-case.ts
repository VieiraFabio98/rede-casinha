import { Inject, Injectable } from '@nestjs/common';

import type { UsuarioLogado } from '../../../../shared/domain/usuario-logado.js';
import {
  LOCALIZACAO_EXATA,
  type LocalizacaoExata,
} from '../../domain/providers/localizacao-exata.provider.js';
import {
  CASINHAS_REPOSITORY,
  type CasinhasRepository,
} from '../../domain/repositories/casinhas.repository.js';
import { GRAVIDADE } from '../../domain/visibilidade.js';
import type { MinhaCasinha } from '../dto/casinhas.dto.js';
import { paraMapa } from './coordenadas.js';

/**
 * Casinhas que o usuário criou ou adota (inclusive as ocultadas por denúncia), da mais grave
 * para a mais tranquila: quem cuida vê primeiro o que precisa de atenção.
 */
@Injectable()
export class ListarMinhasCasinhasUseCase {
  constructor(
    @Inject(CASINHAS_REPOSITORY) private readonly casinhas: CasinhasRepository,
    @Inject(LOCALIZACAO_EXATA) private readonly localizacao: LocalizacaoExata,
  ) {}

  async executar(usuario: UsuarioLogado): Promise<MinhaCasinha[]> {
    const linhas = await this.casinhas.doUsuario(usuario.id); // em ordem de nome
    const exatas = await this.localizacao.paraLista(usuario, linhas);
    return linhas
      .map((c) => ({
        ...paraMapa(c, exatas.get(c.id)),
        souCriador: c.criadaPorId === usuario.id,
        souAdotante: c.souAdotante,
      }))
      .sort((a, b) => GRAVIDADE[a.status] - GRAVIDADE[b.status]); // estável: mantém o nome
  }
}
