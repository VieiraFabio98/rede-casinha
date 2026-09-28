import { Body, Controller, Delete, Get, HttpCode, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';

import { created, type HttpResponse, noContent, ok } from '../../../../shared/helpers/index.js';
import { UsuarioAtual } from '../../../../shared/infra/auth/decoradores.js';
import type { UsuarioAutenticado } from '../../../../shared/infra/auth/tipos.js';
import {
  ConcluirCadastroDto,
  ContagensResposta,
  MeResposta,
  PerfilResposta,
} from '../../application/dto/me.dto.js';
import { ConcluirCadastroUseCase } from '../../application/use-cases/concluir-cadastro.use-case.js';
import { ContarContribuicoesUseCase } from '../../application/use-cases/contar-contribuicoes.use-case.js';
import { ExcluirContaUseCase } from '../../application/use-cases/excluir-conta.use-case.js';
import { ObterContaUseCase } from '../../application/use-cases/obter-conta.use-case.js';

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(
    private readonly obterConta: ObterContaUseCase,
    private readonly contarContribuicoes: ContarContribuicoesUseCase,
    private readonly concluirCadastroDaConta: ConcluirCadastroUseCase,
    private readonly excluirConta: ExcluirContaUseCase,
  ) {}

  /** Dados da conta logada e do perfil (`perfil: null` enquanto o cadastro não for concluído). */
  @Get()
  @ApiOkResponse({ type: MeResposta })
  async obter(@UsuarioAtual() usuario: UsuarioAutenticado): Promise<HttpResponse<MeResposta>> {
    return ok(await this.obterConta.executar(usuario.id));
  }

  /** Contagens para a tela de perfil. */
  @Get('contagens')
  @ApiOkResponse({ type: ContagensResposta })
  async contagens(
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<HttpResponse<ContagensResposta>> {
    return ok(await this.contarContribuicoes.executar(usuario.id));
  }

  /** Conclui o cadastro: apelido público, declaração de 18 anos e aceite dos termos. */
  @Post('cadastro')
  @ApiCreatedResponse({ type: PerfilResposta })
  async concluirCadastro(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body() dto: ConcluirCadastroDto,
  ): Promise<HttpResponse<PerfilResposta>> {
    return created(await this.concluirCadastroDaConta.executar(usuario.id, dto));
  }

  /**
   * Exclui a conta de vez (RN07). Vale também com cadastro pendente e com a conta bloqueada:
   * o direito de apagar os próprios dados não depende disso. A página web de exclusão (T0.8)
   * usa o login por código e esta mesma rota.
   */
  @Delete()
  @HttpCode(204)
  @ApiNoContentResponse()
  async excluir(@UsuarioAtual() usuario: UsuarioAutenticado): Promise<HttpResponse<null>> {
    await this.excluirConta.executar(usuario.id);
    return noContent();
  }
}
