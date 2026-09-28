import { Inject, Injectable } from '@nestjs/common';

import { RELOGIO, type Relogio } from '../../../../shared/domain/relogio.js';
import { TRANSACAO, type Transacao } from '../../../../shared/domain/transacao.js';
import { TooManyRequestsError } from '../../../../shared/errors/index.js';
import {
  CODIGOS_DE_LOGIN,
  type CodigosDeLogin,
  ENVIO_DE_CODIGO,
  type EnvioDeCodigo,
} from '../../domain/providers/codigos-de-login.provider.js';
import {
  INTERVALO_MINIMO_CODIGO_MS,
  MAX_CODIGOS_POR_HORA,
  minutosDepois,
  normalizarEmail,
  VALIDADE_CODIGO_MIN,
} from '../../domain/regras.js';
import {
  CODIGOS_REPOSITORY,
  type CodigosRepository,
} from '../../domain/repositories/codigos.repository.js';

/** Login sem senha: envia um código de 6 dígitos. Responde igual exista ou não a conta. */
@Injectable()
export class PedirCodigoUseCase {
  constructor(
    @Inject(TRANSACAO) private readonly transacao: Transacao,
    @Inject(CODIGOS_REPOSITORY) private readonly codigos: CodigosRepository,
    @Inject(CODIGOS_DE_LOGIN) private readonly codigosDeLogin: CodigosDeLogin,
    @Inject(ENVIO_DE_CODIGO) private readonly envio: EnvioDeCodigo,
    @Inject(RELOGIO) private readonly relogio: Relogio,
  ) {}

  async executar(emailBruto: string): Promise<void> {
    const email = normalizarEmail(emailBruto);
    const agora = this.relogio.agora();

    const ultimo = await this.codigos.ultimoPedidoEm(email);
    if (ultimo && agora.getTime() - ultimo.getTime() < INTERVALO_MINIMO_CODIGO_MS) {
      throw new TooManyRequestsError('Aguarde 1 minuto para pedir outro código.');
    }
    const naUltimaHora = await this.codigos.contarPedidosDesde(email, minutosDepois(agora, -60));
    if (naUltimaHora >= MAX_CODIGOS_POR_HORA) {
      throw new TooManyRequestsError('Muitos códigos pedidos. Tente de novo mais tarde.');
    }

    const codigo = this.codigosDeLogin.gerar();
    await this.transacao.executar(async () => {
      await this.codigos.expirarPendentes(email, agora);
      await this.codigos.criar({
        email,
        codigoHash: this.codigosDeLogin.hash(email, codigo),
        criadoEm: agora,
        expiraEm: minutosDepois(agora, VALIDADE_CODIGO_MIN),
      });
    });
    await this.envio.enviar(email, codigo, VALIDADE_CODIGO_MIN);
  }
}
