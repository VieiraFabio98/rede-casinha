import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';

import { type HttpResponse, ok } from '../../../../shared/helpers/index.js';
import { Publico } from '../../../../shared/infra/auth/decoradores.js';
import { SaudeResposta } from '../../application/dto/saude.dto.js';
import { VerificarSaudeUseCase } from '../../application/use-cases/verificar-saude.use-case.js';

@ApiTags('saude')
@Publico()
@Controller('saude')
export class SaudeController {
  constructor(private readonly verificarSaude: VerificarSaudeUseCase) {}

  /** Verifica se a API e o banco estão no ar (usado pelo monitoramento e pelo deploy). */
  @Get()
  @ApiOkResponse({ type: SaudeResposta })
  @ApiServiceUnavailableResponse({ description: 'Banco indisponível' })
  async verificar(): Promise<HttpResponse<SaudeResposta>> {
    const resultado = await this.verificarSaude.executar();
    // 503 com o mesmo corpo: o monitoramento lê `banco`.
    if (!resultado.ok) throw new ServiceUnavailableException(resultado);
    return ok(resultado);
  }
}
