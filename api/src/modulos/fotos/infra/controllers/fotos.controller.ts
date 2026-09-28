import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  Res,
  StreamableFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';

import type { UsuarioLogado } from '../../../../shared/domain/usuario-logado.js';
import { BadRequest } from '../../../../shared/errors/index.js';
import { type HttpResponse, ok } from '../../../../shared/helpers/index.js';
import { Nivel, PerfilAtual, Publico } from '../../../../shared/infra/auth/decoradores.js';
import {
  AbrirFotoQuery,
  CORPO_ENVIAR_FOTO,
  EnviarFotoDto,
  FotoUrls,
} from '../../application/dto/fotos.dto.js';
import { AbrirFotoUseCase } from '../../application/use-cases/abrir-foto.use-case.js';
import { EnviarFotoUseCase } from '../../application/use-cases/enviar-foto.use-case.js';
import { TAMANHO_MAXIMO_FOTO, type Variante } from '../../domain/regras.js';

/** O que o multer entrega de cada arquivo (só o que é usado aqui). */
type Recebido = { buffer: Buffer; mimetype: string };
type Enviados = { foto?: Recebido[]; miniatura?: Recebido[] };

/** Só aceita `image/jpeg` (o conteúdo ainda é conferido no use-case). */
function arquivo(enviados: Enviados | undefined, campo: keyof Enviados): Buffer {
  const [recebido] = enviados?.[campo] ?? [];
  if (!recebido) throw new BadRequest(`Falta o arquivo "${campo}".`, 'foto_invalida');
  if (recebido.mimetype !== 'image/jpeg') {
    throw new BadRequest('Envie a foto em JPEG.', 'foto_invalida');
  }
  return recebido.buffer;
}

@ApiTags('fotos')
@Controller('fotos')
export class FotosController {
  constructor(
    private readonly enviarFoto: EnviarFotoUseCase,
    private readonly abrirFoto: AbrirFotoUseCase,
  ) {}

  /**
   * Envia uma foto (multipart). O id é gerado no celular: reenviar a mesma foto não duplica.
   * Sem `atividadeId`, é foto de perfil da casinha (criador, adotante ou moderador; até 5).
   */
  @Put(':id')
  @HttpCode(200)
  @ApiBearerAuth()
  @Nivel('colaborador')
  @ApiConsumes('multipart/form-data')
  @ApiBody(CORPO_ENVIAR_FOTO)
  @ApiOkResponse({ type: FotoUrls })
  // Arquivos só em memória (até 1 MB cada); acima disso, 413 antes de chegar ao use-case.
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'foto', maxCount: 1 },
        { name: 'miniatura', maxCount: 1 },
      ],
      { limits: { fileSize: TAMANHO_MAXIMO_FOTO, files: 2, fields: 4, parts: 6 } },
    ),
  )
  async enviar(
    @PerfilAtual() usuario: UsuarioLogado,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: EnviarFotoDto,
    @UploadedFiles() enviados: Enviados | undefined,
  ): Promise<HttpResponse<FotoUrls>> {
    return ok(
      await this.enviarFoto.executar(usuario, id, dto, {
        foto: arquivo(enviados, 'foto'),
        miniatura: arquivo(enviados, 'miniatura'),
      }),
    );
  }

  /** Foto em 1024 px, pela URL assinada que vem no detalhe da casinha. */
  @Get(':id')
  @Publico()
  @SkipThrottle()
  @ApiProduces('image/jpeg')
  abrir(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: AbrirFotoQuery,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return this.entregar(id, 'foto', query, res);
  }

  /** Miniatura em 320 px, pela URL assinada que vem no detalhe da casinha. */
  @Get(':id/miniatura')
  @Publico()
  @SkipThrottle()
  @ApiProduces('image/jpeg')
  abrirMiniatura(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: AbrirFotoQuery,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return this.entregar(id, 'miniatura', query, res);
  }

  private async entregar(
    id: string,
    variante: Variante,
    { exp, assinatura }: AbrirFotoQuery,
    res: Response,
  ): Promise<StreamableFile> {
    const { arquivo, segundosRestantes } = await this.abrirFoto.executar(
      id,
      variante,
      exp,
      assinatura,
    );
    // O arquivo de uma foto nunca muda: o app pode guardar até a URL expirar.
    res.setHeader('Cache-Control', `private, max-age=${segundosRestantes}, immutable`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(arquivo, { type: 'image/jpeg' });
  }
}
