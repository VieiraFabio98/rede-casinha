import { Injectable } from '@nestjs/common';

import type { Ponto } from '../../../../shared/domain/geo.js';
import type { UsuarioLogado } from '../../../../shared/domain/usuario-logado.js';
import { CasinhasProximasUseCase } from '../../../localizacao/application/use-cases/casinhas-proximas.use-case.js';
import { ExataParaDetalheUseCase } from '../../../localizacao/application/use-cases/exata-para-detalhe.use-case.js';
import { ExatasParaListaUseCase } from '../../../localizacao/application/use-cases/exatas-para-lista.use-case.js';
import { RegistrarExataUseCase } from '../../../localizacao/application/use-cases/registrar-exata.use-case.js';
import { gerarLocalizacaoPublica } from '../../../localizacao/domain/localizacao-publica.js';
import type { LocalizacaoExata } from '../../domain/providers/localizacao-exata.provider.js';

type CasinhaRef = { id: string; criadaPorId: string | null };

@Injectable()
export class LocalizacaoExataAdapter implements LocalizacaoExata {
  constructor(
    private readonly exatasParaLista: ExatasParaListaUseCase,
    private readonly exataParaDetalhe: ExataParaDetalheUseCase,
    private readonly casinhasProximas: CasinhasProximasUseCase,
    private readonly registrarExata: RegistrarExataUseCase,
  ) {}

  paraLista(usuario: UsuarioLogado, casinhas: CasinhaRef[]) {
    return this.exatasParaLista.executar(usuario, casinhas);
  }

  paraDetalhe(usuario: UsuarioLogado, casinha: CasinhaRef) {
    return this.exataParaDetalhe.executar(usuario, casinha);
  }

  proximas(ponto: Ponto) {
    return this.casinhasProximas.executar(ponto);
  }

  publicaPara(exata: Ponto) {
    return gerarLocalizacaoPublica(exata);
  }

  registrar(casinhaId: string, exata: Ponto, precisaoM: number) {
    return this.registrarExata.executar(casinhaId, exata, precisaoM);
  }
}
