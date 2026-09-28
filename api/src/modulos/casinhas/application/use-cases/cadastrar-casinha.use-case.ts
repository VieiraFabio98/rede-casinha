import { Inject, Injectable } from '@nestjs/common';

import { RELOGIO, type Relogio } from '../../../../shared/domain/relogio.js';
import { TRANSACAO, type Transacao } from '../../../../shared/domain/transacao.js';
import type { UsuarioLogado } from '../../../../shared/domain/usuario-logado.js';
import { ConflictError, UnprocessableEntityError } from '../../../../shared/errors/index.js';
import { horaDoCelular } from '../../../necessidades/domain/regras.js';
import { PRECISAO_MAXIMA_M, posicaoAceita } from '../../domain/cadastro.js';
import {
  CONTROLE_DE_LIMITES,
  type ControleDeLimites,
} from '../../domain/providers/limites.provider.js';
import {
  LOCALIZACAO_EXATA,
  type LocalizacaoExata,
} from '../../domain/providers/localizacao-exata.provider.js';
import { URLS_DE_FOTOS, type UrlsDeFotos } from '../../domain/providers/urls-de-fotos.provider.js';
import {
  CASINHAS_REPOSITORY,
  type CasinhasRepository,
} from '../../domain/repositories/casinhas.repository.js';
import type { CadastrarCasinhaDto, ResultadoCadastro } from '../dto/casinhas.dto.js';

/**
 * Cadastro de casinha (RF02.1 a RF02.4), idempotente pelo id do celular.
 * - RN04: com casinha visível a até 30 m, devolve as candidatas sem criar (conta no limite de
 *   10 por dia: cada resposta revela que há uma casinha ali). Com `forcar`, cria em revisão.
 * - RN05: a pública é sorteada agora, uma vez; a exata vai só para o módulo `localizacao`.
 * - RF04: o criador vira adotante. RN06: 5 cadastros por dia (20 para o verificado).
 */
@Injectable()
export class CadastrarCasinhaUseCase {
  constructor(
    @Inject(TRANSACAO) private readonly transacao: Transacao,
    @Inject(CASINHAS_REPOSITORY) private readonly casinhas: CasinhasRepository,
    @Inject(LOCALIZACAO_EXATA) private readonly localizacao: LocalizacaoExata,
    @Inject(CONTROLE_DE_LIMITES) private readonly limites: ControleDeLimites,
    @Inject(URLS_DE_FOTOS) private readonly urlsDeFotos: UrlsDeFotos,
    @Inject(RELOGIO) private readonly relogio: Relogio,
  ) {}

  executar(usuario: UsuarioLogado, dto: CadastrarCasinhaDto): Promise<ResultadoCadastro> {
    if (!posicaoAceita(dto.precisaoM, dto.ajusteManual ?? false)) {
      throw new UnprocessableEntityError(
        `A localização precisa ter até ${PRECISAO_MAXIMA_M} m de erro. Espere o GPS melhorar ou ajuste o pino no mapa.`,
        'precisao_insuficiente',
      );
    }

    return this.transacao.executar(async () => {
      await this.casinhas.travarId(dto.id);
      const existente = await this.casinhas.existente(dto.id);
      if (existente) {
        if (existente.criadaPorId !== usuario.id) {
          throw new ConflictError('Já existe uma casinha com este id.', 'casinha_existente');
        }
        // Reenvio da fila: já foi criada.
        return this.resultado('ok', dto.id, existente.situacao === 'em_revisao');
      }

      const agora = this.relogio.agora();
      const exata = { lat: dto.lat, lng: dto.lng };
      const proximas = await this.localizacao.proximas(exata);
      if (proximas.length > 0 && !dto.forcar) {
        await this.limites.consumirDuplicata(usuario.id, agora);
        const candidatas = await this.casinhas.candidatas(proximas);
        return {
          ...this.resultado('possivel_duplicata', dto.id, false),
          candidatas: candidatas.map(({ fotoId, ...c }) => ({
            ...c,
            miniatura: fotoId ? this.urlsDeFotos.gerar([fotoId], agora)[0] : null,
          })),
        };
      }

      await this.limites.consumirCadastro(usuario, agora);
      const publica = this.localizacao.publicaPara(exata);
      const emRevisao = proximas.length > 0;
      await this.casinhas.criar({
        id: dto.id,
        nome: dto.nome,
        descricao: dto.descricao ?? null,
        animais: dto.animais,
        latPublica: publica.lat,
        lngPublica: publica.lng,
        situacao: emRevisao ? 'em_revisao' : 'ativa',
        criadaPorId: usuario.id,
        criadaEm: agora,
        criadaNoCelularEm: horaDoCelular(dto.criadaNoCelularEm, agora),
      });
      await this.localizacao.registrar(dto.id, exata, dto.precisaoM);
      return this.resultado('ok', dto.id, emRevisao);
    });
  }

  private resultado(
    resultado: ResultadoCadastro['resultado'],
    id: string,
    emRevisao: boolean,
  ): ResultadoCadastro {
    return { resultado, id, emRevisao, candidatas: [] };
  }
}
