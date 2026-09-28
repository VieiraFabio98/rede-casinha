/**
 * Dados falsos para desenvolvimento: 5 usuários e 30 casinhas em volta de um centro.
 *
 *   npm run db:seed                  # popula (não faz nada se já estiver populado)
 *   npm run db:reset                 # apaga tudo, reaplica as migrations e popula de novo
 *
 * Centro configurável no .env: SEED_LAT, SEED_LNG (padrão: Praça da Sé, São Paulo) e SEED_RAIO_M.
 * Os dados são determinísticos: a mesma configuração gera sempre as mesmas casinhas.
 */
import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';

import { destino, type Ponto } from '../src/shared/domain/geo.js';
import { normalizarApelido } from '../src/shared/domain/texto.js';
import {
  AnimaisAtendidos,
  NivelAcesso,
  PrismaClient,
  StatusCasinha,
  StatusNecessidade,
  TipoNecessidade,
  Urgencia,
} from '../src/generated/prisma/client.js';
import { gerarLocalizacaoPublica } from '../src/modulos/localizacao/domain/localizacao-publica.js';

const DOMINIO_SEED = 'seed.test';
const CENTRO: Ponto = {
  lat: Number(process.env.SEED_LAT ?? -23.5505),
  lng: Number(process.env.SEED_LNG ?? -46.6333),
};
const RAIO_M = Number(process.env.SEED_RAIO_M ?? 3_000);
const TOTAL_CASINHAS = 30;
const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;

/** Prazos de expiração da RN02 (a regra oficial vive na API, T1.8). */
const PRAZO_DIAS: Record<TipoNecessidade, number> = {
  agua: 2,
  racao: 3,
  limpeza: 7,
  remedio_veterinario: 7,
  cobertas: 14,
  outro: 14,
  reforma: 30,
};

/** Gerador pseudoaleatório com semente (mulberry32), para o seed ser reproduzível. */
function criarAleatorio(semente: number) {
  let estado = semente >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const aleatorio = criarAleatorio(20260924);
const escolher = <T>(itens: readonly T[]): T => itens[Math.floor(aleatorio() * itens.length)];

const USUARIOS = [
  { apelido: 'Fundador', nivel: NivelAcesso.admin },
  { apelido: 'Moderadora_Ana', nivel: NivelAcesso.moderador },
  { apelido: 'Marta', nivel: NivelAcesso.verificado },
  { apelido: 'Lucas', nivel: NivelAcesso.colaborador },
  { apelido: 'Carla', nivel: NivelAcesso.colaborador },
] as const;

const LUGARES = [
  'Praça',
  'Escola',
  'Padaria',
  'Igreja',
  'Ponto de ônibus',
  'Mercado',
  'Posto de saúde',
  'Quadra',
  'Feira',
  'Estação',
  'Biblioteca',
  'Viaduto',
  'Pracinha',
  'Oficina',
  'Horta',
];
const COMPLEMENTOS = [
  'do Rosário',
  'da Vila',
  'Central',
  'do Bairro',
  'Nova',
  'da Esquina',
  'do Morro',
];

/** Versão simplificada da RN01 só para o seed ficar coerente (a regra oficial é a T1.8). */
function calcularStatus(
  abertas: { tipo: TipoNecessidade; urgencia: Urgencia; criadaEm: Date }[],
  ultimaAtividadeEm: Date,
  agora: Date,
): StatusCasinha {
  const aguaOuRacaoAntiga = abertas.some(
    (n) =>
      (n.tipo === TipoNecessidade.agua || n.tipo === TipoNecessidade.racao) &&
      agora.getTime() - n.criadaEm.getTime() > 48 * HORA,
  );
  if (abertas.some((n) => n.urgencia === Urgencia.urgente) || aguaOuRacaoAntiga) {
    return StatusCasinha.urgente;
  }
  if (abertas.length > 0) return StatusCasinha.atencao;
  if (agora.getTime() - ultimaAtividadeEm.getTime() <= 7 * DIA) return StatusCasinha.ok;
  return StatusCasinha.sem_noticias;
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('O seed só roda fora de produção.');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const jaPopulado = await prisma.usuario.count({
      where: { email: { endsWith: `@${DOMINIO_SEED}` } },
    });
    if (jaPopulado > 0) {
      console.log('Banco já tem dados do seed. Para recriar do zero: npm run db:reset');
      return;
    }

    const agora = new Date();

    const perfis = [];
    for (const { apelido, nivel } of USUARIOS) {
      const usuario = await prisma.usuario.create({
        data: {
          email: `${normalizarApelido(apelido)}@${DOMINIO_SEED}`,
          emailVerificadoEm: agora,
          perfil: {
            create: {
              apelido,
              apelidoNormalizado: normalizarApelido(apelido),
              nivel,
              maiorDeIdadeEm: agora,
              termosVersao: '2026-10-01',
              termosAceitosEm: agora,
            },
          },
        },
        include: { perfil: true },
      });
      perfis.push(usuario.perfil!);
    }
    const criadores = perfis.filter((p) => p.nivel !== NivelAcesso.admin);

    for (let i = 0; i < TOTAL_CASINHAS; i++) {
      // Distribuição uniforme no disco (sqrt evita concentrar tudo no centro).
      const exata = destino(CENTRO, RAIO_M * Math.sqrt(aleatorio()), aleatorio() * 360);
      const publica = gerarLocalizacaoPublica(exata, aleatorio);
      const criador = escolher(criadores);
      const criadaEm = new Date(agora.getTime() - (5 + aleatorio() * 85) * DIA);
      // Parte das casinhas fica sem notícias (> 7 dias sem atividade).
      const ultimaAtividadeEm = new Date(
        Math.max(
          criadaEm.getTime(),
          agora.getTime() - (i % 5 === 0 ? 8 + aleatorio() * 20 : aleatorio() * 6) * DIA,
        ),
      );

      // Necessidades abertas: 0 a 2 tipos distintos por casinha.
      const tiposAbertos = [
        ...new Set([
          escolher(Object.values(TipoNecessidade)),
          escolher(Object.values(TipoNecessidade)),
        ]),
      ].slice(0, Math.floor(aleatorio() * 3));
      const abertas = tiposAbertos.map((tipo) => ({
        tipo,
        urgencia: aleatorio() < 0.25 ? Urgencia.urgente : Urgencia.normal,
        criadaEm: new Date(agora.getTime() - aleatorio() * 2.5 * DIA),
      }));

      const casinha = await prisma.casinha.create({
        data: {
          nome: `Casinha ${escolher(LUGARES)} ${escolher(COMPLEMENTOS)} ${i + 1}`,
          descricao:
            aleatorio() < 0.6 ? 'Casinha de madeira com cobertura. Dados de exemplo.' : null,
          animais: escolher(Object.values(AnimaisAtendidos)),
          latPublica: publica.lat,
          lngPublica: publica.lng,
          status: calcularStatus(abertas, ultimaAtividadeEm, agora),
          ultimaAtividadeEm,
          criadaPorId: criador.id,
          criadaEm,
          localizacao: {
            create: { lat: exata.lat, lng: exata.lng, precisaoM: 5 + aleatorio() * 20 },
          },
          adocoes: { create: { usuarioId: criador.id, iniciadaEm: criadaEm } },
          atividades: {
            create: [
              { tipo: 'cadastro', usuarioId: criador.id, criadaEm, criadaNoCelularEm: criadaEm },
              { tipo: 'check_in', usuarioId: criador.id, criadaEm: ultimaAtividadeEm },
            ],
          },
        },
      });

      for (const necessidade of abertas) {
        await prisma.necessidade.create({
          data: {
            casinhaId: casinha.id,
            tipo: necessidade.tipo,
            urgencia: necessidade.urgencia,
            status: StatusNecessidade.aberta,
            criadaPorId: escolher(criadores).id,
            criadaEm: necessidade.criadaEm,
            criadaNoCelularEm: necessidade.criadaEm,
            expiraEm: new Date(necessidade.criadaEm.getTime() + PRAZO_DIAS[necessidade.tipo] * DIA),
            atividades: {
              create: {
                casinhaId: casinha.id,
                tipo: 'reporte',
                usuarioId: escolher(criadores).id,
                criadaEm: necessidade.criadaEm,
              },
            },
          },
        });
      }

      // Histórico: uma necessidade já atendida em metade das casinhas.
      if (aleatorio() < 0.5) {
        const criadaEm = new Date(casinha.criadaEm.getTime() + aleatorio() * 3 * DIA);
        const atendidaEm = new Date(criadaEm.getTime() + (2 + aleatorio() * 30) * HORA);
        const atendente = escolher(criadores);
        await prisma.necessidade.create({
          data: {
            casinhaId: casinha.id,
            tipo: TipoNecessidade.racao,
            status: StatusNecessidade.atendida,
            criadaPorId: escolher(criadores).id,
            criadaEm,
            criadaNoCelularEm: criadaEm,
            expiraEm: new Date(criadaEm.getTime() + PRAZO_DIAS.racao * DIA),
            atendidaPorId: atendente.id,
            atendidaEm,
            atividades: {
              create: {
                casinhaId: casinha.id,
                tipo: 'atendimento',
                usuarioId: atendente.id,
                criadaEm: atendidaEm,
              },
            },
          },
        });
      }
    }

    const porStatus = await prisma.casinha.groupBy({ by: ['status'], _count: true });
    console.log(
      `Seed concluído: ${perfis.length} usuários e ${TOTAL_CASINHAS} casinhas em volta de ` +
        `(${CENTRO.lat}, ${CENTRO.lng}), raio de ${RAIO_M} m.`,
    );
    console.log(porStatus.map((s) => `  ${s.status}: ${s._count}`).join('\n'));
  } finally {
    await prisma.$disconnect();
  }
}

await main();
