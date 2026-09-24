import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { UsuarioAtual } from '../../comum/auth/decoradores.js';
import type { UsuarioAutenticado } from '../../comum/auth/tipos.js';
import { ConcluirCadastroDto, MeResposta, PerfilResposta } from './me.dto.js';
import { MeService } from './me.service.js';

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(private readonly me: MeService) {}

  /** Dados da conta logada e do perfil (`perfil: null` enquanto o cadastro não for concluído). */
  @Get()
  obter(@UsuarioAtual() usuario: UsuarioAutenticado): Promise<MeResposta> {
    return this.me.obter(usuario.id);
  }

  /** Conclui o cadastro: apelido público, declaração de 18 anos e aceite dos termos. */
  @Post('cadastro')
  concluirCadastro(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body() dto: ConcluirCadastroDto,
  ): Promise<PerfilResposta> {
    return this.me.concluirCadastro(usuario.id, dto);
  }
}
