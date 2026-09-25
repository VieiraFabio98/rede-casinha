import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';

import { destino, type Ponto } from '../src/comum/geo.js';
import { diaAtual } from '../src/comum/tempo.js';
import type { NivelAcesso, PrismaClient } from '../src/generated/prisma/client.js';
import { LIMITES } from '../src/modulos/limites/limites.service.js';
import { criarAppDeTeste, RelogioDeTeste } from './app.js';
import { criarPrismaDeTeste, limparBanco } from './banco.js';
import { criarCasinha, criarUsuario } from './fabricas.js';

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;
const PRACA_DA_SE: Ponto = { lat: -23.5505, lng: -46.6333 };

type Auth = Record<string, string>;

describe('necessidades, atendimentos e check-in (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let jwt: JwtService;
  let relogio: RelogioDeTeste;

  const http = () => request(app.getHttpServer());

  async function entrar(nivel: NivelAcesso = 'colaborador') {
    const { perfil, usuario } = await criarUsuario(prisma, { nivel });
    const token = await jwt.signAsync({ sub: usuario.id });
    return { perfil, auth: { Authorization: `Bearer ${token}` } as Auth };
  }

  const reportar = (auth: Auth, corpo: Record<string, unknown>) =>
    http()
      .post('/v1/necessidades')
      .set(auth)
      .send({ id: randomUUID(), tipo: 'agua', urgencia: 'normal', ...corpo });

  const acao = (auth: Auth, necessidadeId: string, verbo: string, corpo: object = {}) =>
    http()
      .post(`/v1/necessidades/${necessidadeId}/${verbo}`)
      .set(auth)
      .send({ atividadeId: randomUUID(), ...corpo });

  const checkIn = (auth: Auth, casinhaId: string, corpo: object = {}) =>
    http()
      .post(`/v1/casinhas/${casinhaId}/check-in`)
      .set(auth)
      .send({ atividadeId: randomUUID(), ...corpo });

  const casinhaNoBanco = (id: string) => prisma.casinha.findUniqueOrThrow({ where: { id } });
  const abertas = (casinhaId: string) =>
    prisma.necessidade.findMany({ where: { casinhaId, status: 'aberta' } });

  beforeAll(async () => {
    prisma = criarPrismaDeTeste();
    relogio = new RelogioDeTeste();
    ({ app } = await criarAppDeTeste({ relogio }));
    jwt = app.get(JwtService);
  });

  beforeEach(async () => {
    await limparBanco(prisma);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('acesso e validação', () => {
    it('sem login: 401', async () => {
      const casinha = await criarCasinha(prisma);
      await reportar({}, { casinhaId: casinha.id }).expect(401);
      await checkIn({}, casinha.id).expect(401);
    });

    it('400 com tipo inválido, id que não é UUID ou só uma das coordenadas', async () => {
      const { auth } = await entrar();
      const casinha = await criarCasinha(prisma);
      await reportar(auth, { casinhaId: casinha.id, tipo: 'cerveja' }).expect(400);
      await reportar(auth, { casinhaId: casinha.id, id: 'abc' }).expect(400);
      await reportar(auth, { casinhaId: casinha.id, lat: -23.55 }).expect(400);
    });

    it('casinha inativa: 409; ocultada, para quem não é dono nem adotante: 404', async () => {
      const { auth } = await entrar();
      const inativa = await criarCasinha(prisma, { situacao: 'inativa' });
      const oculta = await criarCasinha(prisma, { moderacao: 'oculto_auto' });

      const r = await reportar(auth, { casinhaId: inativa.id }).expect(409);
      expect(r.body.codigo).toBe('casinha_inativa');
      await reportar(auth, { casinhaId: oculta.id }).expect(404);
      await reportar(auth, { casinhaId: randomUUID() }).expect(404);
    });
  });

  describe('reportar (RN02)', () => {
    it('cria a necessidade, registra no histórico e a casinha fica amarela', async () => {
      const { auth, perfil } = await entrar();
      const casinha = await criarCasinha(prisma);
      const id = randomUUID();

      const { body } = await reportar(auth, {
        id,
        casinhaId: casinha.id,
        tipo: 'racao',
        observacao: '  pote vazio  ',
      }).expect(200);

      expect(body).toEqual({ resultado: 'ok', necessidadeId: id, status: 'atencao' });
      const necessidade = await prisma.necessidade.findUniqueOrThrow({ where: { id } });
      expect(necessidade).toMatchObject({
        tipo: 'racao',
        status: 'aberta',
        criadaPorId: perfil.id,
        observacao: 'pote vazio',
      });
      // RN02: ração expira em 3 dias.
      expect(necessidade.expiraEm.getTime() - necessidade.criadaEm.getTime()).toBe(3 * DIA);
      expect(await prisma.atividade.findUnique({ where: { id } })).toMatchObject({
        tipo: 'reporte',
        necessidadeId: id,
      });
    });

    it('urgente deixa a casinha vermelha', async () => {
      const { auth } = await entrar();
      const casinha = await criarCasinha(prisma);
      const { body } = await reportar(auth, { casinhaId: casinha.id, urgencia: 'urgente' });
      expect(body.status).toBe('urgente');
      expect((await casinhaNoBanco(casinha.id)).status).toBe('urgente');
    });

    it('reportar um tipo já aberto vira reconfirmação e sobe a urgência', async () => {
      const a = await entrar();
      const b = await entrar();
      const casinha = await criarCasinha(prisma);
      const primeira = await reportar(a.auth, { casinhaId: casinha.id }).expect(200);
      relogio.avancar(DIA);

      const { body } = await reportar(b.auth, {
        casinhaId: casinha.id,
        urgencia: 'urgente',
      }).expect(200);

      expect(body).toMatchObject({
        resultado: 'reconfirmada',
        necessidadeId: primeira.body.necessidadeId,
        status: 'urgente',
      });
      const [aberta] = await abertas(casinha.id);
      expect(aberta).toMatchObject({ id: primeira.body.necessidadeId, urgencia: 'urgente' });
      // Prazo renovado a partir de agora (água: 2 dias).
      expect(aberta.expiraEm.getTime()).toBe(relogio.agora().getTime() + 2 * DIA);
      expect(await abertas(casinha.id)).toHaveLength(1);
    });

    it('reenviar o mesmo id (fila offline) não duplica nada', async () => {
      const { auth } = await entrar();
      const casinha = await criarCasinha(prisma);
      const corpo = { id: randomUUID(), casinhaId: casinha.id };

      await reportar(auth, corpo).expect(200);
      const repetido = await reportar(auth, corpo).expect(200);

      expect(repetido.body).toMatchObject({ resultado: 'ok', necessidadeId: corpo.id });
      expect(await prisma.necessidade.count()).toBe(1);
      expect(await prisma.atividade.count()).toBe(1);
      expect((await prisma.limiteUso.findFirstOrThrow()).quantidade).toBe(1);
    });

    it('10 reportes simultâneos do mesmo tipo: 1 aberta, 1 reporte e 9 reconfirmações', async () => {
      const casinha = await criarCasinha(prisma);
      const pessoas = await Promise.all(Array.from({ length: 10 }, () => entrar()));

      const respostas = await Promise.all(
        pessoas.map(({ auth }) => reportar(auth, { casinhaId: casinha.id })),
      );

      expect(respostas.every((r) => r.status === 200)).toBe(true);
      expect(await abertas(casinha.id)).toHaveLength(1);
      const tipos = await prisma.atividade.groupBy({ by: ['tipo'], _count: true });
      expect(Object.fromEntries(tipos.map((t) => [t.tipo, t._count]))).toEqual({
        reporte: 1,
        reconfirmacao: 9,
      });
    });

    it('validado_local: até 100 m da exata conta como no local; nada disso volta ao app', async () => {
      const { auth } = await entrar();
      const casinha = await criarCasinha(prisma, { exata: PRACA_DA_SE });
      const perto = destino(PRACA_DA_SE, 80, 45);
      const longe = destino(PRACA_DA_SE, 150, 45);

      const r1 = await reportar(auth, { casinhaId: casinha.id, tipo: 'agua', ...perto });
      const r2 = await reportar(auth, { casinhaId: casinha.id, tipo: 'racao', ...longe });
      const r3 = await reportar(auth, { casinhaId: casinha.id, tipo: 'limpeza' });

      const validado = async (id: string) =>
        (await prisma.necessidade.findUniqueOrThrow({ where: { id } })).validadoLocal;
      expect(await validado(r1.body.necessidadeId)).toBe(true);
      expect(await validado(r2.body.necessidadeId)).toBe(false);
      expect(await validado(r3.body.necessidadeId)).toBeNull();
      for (const r of [r1, r2, r3]) {
        expect(Object.keys(r.body).sort()).toEqual(['necessidadeId', 'resultado', 'status']);
      }
    });

    it(`limite de ${LIMITES.contribuicoes} contribuições por dia (RN06): a seguinte recebe 403`, async () => {
      const { auth, perfil } = await entrar();
      const casinha = await criarCasinha(prisma);
      await prisma.limiteUso.create({
        data: {
          usuarioId: perfil.id,
          acao: 'contribuicoes',
          dia: diaAtual(relogio.agora()),
          quantidade: LIMITES.contribuicoes - 1,
        },
      });

      await checkIn(auth, casinha.id).expect(200);
      const r = await checkIn(auth, casinha.id).expect(403);

      expect(r.body.codigo).toBe('limite_diario');
      expect(await prisma.atividade.count()).toBe(1); // a recusada não foi gravada
    });
  });

  describe('reconfirmar ("ainda precisa")', () => {
    it('renova o prazo; o mesmo usuário só de novo depois de 12 h', async () => {
      const autor = await entrar();
      const outro = await entrar();
      const casinha = await criarCasinha(prisma);
      const { body } = await reportar(autor.auth, { casinhaId: casinha.id, tipo: 'agua' });
      const id = body.necessidadeId;

      relogio.avancar(HORA);
      const cedo = await acao(autor.auth, id, 'reconfirmar').expect(200);
      expect(cedo.body.resultado).toBe('ja_reconfirmada');

      const deOutro = await acao(outro.auth, id, 'reconfirmar').expect(200);
      expect(deOutro.body.resultado).toBe('ok');
      const necessidade = await prisma.necessidade.findUniqueOrThrow({ where: { id } });
      expect(necessidade.expiraEm.getTime()).toBe(relogio.agora().getTime() + 2 * DIA);

      relogio.avancar(12 * HORA);
      const depois = await acao(autor.auth, id, 'reconfirmar').expect(200);
      expect(depois.body.resultado).toBe('ok');
    });

    it('necessidade já resolvida: 409', async () => {
      const { auth } = await entrar();
      const casinha = await criarCasinha(prisma);
      const { body } = await reportar(auth, { casinhaId: casinha.id });
      await acao(auth, body.necessidadeId, 'atender').expect(200);

      const r = await acao(auth, body.necessidadeId, 'reconfirmar').expect(409);
      expect(r.body.codigo).toBe('necessidade_fechada');
    });
  });

  describe('atender e contestar (RN03)', () => {
    it('atender resolve e a casinha volta a verde; o segundo recebe ja_atendida', async () => {
      const a = await entrar();
      const b = await entrar();
      const casinha = await criarCasinha(prisma);
      const { body } = await reportar(a.auth, { casinhaId: casinha.id });

      const primeiro = await acao(a.auth, body.necessidadeId, 'atender', {
        observacao: 'Troquei a água',
      }).expect(200);
      const segundo = await acao(b.auth, body.necessidadeId, 'atender').expect(200);

      expect(primeiro.body).toMatchObject({ resultado: 'ok', status: 'ok' });
      expect(segundo.body).toMatchObject({ resultado: 'ja_atendida', status: 'ok' });
      const necessidade = await prisma.necessidade.findUniqueOrThrow({
        where: { id: body.necessidadeId },
      });
      expect(necessidade).toMatchObject({ status: 'atendida', atendidaPorId: a.perfil.id });
      // O atendimento atrasado fica no histórico, mas não muda o dono do atendimento.
      expect(await prisma.atividade.count({ where: { tipo: 'atendimento' } })).toBe(2);
    });

    it('contestar até 24 h reabre a necessidade; depois disso, 409', async () => {
      const { auth } = await entrar();
      const casinha = await criarCasinha(prisma);
      const { body } = await reportar(auth, { casinhaId: casinha.id });
      const id = body.necessidadeId;
      await acao(auth, id, 'atender').expect(200);

      relogio.avancar(23 * HORA);
      const detalhe = await http().get(`/v1/casinhas/${casinha.id}`).set(auth).expect(200);
      expect(detalhe.body.atendidasRecentemente).toEqual([
        expect.objectContaining({ id, tipo: 'agua' }),
      ]);
      const contestada = await acao(auth, id, 'contestar', {
        observacao: 'O pote continua vazio',
      }).expect(200);

      expect(contestada.body).toMatchObject({ resultado: 'ok', status: 'atencao' });
      expect(await prisma.necessidade.findUniqueOrThrow({ where: { id } })).toMatchObject({
        status: 'aberta',
        atendidaEm: null,
      });

      await acao(auth, id, 'atender').expect(200);
      relogio.avancar(25 * HORA);
      const tarde = await acao(auth, id, 'contestar', { observacao: 'Ainda vazio' }).expect(409);
      expect(tarde.body.codigo).toBe('fora_do_prazo');
      const semBotao = await http().get(`/v1/casinhas/${casinha.id}`).set(auth).expect(200);
      expect(semBotao.body.atendidasRecentemente).toEqual([]);
    });

    it('contestar exige observação e só vale para necessidade atendida', async () => {
      const { auth } = await entrar();
      const casinha = await criarCasinha(prisma);
      const { body } = await reportar(auth, { casinhaId: casinha.id });

      await acao(auth, body.necessidadeId, 'contestar', { observacao: '' }).expect(400);
      const r = await acao(auth, body.necessidadeId, 'contestar', {
        observacao: 'Nem foi atendida',
      }).expect(409);
      expect(r.body.codigo).toBe('fora_do_prazo');
    });

    it('se já existe outra aberta do mesmo tipo, a contestação só fica no histórico', async () => {
      const { auth } = await entrar();
      const casinha = await criarCasinha(prisma);
      const primeira = await reportar(auth, { casinhaId: casinha.id });
      await acao(auth, primeira.body.necessidadeId, 'atender').expect(200);
      await reportar(auth, { casinhaId: casinha.id }).expect(200); // nova aberta de água

      await acao(auth, primeira.body.necessidadeId, 'contestar', {
        observacao: 'Não foi feito',
      }).expect(200);

      expect(await abertas(casinha.id)).toHaveLength(1);
      expect(await prisma.atividade.count({ where: { tipo: 'contestacao' } })).toBe(1);
    });
  });

  describe('check-in ("passei aqui, tudo ok")', () => {
    it('casinha sem notícias volta a verde; reenviar não duplica', async () => {
      const { auth } = await entrar();
      const casinha = await criarCasinha(prisma);
      await prisma.casinha.update({
        where: { id: casinha.id },
        data: { ultimaAtividadeEm: new Date(Date.now() - 10 * DIA), status: 'sem_noticias' },
      });
      const atividadeId = randomUUID();

      const { body } = await checkIn(auth, casinha.id, { atividadeId }).expect(200);
      await checkIn(auth, casinha.id, { atividadeId }).expect(200);

      expect(body).toEqual({ resultado: 'ok', necessidadeId: null, status: 'ok' });
      const depois = await casinhaNoBanco(casinha.id);
      expect(depois.ultimaAtividadeEm.getTime()).toBe(relogio.agora().getTime());
      expect(await prisma.atividade.count({ where: { tipo: 'check_in' } })).toBe(1);
    });

    it('check-in não fecha necessidade aberta: continua amarela', async () => {
      const { auth } = await entrar();
      const casinha = await criarCasinha(prisma);
      await reportar(auth, { casinhaId: casinha.id }).expect(200);
      const { body } = await checkIn(auth, casinha.id).expect(200);
      expect(body.status).toBe('atencao');
    });
  });
});
