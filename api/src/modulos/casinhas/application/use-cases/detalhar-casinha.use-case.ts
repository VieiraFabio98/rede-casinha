import { Inject, Injectable } from '@nestjs/common';

import { RELOGIO, type Relogio } from '../../../../shared/domain/relogio.js';
import type { UsuarioLogado } from '../../../../shared/domain/usuario-logado.js';
import { NotFoundError } from '../../../../shared/errors/index.js';
import { permissoesNaCasinha } from '../../domain/permissoes.js';
import {
  LOCALIZACAO_EXATA,
  type LocalizacaoExata,
} from '../../domain/providers/localizacao-exata.provider.js';
import { URLS_DE_FOTOS, type UrlsDeFotos } from '../../domain/providers/urls-de-fotos.provider.js';
import {
  CASINHAS_REPOSITORY,
  type CasinhasRepository,
} from '../../domain/repositories/casinhas.repository.js';
import { acessoACasinha, JANELA_CONTESTACAO_MS } from '../../domain/visibilidade.js';
import type { CasinhaDetalhe } from '../dto/casinhas.dto.js';
import { coordenadas } from './coordenadas.js';

/** Detalhe da casinha. Para o verificado, ver a exata gasta 1 das 50 casinhas do dia. */
@Injectable()
export class DetalharCasinhaUseCase {
  constructor(
    @Inject(CASINHAS_REPOSITORY) private readonly casinhas: CasinhasRepository,
    @Inject(LOCALIZACAO_EXATA) private readonly localizacao: LocalizacaoExata,
    @Inject(URLS_DE_FOTOS) private readonly urlsDeFotos: UrlsDeFotos,
    @Inject(RELOGIO) private readonly relogio: Relogio,
  ) {}

  async executar(usuario: UsuarioLogado, id: string): Promise<CasinhaDetalhe> {
    const c = await this.casinhas.detalhe(id);
    const souAdotante = c?.adotantes.some((a) => a.usuarioId === usuario.id) ?? false;
    if (!c || acessoACasinha(c, usuario, souAdotante) !== 'permitido') {
      throw new NotFoundError('Casinha não encontrada');
    }

    const agora = this.relogio.agora();
    const desde = new Date(agora.getTime() - JANELA_CONTESTACAO_MS);
    const [exata, atendidas] = await Promise.all([
      this.localizacao.paraDetalhe(usuario, c),
      this.casinhas.atendidasDesde(id, desde),
    ]);
    return {
      id: c.id,
      nome: c.nome,
      descricao: c.descricao,
      animais: c.animais,
      status: c.status,
      ...coordenadas(c, exata ?? undefined),
      ultimaAtividadeEm: c.ultimaAtividadeEm,
      criadaEm: c.criadaEm,
      necessidadesAbertas: c.necessidadesAbertas,
      atendidasRecentemente: atendidas,
      adotantes: c.adotantes.map((a) => a.apelido),
      atividades: c.atividades.map(({ fotoId, ...a }) => ({
        ...a,
        foto: fotoId ? this.urlsDeFotos.gerar([fotoId], agora)[0] : null,
      })),
      fotos: this.urlsDeFotos.gerar(c.fotoIds, agora),
      minhasPermissoes: permissoesNaCasinha({
        nivel: usuario.nivel,
        souCriador: c.criadaPorId === usuario.id,
        souAdotante,
        adotantesAtivos: c.adotantes.length,
      }),
    };
  }
}
