import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';

import { destino, distanciaM, type Ponto } from '../src/shared/domain/geo.js';
import type { NivelAcesso, PrismaClient } from '../src/generated/prisma/client.js';
import { criarAppDeTeste } from './app.js';
import { criarPrismaDeTeste, limparBanco } from './banco.js';
import { criarCasinha, criarUsuario } from './fabricas.js';

const PRACA_DA_SE: Ponto = { lat: -23.5505, lng: -46.6333 };

type Auth = Record<string, string>;

describe('cadastro de casinha (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let jwt: JwtService;

  const http = () => request(app.getHttpServer());

  async function entrar(nivel: NivelAcesso = 'colaborador') {
    const { perfil, usuario } = await criarUsuario(prisma, { nivel });
    const token = await jwt.signAsync({ sub: usuario.id });
    return { perfil, auth: { Authorization: `Bearer ${token}` } as Auth };
  }

  const cadastrar = (auth: Auth, dados: object = {}) =>
    http()
      .post('/v1/casinhas')
      .set(auth)
      .send({
        id: randomUUID(),
        nome: 'Casinha da Praça',
        animais: 'gatos',
        ...PRACA_DA_SE,
        precisaoM: 12,
        ...dados,
      });

  beforeAll(async () => {
    prisma = criarPrismaDeTeste();
    ({ app } = await criarAppDeTeste());
    jwt = app.get(JwtService);
  });

  beforeEach(async () => {
    await limparBanco(prisma);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('sem login: 401', async () => {
    await cadastrar({}).expect(401);
  });

  it('cria a casinha com a exata guardada à parte, a pública deslocada, histórico e adoção do criador', async () => {
    const { auth, perfil } = await entrar();
    const id = randomUUID();
    const criadaNoCelularEm = new Date(Date.now() - 60_000).toISOString();

    const { body } = await cadastrar(auth, {
      id,
      descricao: '  Perto do banco  ',
      criadaNoCelularEm,
    }).expect(200);

    expect(body).toEqual({ resultado: 'ok', id, emRevisao: false, candidatas: [] });
    const casinha = await prisma.casinha.findUniqueOrThrow({ where: { id } });
    expect(casinha).toMatchObject({
      nome: 'Casinha da Praça',
      descricao: 'Perto do banco',
      animais: 'gatos',
      situacao: 'ativa',
      status: 'ok',
      criadaPorId: perfil.id,
    });
    const exata = await prisma.casinhaLocalizacao.findUniqueOrThrow({ where: { casinhaId: id } });
    expect(exata).toMatchObject({ ...PRACA_DA_SE, precisaoM: 12 });
    const deslocamento = distanciaM(PRACA_DA_SE, {
      lat: casinha.latPublica,
      lng: casinha.lngPublica,
    });
    expect(deslocamento).toBeGreaterThanOrEqual(149);
    expect(deslocamento).toBeLessThanOrEqual(401);
    expect(await prisma.atividade.findFirstOrThrow({ where: { casinhaId: id } })).toMatchObject({
      tipo: 'cadastro',
      usuarioId: perfil.id,
      criadaNoCelularEm: new Date(criadaNoCelularEm),
    });
    expect(await prisma.adocao.findFirstOrThrow({ where: { casinhaId: id } })).toMatchObject({
      usuarioId: perfil.id,
      ativa: true,
    });

    // O criador vê a exata no detalhe e pode editar.
    const detalhe = await http().get(`/v1/casinhas/${id}`).set(auth).expect(200);
    expect(detalhe.body).toMatchObject({
      ...PRACA_DA_SE,
      exata: true,
      adotantes: [perfil.apelido],
      minhasPermissoes: { editar: true, deixarDeAdotar: true },
    });
  });

  it('reenviar o mesmo cadastro não duplica nem gasta limite; outro usuário com o mesmo id: 409', async () => {
    const { auth } = await entrar();
    const id = randomUUID();

    await cadastrar(auth, { id }).expect(200);
    const { body } = await cadastrar(auth, { id }).expect(200);

    expect(body).toMatchObject({ resultado: 'ok', id });
    expect(await prisma.casinha.count()).toBe(1);
    expect(await prisma.limiteUso.findFirstOrThrow()).toMatchObject({
      acao: 'cadastros',
      quantidade: 1,
    });
    const outro = await entrar();
    const conflito = await cadastrar(outro.auth, { id }).expect(409);
    expect(conflito.body.codigo).toBe('casinha_existente');
  });

  it('precisão acima de 30 m só com o pino ajustado à mão (RF02.1)', async () => {
    const { auth } = await entrar();

    const { body } = await cadastrar(auth, { precisaoM: 31 }).expect(422);
    expect(body.codigo).toBe('precisao_insuficiente');
    await cadastrar(auth, { precisaoM: 80, ajusteManual: true }).expect(200);
  });

  it('casinha a até 30 m: devolve as candidatas sem criar; "É nova" cria em revisão (RN04)', async () => {
    const { auth } = await entrar();
    const existente = await criarCasinha(prisma, { exata: PRACA_DA_SE, nome: 'Já existe' });
    const perto = destino(PRACA_DA_SE, 20, 45);
    const id = randomUUID();

    const { body } = await cadastrar(auth, { id, ...perto }).expect(200);

    expect(body).toEqual({
      resultado: 'possivel_duplicata',
      id,
      emRevisao: false,
      candidatas: [{ id: existente.id, nome: 'Já existe', miniatura: null }],
    });
    expect(await prisma.casinha.count()).toBe(1);

    const forcado = await cadastrar(auth, { id, ...perto, forcar: true }).expect(200);
    expect(forcado.body).toMatchObject({ resultado: 'ok', emRevisao: true });
    expect(await prisma.casinha.findUniqueOrThrow({ where: { id } })).toMatchObject({
      situacao: 'em_revisao',
    });
  });

  it('a candidata vem com a miniatura; inativa, oculta ou a mais de 30 m não conta', async () => {
    const { auth } = await entrar();
    const comFoto = await criarCasinha(prisma, { exata: PRACA_DA_SE });
    await prisma.foto.create({
      data: {
        casinhaId: comFoto.id,
        chave: 'fotos/x.jpg',
        chaveMiniatura: 'fotos/x_t.jpg',
      },
    });
    const { body } = await cadastrar(auth).expect(200);
    expect(body.candidatas[0].miniatura).toMatchObject({
      url: expect.stringMatching(/^\/fotos\//),
      urlMiniatura: expect.stringMatching(/^\/fotos\/.+\/miniatura\?/),
    });

    await limparBanco(prisma);
    const { auth: auth2 } = await entrar();
    await criarCasinha(prisma, { exata: PRACA_DA_SE, situacao: 'inativa' });
    await criarCasinha(prisma, { exata: PRACA_DA_SE, moderacao: 'oculto_moderador' });
    await criarCasinha(prisma, { exata: destino(PRACA_DA_SE, 40, 0) });
    const livre = await cadastrar(auth2).expect(200);
    expect(livre.body).toMatchObject({ resultado: 'ok', emRevisao: false });
  });

  it('limites por dia: 5 cadastros (20 para o verificado) e 10 que batem em duplicata (RN06)', async () => {
    const colaborador = await entrar();
    for (let i = 0; i < 5; i++) {
      await cadastrar(colaborador.auth, destino(PRACA_DA_SE, 1000 * (i + 1), 0)).expect(200);
    }
    const sexto = await cadastrar(colaborador.auth, destino(PRACA_DA_SE, 9000, 0)).expect(403);
    expect(sexto.body.codigo).toBe('limite_diario');

    const verificado = await entrar('verificado');
    for (let i = 0; i < 6; i++) {
      await cadastrar(verificado.auth, destino(PRACA_DA_SE, 1000 * (i + 1), 90)).expect(200);
    }

    const curioso = await entrar();
    for (let i = 0; i < 10; i++) {
      const { body } = await cadastrar(curioso.auth, destino(PRACA_DA_SE, 1000, 0)).expect(200);
      expect(body.resultado).toBe('possivel_duplicata');
    }
    await cadastrar(curioso.auth, destino(PRACA_DA_SE, 1000, 0)).expect(403);
  });

  it('valida a entrada', async () => {
    const { auth } = await entrar();
    await cadastrar(auth, { nome: 'ab' }).expect(400);
    await cadastrar(auth, { nome: '   ' }).expect(400);
    await cadastrar(auth, { animais: 'passaros' }).expect(400);
    await cadastrar(auth, { lat: 91 }).expect(400);
    await cadastrar(auth, { id: 'nao-e-uuid' }).expect(400);
    await cadastrar(auth, { latPublica: 0 }).expect(400);
    await cadastrar(auth, { descricao: 'x'.repeat(501) }).expect(400);
    expect(await prisma.casinha.count()).toBe(0);
  });
});
