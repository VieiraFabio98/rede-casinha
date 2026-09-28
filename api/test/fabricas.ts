import { randomUUID } from 'node:crypto';

import type { Ponto } from '../src/shared/domain/geo.js';
import { normalizarApelido } from '../src/shared/domain/texto.js';
import {
  NivelAcesso,
  type PrismaClient,
  type SituacaoCasinha,
  type StatusModeracao,
} from '../src/generated/prisma/client.js';
import { gerarLocalizacaoPublica } from '../src/modulos/localizacao/domain/localizacao-publica.js';

const PRACA_DA_SE: Ponto = { lat: -23.5505, lng: -46.6333 };

/** Cria usuário + perfil (cadastro concluído). */
export async function criarUsuario(
  prisma: PrismaClient,
  dados: { apelido?: string; nivel?: NivelAcesso } = {},
) {
  const apelido = dados.apelido ?? `usuario_${randomUUID().slice(0, 8)}`;
  const agora = new Date();
  const usuario = await prisma.usuario.create({
    data: {
      email: `${normalizarApelido(apelido)}@teste.test`,
      emailVerificadoEm: agora,
      perfil: {
        create: {
          apelido,
          apelidoNormalizado: normalizarApelido(apelido),
          nivel: dados.nivel ?? NivelAcesso.colaborador,
          maiorDeIdadeEm: agora,
          termosVersao: '2026-10-01',
          termosAceitosEm: agora,
        },
      },
    },
    include: { perfil: true },
  });
  return { usuario, perfil: usuario.perfil! };
}

/** Cria casinha com localização exata e pública (deslocada 150–400 m). */
export async function criarCasinha(
  prisma: PrismaClient,
  dados: {
    criadaPorId?: string;
    exata?: Ponto;
    nome?: string;
    situacao?: SituacaoCasinha;
    moderacao?: StatusModeracao;
  } = {},
) {
  const exata = dados.exata ?? PRACA_DA_SE;
  const publica = gerarLocalizacaoPublica(exata);
  return prisma.casinha.create({
    data: {
      nome: dados.nome ?? 'Casinha de teste',
      animais: 'ambos',
      latPublica: publica.lat,
      lngPublica: publica.lng,
      criadaPorId: dados.criadaPorId,
      situacao: dados.situacao,
      moderacao: dados.moderacao,
      localizacao: { create: { lat: exata.lat, lng: exata.lng, precisaoM: 10 } },
    },
  });
}
