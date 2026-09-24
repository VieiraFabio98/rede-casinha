import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';

import { Publico } from '../../comum/auth/decoradores.js';
import { SaudeResposta } from './saude.dto.js';
import { SaudeService } from './saude.service.js';

@ApiTags('saude')
@Publico()
@Controller('saude')
export class SaudeController {
  constructor(private readonly saude: SaudeService) {}

  /** Verifica se a API e o banco estão no ar (usado pelo monitoramento e pelo deploy). */
  @Get()
  @ApiServiceUnavailableResponse({ description: 'Banco indisponível' })
  async verificar(): Promise<SaudeResposta> {
    const resultado = await this.saude.verificar();
    if (!resultado.ok) {
      throw new ServiceUnavailableException(resultado);
    }
    return resultado;
  }
}
