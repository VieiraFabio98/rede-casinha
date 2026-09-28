import { Inject, Injectable } from '@nestjs/common';

import type { Ponto } from '../../../../shared/domain/geo.js';
import { diaAtual } from '../../../../shared/domain/tempo.js';
import type { UsuarioLogado } from '../../../../shared/domain/usuario-logado.js';
import { acessoAExata } from '../../domain/acesso-exata.js';
import type { CasinhaRef } from '../../domain/localizacao.js';
import {
  LOCALIZACAO_REPOSITORY,
  type LocalizacaoRepository,
} from '../../domain/repositories/localizacao.repository.js';

/**
 * Exatas que o usuário pode ver numa lista (mapa, "minhas casinhas"), por id de casinha.
 * Não gasta a cota do verificado: ele vê na lista só as que já abriu hoje no detalhe.
 * Assim, arrastar o mapa não revela exatas em massa.
 */
@Injectable()
export class ExatasParaListaUseCase {
  constructor(
    @Inject(LOCALIZACAO_REPOSITORY) private readonly repositorio: LocalizacaoRepository,
  ) {}

  async executar(usuario: UsuarioLogado, casinhas: CasinhaRef[]): Promise<Map<string, Ponto>> {
    if (casinhas.length === 0) return new Map();
    const ids = casinhas.map((c) => c.id);
    const [adotadas, vistas] = await Promise.all([
      this.repositorio.adotadasPor(usuario.id, ids),
      usuario.nivel === 'verificado'
        ? this.repositorio.vistasNoDia(usuario.id, diaAtual(), ids)
        : new Set<string>(),
    ]);
    const permitidas = casinhas
      .filter((c) => {
        const acesso = acessoAExata({
          nivel: usuario.nivel,
          souCriador: c.criadaPorId === usuario.id,
          souAdotante: adotadas.has(c.id),
        });
        return acesso === 'livre' || (acesso === 'cota_diaria' && vistas.has(c.id));
      })
      .map((c) => c.id);
    return this.repositorio.exatas(permitidas);
  }
}
