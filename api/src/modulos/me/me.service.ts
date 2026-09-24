import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { normalizarApelido } from '../../comum/texto.js';
import { VERSAO_TERMOS } from '../../config/termos.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import type { ConcluirCadastroDto, MeResposta, PerfilResposta } from './me.dto.js';

@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  async obter(usuarioId: string): Promise<MeResposta> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      include: { perfil: true },
    });
    if (!usuario) throw new NotFoundException('Conta não encontrada');
    const { perfil } = usuario;
    return {
      id: usuario.id,
      email: usuario.email,
      perfil: perfil && {
        apelido: perfil.apelido,
        nivel: perfil.nivel,
        bloqueadoAte: perfil.bloqueadoAte,
      },
    };
  }

  async concluirCadastro(usuarioId: string, dto: ConcluirCadastroDto): Promise<PerfilResposta> {
    if (dto.termosVersao !== VERSAO_TERMOS) {
      throw new BadRequestException({
        message: 'Os termos de uso foram atualizados. Leia e aceite a versão atual.',
        codigo: 'termos_desatualizados',
        versaoAtual: VERSAO_TERMOS,
      });
    }
    if (await this.prisma.perfil.count({ where: { id: usuarioId } })) {
      throw new ConflictException({
        message: 'Cadastro já concluído',
        codigo: 'cadastro_existente',
      });
    }

    const agora = new Date();
    try {
      const perfil = await this.prisma.perfil.create({
        data: {
          id: usuarioId,
          apelido: dto.apelido,
          apelidoNormalizado: normalizarApelido(dto.apelido),
          maiorDeIdadeEm: agora,
          termosVersao: VERSAO_TERMOS,
          termosAceitosEm: agora,
        },
      });
      return { apelido: perfil.apelido, nivel: perfil.nivel, bloqueadoAte: perfil.bloqueadoAte };
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
        const campos = JSON.stringify(erro.meta ?? {});
        if (campos.includes('apelido')) {
          throw new ConflictException({
            message: 'Esse apelido já está em uso',
            codigo: 'apelido_em_uso',
          });
        }
        throw new ConflictException({
          message: 'Cadastro já concluído',
          codigo: 'cadastro_existente',
        });
      }
      throw erro;
    }
  }
}
