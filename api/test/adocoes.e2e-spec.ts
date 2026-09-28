import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';

import { destino, type Ponto } from '../src/shared/domain/geo.js';
import { diaAtual } from '../src/shared/domain/tempo.js';
import type { NivelAcesso, PrismaClient } from '../src/generated/prisma/client.js';
import { criarAppDeTeste } from './app.js';
import { criarPrismaDeTeste, limparBanco } from './banco.js';
import { criarCasinha, criarUsuario } from './fabricas.js';

const PRACA_DA_SE: Ponto = { lat: -23.5505, lng: -46.6333 };
const PERTO = destino(PRACA_DA_SE, 80, 90);
const LONGE = destino(PRACA_DA_SE, 150, 90);

type Auth = Record<string, string>;

describe('adoção de casinha (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let jwt: JwtService;

  const http = () => request(app.getHttpServer());

  async function entrar(nivel: NivelAcesso = 'colaborador') {
    const { perfil, usuario } = await criarUsuario(prisma, { nivel });
    const token = await jwt.signAsync({ sub: usuario.id });
    return { perfil, auth: { Authorization: `Bearer ${token}` } as Auth };
  }

  const adotar = (auth: Auth, casinhaId: string, posicao: object = PERTO) =>
    http().post(`/v1/casinhas/${casinhaId}/adocao`).set(auth).send(posicao);
  const deixar = (auth: Auth, casinhaId: string) =>
    http().delete(`/v1/casinhas/${casinhaId}/adocao`).set(auth);
  const ativas = (casinhaId: string) =>
    prisma.adocao.findMany({ where: { casinhaId, ativa: true } });

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

  it('sem login: 401; casinha inativa: 409', async () => {
    const casinha = await criarCasinha(prisma);
    await adotar({}, casinha.id).expect(401);
    const { auth } = await entrar();
    const inativa = await criarCasinha(prisma, { situacao: 'inativa' });
    await adotar(auth, inativa.id).expect(409);
  });

  it('a até 100 m da exata: adota, registra no histórico e passa a ver a exata', async () => {
    const { auth, perfil } = await entrar();
    const casinha = await criarCasinha(prisma);

    const { body } = await adotar(auth, casinha.id, PERTO).expect(200);

    expect(body).toEqual({ resultado: 'ok' });
    expect(await ativas(casinha.id)).toEqual([
      expect.objectContaining({ usuarioId: perfil.id, ativa: true }),
    ]);
    expect(await prisma.atividade.findFirstOrThrow()).toMatchObject({
      tipo: 'adocao',
      usuarioId: perfil.id,
    });
    const detalhe = await http().get(`/v1/casinhas/${casinha.id}`).set(auth).expect(200);
    expect(detalhe.body).toMatchObject({
      exata: true,
      minhasPermissoes: { adotar: false, deixarDeAdotar: true },
    });
  });

  it.each([
    ['longe (150 m)', LONGE],
    ['sem posição', {}],
  ])('%s: nao_permitido, sem dizer o motivo nem a distância', async (_caso, posicao) => {
    const { auth } = await entrar();
    const casinha = await criarCasinha(prisma);

    const { body } = await adotar(auth, casinha.id, posicao).expect(200);

    expect(body).toEqual({ resultado: 'nao_permitido' });
    expect(await ativas(casinha.id)).toHaveLength(0);
  });

  it('o criador adota de qualquer lugar', async () => {
    const { auth, perfil } = await entrar();
    const casinha = await criarCasinha(prisma, { criadaPorId: perfil.id });

    const { body } = await adotar(auth, casinha.id, {}).expect(200);

    expect(body.resultado).toBe('ok');
  });

  it('com 3 adotantes, a 4ª adoção é recusada', async () => {
    const casinha = await criarCasinha(prisma);
    for (let i = 0; i < 3; i++) {
      const { auth } = await entrar();
      expect((await adotar(auth, casinha.id).expect(200)).body.resultado).toBe('ok');
    }
    const quarto = await entrar();

    const { body } = await adotar(quarto.auth, casinha.id).expect(200);

    expect(body.resultado).toBe('nao_permitido');
    expect(await ativas(casinha.id)).toHaveLength(3);
  });

  it('5 pedidos simultâneos perto da casinha: só 3 viram adoção', async () => {
    const casinha = await criarCasinha(prisma);
    const pessoas = await Promise.all(Array.from({ length: 5 }, () => entrar()));

    const respostas = await Promise.all(pessoas.map(({ auth }) => adotar(auth, casinha.id)));

    expect(respostas.filter((r) => r.body.resultado === 'ok')).toHaveLength(3);
    expect(await ativas(casinha.id)).toHaveLength(3);
  });

  it('já adota: pedir de novo devolve ok sem duplicar nem gastar tentativa', async () => {
    const { auth } = await entrar();
    const casinha = await criarCasinha(prisma);
    await adotar(auth, casinha.id).expect(200);

    await adotar(auth, casinha.id, {}).expect(200);

    expect(await ativas(casinha.id)).toHaveLength(1);
    expect((await prisma.limiteUso.findFirstOrThrow()).quantidade).toBe(1);
  });

  it('3 tentativas por dia, contando as recusadas; a 4ª recebe 403', async () => {
    const { auth, perfil } = await entrar();
    const casinhas = await Promise.all(Array.from({ length: 4 }, () => criarCasinha(prisma)));

    for (const c of casinhas.slice(0, 3)) await adotar(auth, c.id, LONGE).expect(200);
    const r = await adotar(auth, casinhas[3].id, PERTO).expect(403);

    expect(r.body.codigo).toBe('limite_diario');
    const uso = await prisma.limiteUso.findUniqueOrThrow({
      where: {
        usuarioId_acao_dia: { usuarioId: perfil.id, acao: 'adocao', dia: diaAtual() },
      },
    });
    expect(uso.quantidade).toBe(3);
  });

  it('deixar de adotar encerra a adoção; repetir não faz nada; dá para adotar de novo', async () => {
    const { auth } = await entrar();
    const casinha = await criarCasinha(prisma);
    await adotar(auth, casinha.id).expect(200);

    await deixar(auth, casinha.id).expect(200);
    await deixar(auth, casinha.id).expect(200);

    const [encerrada] = await prisma.adocao.findMany();
    expect(encerrada).toMatchObject({ ativa: false, encerradaEm: expect.any(Date) });
    expect(await prisma.atividade.count({ where: { tipo: 'fim_adocao' } })).toBe(1);

    await adotar(auth, casinha.id).expect(200);
    expect(await ativas(casinha.id)).toHaveLength(1);
  });

  it('"Minhas casinhas" vem da mais grave para a mais tranquila', async () => {
    const { auth, perfil } = await entrar();
    const nomes = ['A ok', 'B urgente', 'C sem notícias', 'D atenção'] as const;
    const status = ['ok', 'urgente', 'sem_noticias', 'atencao'] as const;
    for (let i = 0; i < nomes.length; i++) {
      const c = await criarCasinha(prisma, { nome: nomes[i], criadaPorId: perfil.id });
      await prisma.casinha.update({ where: { id: c.id }, data: { status: status[i] } });
    }

    const { body } = await http().get('/v1/me/casinhas').set(auth).expect(200);

    expect(body.map((c: { nome: string }) => c.nome)).toEqual([
      'B urgente',
      'D atenção',
      'C sem notícias',
      'A ok',
    ]);
  });
});
