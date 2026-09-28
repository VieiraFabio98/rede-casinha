import { Inject, Injectable } from '@nestjs/common';

import { RELOGIO, type Relogio } from '../../../../shared/domain/relogio.js';
import { TRANSACAO, type Transacao } from '../../../../shared/domain/transacao.js';
import type { UsuarioLogado } from '../../../../shared/domain/usuario-logado.js';
import {
  BadRequest,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../../../shared/errors/index.js';
import { permissoesNaCasinha } from '../../../casinhas/domain/permissoes.js';
import type { Foto } from '../../domain/entities/foto.js';
import { limparJpeg } from '../../domain/jpeg.js';
import {
  ACESSO_CASINHA,
  type AcessoCasinha,
  ARQUIVOS_DE_FOTOS,
  type ArquivosDeFotos,
  ASSINADOR_DE_URLS,
  type AssinadorDeUrls,
  CONTROLE_DE_LIMITES,
  type ControleDeLimites,
} from '../../domain/providers/portas.js';
import {
  FOTOS_REPOSITORY,
  type FotosRepository,
} from '../../domain/repositories/fotos.repository.js';
import {
  chavesDaFoto,
  expiraEmDaFoto,
  MAXIMO_FOTOS_DA_CASINHA,
  TAMANHO_MAXIMO_FOTO,
  TAMANHO_MAXIMO_MINIATURA,
  urlsDaFoto,
} from '../../domain/regras.js';
import type { EnviarFotoDto, FotoUrls } from '../dto/fotos.dto.js';

export interface ArquivosEnviados {
  foto: Buffer;
  miniatura: Buffer;
}

/**
 * Upload de foto, idempotente pelo id gerado no celular (a fila reenvia depois de uma queda).
 * Foto de perfil da casinha: só criador, adotante ou moderador, até 5 por casinha. Foto de
 * atividade: só de uma atividade do próprio usuário, uma por atividade, apagada em 90 dias.
 * RN06: 20 fotos por dia. O EXIF é removido de novo aqui, mesmo que o app já tenha removido.
 */
@Injectable()
export class EnviarFotoUseCase {
  constructor(
    @Inject(TRANSACAO) private readonly transacao: Transacao,
    @Inject(FOTOS_REPOSITORY) private readonly fotos: FotosRepository,
    @Inject(ACESSO_CASINHA) private readonly acesso: AcessoCasinha,
    @Inject(CONTROLE_DE_LIMITES) private readonly limites: ControleDeLimites,
    @Inject(ARQUIVOS_DE_FOTOS) private readonly arquivos: ArquivosDeFotos,
    @Inject(ASSINADOR_DE_URLS) private readonly assinador: AssinadorDeUrls,
    @Inject(RELOGIO) private readonly relogio: Relogio,
  ) {}

  async executar(
    usuario: UsuarioLogado,
    fotoId: string,
    dto: EnviarFotoDto,
    enviados: ArquivosEnviados,
  ): Promise<FotoUrls> {
    if (enviados.foto.length > TAMANHO_MAXIMO_FOTO) {
      throw new BadRequest('A foto passou de 1 MB.', 'foto_invalida');
    }
    if (enviados.miniatura.length > TAMANHO_MAXIMO_MINIATURA) {
      throw new BadRequest('A miniatura passou de 200 KB.', 'foto_invalida');
    }
    const foto = limparJpeg(enviados.foto);
    const miniatura = limparJpeg(enviados.miniatura);
    if (!foto || !miniatura) throw new BadRequest('Envie a foto em JPEG.', 'foto_invalida');

    // Reenvio de uma foto que já chegou: não confere permissão de novo (a casinha pode ter mudado).
    const existente = await this.fotos.buscar(fotoId);
    if (existente) return this.jaEnviada(existente, usuario);

    return this.transacao.executar(async () => {
      const { criadaPorId } = await this.acesso.travarParaAcao(usuario, dto.casinhaId);
      // Dois envios simultâneos da mesma foto: o segundo esperou a trava e a encontra aqui.
      const corrida = await this.fotos.buscar(fotoId);
      if (corrida) return this.jaEnviada(corrida, usuario);

      const atividadeId = dto.atividadeId ?? null;
      if (atividadeId) {
        const atividade = await this.fotos.atividade(atividadeId);
        if (
          !atividade ||
          atividade.casinhaId !== dto.casinhaId ||
          atividade.usuarioId !== usuario.id
        ) {
          throw new NotFoundError('Atividade não encontrada');
        }
        if (atividade.jaTemFoto) {
          throw new ConflictError('Esta atividade já tem foto.', 'atividade_com_foto');
        }
      } else {
        const { editar } = permissoesNaCasinha({
          nivel: usuario.nivel,
          souCriador: criadaPorId === usuario.id,
          souAdotante: await this.fotos.adotaAtivamente(usuario.id, dto.casinhaId),
          adotantesAtivos: 0,
        });
        if (!editar) {
          throw new ForbiddenError('Só quem cuida da casinha pode mudar as fotos dela.');
        }
        if ((await this.fotos.contarDaCasinha(dto.casinhaId)) >= MAXIMO_FOTOS_DA_CASINHA) {
          throw new ConflictError(
            `A casinha já tem ${MAXIMO_FOTOS_DA_CASINHA} fotos.`,
            'limite_fotos_casinha',
          );
        }
      }

      const agora = this.relogio.agora();
      await this.limites.consumirEnvioDeFoto(usuario.id, agora);

      // Arquivos antes do registro: se a gravação falhar, a transação desfaz o limite consumido.
      const chaves = chavesDaFoto(dto.casinhaId, fotoId);
      await Promise.all([
        this.arquivos.gravar(chaves.chave, foto, 'image/jpeg'),
        this.arquivos.gravar(chaves.chaveMiniatura, miniatura, 'image/jpeg'),
      ]);
      await this.fotos.criar({
        id: fotoId,
        casinhaId: dto.casinhaId,
        atividadeId,
        ...chaves,
        enviadaPorId: usuario.id,
        criadaEm: agora,
        expiraEm: expiraEmDaFoto(atividadeId, agora),
      });
      return this.urls(fotoId);
    });
  }

  private jaEnviada(foto: Foto, usuario: UsuarioLogado): FotoUrls {
    if (foto.enviadaPorId !== usuario.id) {
      throw new ConflictError('Já existe uma foto com este id.', 'foto_existente');
    }
    return this.urls(foto.id);
  }

  private urls(fotoId: string): FotoUrls {
    return urlsDaFoto(fotoId, this.relogio.agora(), (texto) => this.assinador.assinar(texto));
  }
}
