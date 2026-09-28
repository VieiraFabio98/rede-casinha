import type { INestApplication } from '@nestjs/common';

import type { PrismaClient, TipoNecessidade } from '../src/generated/prisma/client.js';
import { prazoExpiracao } from '../src/modulos/status/domain/regras.js';
import { ExpirarNecessidadesUseCase } from '../src/modulos/status/application/use-cases/expirar-necessidades.use-case.js';
import { RecalcularStatusDeTodasUseCase } from '../src/modulos/status/application/use-cases/recalcular-status-de-todas.use-case.js';
import { criarAppDeTeste } from './app.js';
import { criarPrismaDeTeste, limparBanco } from './banco.js';
import { criarCasinha } from './fabricas.js';

const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;
const T0 = new Date('2026-09-01T12:00:00Z');
const depois = (ms: number) => new Date(T0.getTime() + ms);

const TIPOS: TipoNecessidade[] = [
  'agua',
  'racao',
  'limpeza',
  'remedio_veterinario',
  'cobertas',
  'outro',
  'reforma',
];

describe('jobs de status e expiração (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let expirar: ExpirarNecessidadesUseCase;
  let recalcular: RecalcularStatusDeTodasUseCase;

  /** Casinha com a última atividade em `ultimaAtividadeEm` e o status gravado. */
  async function casinha(dados: { ultimaAtividadeEm?: Date; status?: 'ok' | 'atencao' } = {}) {
    const c = await criarCasinha(prisma);
    return prisma.casinha.update({
      where: { id: c.id },
      data: { ultimaAtividadeEm: dados.ultimaAtividadeEm ?? T0, status: dados.status ?? 'ok' },
    });
  }

  function necessidade(
    casinhaId: string,
    tipo: TipoNecessidade,
    dados: { criadaEm?: Date; expiraEm?: Date } = {},
  ) {
    const criadaEm = dados.criadaEm ?? T0;
    return prisma.necessidade.create({
      data: {
        casinhaId,
        tipo,
        criadaEm,
        criadaNoCelularEm: criadaEm,
        expiraEm: dados.expiraEm ?? prazoExpiracao(tipo, criadaEm),
      },
    });
  }

  const statusDe = async (id: string) =>
    (await prisma.casinha.findUniqueOrThrow({ where: { id } })).status;

  beforeAll(async () => {
    prisma = criarPrismaDeTeste();
    ({ app } = await criarAppDeTeste());
    expirar = app.get(ExpirarNecessidadesUseCase);
    recalcular = app.get(RecalcularStatusDeTodasUseCase);
  });

  beforeEach(async () => {
    await limparBanco(prisma);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('expirar-necessidades (RN02)', () => {
    it.each(TIPOS)('%s expira exatamente no fim do prazo, nem um minuto antes', async (tipo) => {
      const c = await casinha({ status: 'atencao' });
      const n = await necessidade(c.id, tipo);
      const prazo = prazoExpiracao(tipo, T0).getTime() - T0.getTime();

      expect(await expirar.executar(depois(prazo - MINUTO))).toBe(0);
      expect(await expirar.executar(depois(prazo))).toBe(1);

      expect(await prisma.necessidade.findUniqueOrThrow({ where: { id: n.id } })).toMatchObject({
        status: 'expirada',
      });
      expect(await prisma.atividade.findFirstOrThrow()).toMatchObject({
        tipo: 'expiracao',
        necessidadeId: n.id,
        usuarioId: null,
        criadaEm: depois(prazo),
      });
    });

    it('recalcula o status: sem outra necessidade e sem atividade há 7 dias, vira "sem notícias"', async () => {
      const recente = await casinha({ status: 'atencao', ultimaAtividadeEm: depois(29 * DIA) });
      const antiga = await casinha({ status: 'atencao' });
      await necessidade(recente.id, 'reforma');
      await necessidade(antiga.id, 'reforma');

      await expirar.executar(depois(30 * DIA));

      expect(await statusDe(recente.id)).toBe('ok');
      expect(await statusDe(antiga.id)).toBe('sem_noticias');
    });

    it('expirar não toca nas necessidades ainda no prazo nem nas já fechadas', async () => {
      const c = await casinha({ status: 'atencao' });
      const vencida = await necessidade(c.id, 'agua');
      const noPrazo = await necessidade(c.id, 'reforma');
      await prisma.necessidade.create({
        data: {
          casinhaId: c.id,
          tipo: 'racao',
          status: 'atendida',
          criadaNoCelularEm: T0,
          expiraEm: T0,
          atendidaEm: T0,
        },
      });

      expect(await expirar.executar(depois(3 * DIA))).toBe(1);

      const porId = async (id: string) =>
        (await prisma.necessidade.findUniqueOrThrow({ where: { id } })).status;
      expect(await porId(vencida.id)).toBe('expirada');
      expect(await porId(noPrazo.id)).toBe('aberta');
      expect(await prisma.necessidade.count({ where: { status: 'atendida' } })).toBe(1);
      expect(await statusDe(c.id)).toBe('atencao'); // a reforma continua aberta
    });

    it('é idempotente: a segunda rodada não expira nem registra nada', async () => {
      const c = await casinha({ status: 'atencao' });
      await necessidade(c.id, 'agua');
      await necessidade(c.id, 'limpeza');

      expect(await expirar.executar(depois(10 * DIA))).toBe(2);
      expect(await expirar.executar(depois(10 * DIA))).toBe(0);
      expect(await prisma.atividade.count({ where: { tipo: 'expiracao' } })).toBe(2);
    });
  });

  describe('recalcular-status (RN01, transições por tempo)', () => {
    it('ok vira "sem notícias" depois de 7 dias sem atividade', async () => {
      const c = await casinha({ status: 'ok' });

      expect(await recalcular.executar(depois(7 * DIA))).toBe(0);
      expect(await statusDe(c.id)).toBe('ok');

      expect(await recalcular.executar(depois(7 * DIA + MINUTO))).toBe(1);
      expect(await statusDe(c.id)).toBe('sem_noticias');
    });

    it.each(['agua', 'racao'] as const)(
      'atenção vira urgente com %s aberta há mais de 48 h',
      async (tipo) => {
        const c = await casinha({ status: 'atencao' });
        // Reconfirmada ("ainda precisa"): o prazo foi renovado, mas o pedido é antigo.
        await necessidade(c.id, tipo, { expiraEm: depois(10 * DIA) });

        await recalcular.executar(depois(47 * HORA));
        expect(await statusDe(c.id)).toBe('atencao');

        await recalcular.executar(depois(49 * HORA));
        expect(await statusDe(c.id)).toBe('urgente');
      },
    );

    it('outros tipos abertos há dias continuam em atenção', async () => {
      const c = await casinha({ status: 'atencao' });
      await necessidade(c.id, 'reforma');

      await recalcular.executar(depois(10 * DIA));

      expect(await statusDe(c.id)).toBe('atencao');
    });

    it('corrige status gravado errado e é idempotente', async () => {
      const semNecessidade = await casinha({ status: 'atencao', ultimaAtividadeEm: depois(DIA) });

      expect(await recalcular.executar(depois(2 * DIA))).toBe(1);
      expect(await statusDe(semNecessidade.id)).toBe('ok');
      expect(await recalcular.executar(depois(2 * DIA))).toBe(0);
    });

    it('não mexe em casinha inativa (ela nem aparece no mapa)', async () => {
      const c = await casinha({ status: 'ok' });
      await prisma.casinha.update({ where: { id: c.id }, data: { situacao: 'inativa' } });

      expect(await recalcular.executar(depois(30 * DIA))).toBe(0);
      expect(await statusDe(c.id)).toBe('ok');
    });

    it('percorre mais de um lote (500 casinhas por vez)', async () => {
      const ids = Array.from({ length: 501 }, () => crypto.randomUUID());
      await prisma.casinha.createMany({
        data: ids.map((id) => ({
          id,
          nome: 'Lote',
          animais: 'gatos' as const,
          latPublica: -23.55,
          lngPublica: -46.63,
          status: 'ok' as const,
          ultimaAtividadeEm: T0,
        })),
      });

      expect(await recalcular.executar(depois(8 * DIA))).toBe(501);
      expect(await prisma.casinha.count({ where: { status: 'sem_noticias' } })).toBe(501);
    });
  });
});
