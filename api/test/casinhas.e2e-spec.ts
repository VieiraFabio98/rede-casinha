import { randomUUID } from 'node:crypto';
import { gzipSync } from 'node:zlib';

import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';

import { distanciaM, type Ponto } from '../src/comum/geo.js';
import { diaAtual } from '../src/comum/tempo.js';
import type { NivelAcesso, PrismaClient } from '../src/generated/prisma/client.js';
import { LIMITE_EXATAS_POR_DIA } from '../src/modulos/localizacao/acesso-exata.js';
import { gerarLocalizacaoPublica } from '../src/modulos/localizacao/localizacao-publica.js';
import { criarAppDeTeste } from './app.js';
import { criarPrismaDeTeste, limparBanco } from './banco.js';
import { criarCasinha, criarUsuario } from './fabricas.js';

const PRACA_DA_SE: Ponto = { lat: -23.5505, lng: -46.6333 };
/** Área de ~11 km em volta da Praça da Sé: cobre as casinhas de teste. */
const AREA_SP = { minLat: -23.6, maxLat: -23.5, minLng: -46.7, maxLng: -46.6 };
const RIO: Ponto = { lat: -22.9068, lng: -43.1729 };

type Auth = Record<string, string>;

describe('casinhas: leitura e localização protegida (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let jwt: JwtService;

  const http = () => request(app.getHttpServer());

  /** Usuário com cadastro concluído e o header de autorização dele. */
  async function entrar(nivel: NivelAcesso = 'colaborador') {
    const { perfil, usuario } = await criarUsuario(prisma, { nivel });
    const token = await jwt.signAsync({ sub: usuario.id });
    return { perfil, auth: { Authorization: `Bearer ${token}` } };
  }

  const buscarArea = (auth: Auth, area: object = AREA_SP) =>
    http().get('/v1/casinhas').query(area).set(auth);

  async function adotar(casinhaId: string, usuarioId: string, ativa = true) {
    await prisma.adocao.create({
      data: { casinhaId, usuarioId, ativa, encerradaEm: ativa ? null : new Date() },
    });
  }

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

  describe('acesso (D01: o mapa exige login)', () => {
    it.each(['/v1/casinhas', `/v1/casinhas/${randomUUID()}`, '/v1/me/casinhas'])(
      'visitante sem token: 401 em %s',
      async (rota) => {
        await http().get(rota).query(AREA_SP).expect(401);
      },
    );

    it('cadastro pendente: 403', async () => {
      const usuario = await prisma.usuario.create({ data: { email: 'pendente@teste.test' } });
      const token = await jwt.signAsync({ sub: usuario.id });
      const resposta = await buscarArea({ Authorization: `Bearer ${token}` }).expect(403);
      expect(resposta.body.codigo).toBe('cadastro_pendente');
    });

    it('conta bloqueada: 403', async () => {
      const { perfil, auth } = await entrar();
      await prisma.perfil.update({
        where: { id: perfil.id },
        data: { bloqueadoAte: new Date(Date.now() + 86_400_000) },
      });
      const resposta = await buscarArea(auth).expect(403);
      expect(resposta.body.codigo).toBe('conta_bloqueada');
    });
  });

  describe('GET /casinhas (área do mapa)', () => {
    it.each([
      ['sem parâmetros', {}],
      ['latitude fora da faixa', { ...AREA_SP, maxLat: 91 }],
      ['longitude fora da faixa', { ...AREA_SP, minLng: -181 }],
      ['texto no lugar de número', { ...AREA_SP, minLat: 'abc' }],
      ['parâmetro desconhecido', { ...AREA_SP, raio: 10 }],
    ])('400 com %s', async (_caso, area) => {
      const { auth } = await entrar();
      await buscarArea(auth, area).expect(400);
    });

    it('400 area_invalida quando o mínimo passa do máximo', async () => {
      const { auth } = await entrar();
      const resposta = await buscarArea(auth, { ...AREA_SP, minLat: -23.4 }).expect(400);
      expect(resposta.body.codigo).toBe('area_invalida');
    });

    it('colaborador recebe só a pública, a 150–400 m da exata, sem campos internos', async () => {
      const { auth } = await entrar();
      const casinha = await criarCasinha(prisma, { nome: 'Praça' });

      const { body } = await buscarArea(auth).expect(200);

      expect(body.truncado).toBe(false);
      expect(body.casinhas).toHaveLength(1);
      const [item] = body.casinhas;
      expect(item).toEqual({
        id: casinha.id,
        nome: 'Praça',
        status: 'sem_noticias',
        animais: 'ambos',
        lat: expect.any(Number),
        lng: expect.any(Number),
        exata: false,
        necessidadesAbertas: [],
      });
      expect(item.lat).toBeCloseTo(casinha.latPublica, 6);
      expect(item.lng).toBeCloseTo(casinha.lngPublica, 6);
      const deslocamento = distanciaM(PRACA_DA_SE, item);
      expect(deslocamento).toBeGreaterThan(149);
      expect(deslocamento).toBeLessThan(401);
    });

    it('só traz casinhas da área, ativas e não ocultadas', async () => {
      const { auth } = await entrar();
      const visivel = await criarCasinha(prisma);
      await criarCasinha(prisma, { situacao: 'em_revisao' });
      await criarCasinha(prisma, { exata: RIO });
      await criarCasinha(prisma, { situacao: 'inativa' });
      await criarCasinha(prisma, { moderacao: 'oculto_auto' });
      await criarCasinha(prisma, { moderacao: 'oculto_moderador' });

      const { body } = await buscarArea(auth).expect(200);

      expect(body.casinhas).toHaveLength(2);
      expect(body.casinhas.map((c: { id: string }) => c.id)).toContain(visivel.id);
    });

    it('lista só as necessidades abertas', async () => {
      const { auth } = await entrar();
      const casinha = await criarCasinha(prisma);
      const base = { casinhaId: casinha.id, criadaNoCelularEm: new Date(), expiraEm: new Date() };
      await prisma.necessidade.createMany({
        data: [
          { ...base, tipo: 'agua' },
          { ...base, tipo: 'racao', status: 'atendida' },
          { ...base, tipo: 'limpeza', status: 'expirada' },
        ],
      });

      const { body } = await buscarArea(auth).expect(200);

      expect(body.casinhas[0].necessidadesAbertas).toEqual(['agua']);
    });

    it('criador e adotante ativo veem a exata; adoção encerrada volta para a pública', async () => {
      const criador = await entrar();
      const adotante = await entrar();
      const exAdotante = await entrar();
      const casinha = await criarCasinha(prisma, { criadaPorId: criador.perfil.id });
      await adotar(casinha.id, adotante.perfil.id);
      await adotar(casinha.id, exAdotante.perfil.id, false);

      for (const quem of [criador, adotante]) {
        const { body } = await buscarArea(quem.auth).expect(200);
        expect(body.casinhas[0]).toMatchObject({ exata: true, ...PRACA_DA_SE });
      }
      const { body } = await buscarArea(exAdotante.auth).expect(200);
      expect(body.casinhas[0].exata).toBe(false);
    });

    it('moderador vê a exata de todas', async () => {
      const { auth } = await entrar('moderador');
      await criarCasinha(prisma);
      await criarCasinha(prisma);

      const { body } = await buscarArea(auth).expect(200);

      expect(body.casinhas.every((c: { exata: boolean }) => c.exata)).toBe(true);
    });

    it('verificado: a lista não gasta cota e só mostra a exata das que ele abriu hoje', async () => {
      const verificado = await entrar('verificado');
      const aberta = await criarCasinha(prisma);
      await criarCasinha(prisma);

      const antes = await buscarArea(verificado.auth).expect(200);
      expect(antes.body.casinhas.every((c: { exata: boolean }) => !c.exata)).toBe(true);
      expect(await prisma.acessoLocalizacao.count()).toBe(0);

      await http().get(`/v1/casinhas/${aberta.id}`).set(verificado.auth).expect(200);
      const depois = await buscarArea(verificado.auth).expect(200);

      const porId = new Map(depois.body.casinhas.map((c: { id: string }) => [c.id, c]));
      expect(porId.get(aberta.id)).toMatchObject({ exata: true, ...PRACA_DA_SE });
      expect(depois.body.casinhas.filter((c: { exata: boolean }) => c.exata)).toHaveLength(1);
      expect(await prisma.acessoLocalizacao.count()).toBe(1);
    });

    it('devolve no máximo 1.000 e avisa que truncou', async () => {
      const { auth } = await entrar();
      await prisma.casinha.createMany({
        data: Array.from({ length: 1_001 }, (_, i) => {
          const publica = gerarLocalizacaoPublica(PRACA_DA_SE);
          return {
            nome: `Casinha ${i}`,
            animais: 'gatos' as const,
            latPublica: publica.lat,
            lngPublica: publica.lng,
          };
        }),
      });

      const { body } = await buscarArea(auth).expect(200);

      expect(body.casinhas).toHaveLength(1_000);
      expect(body.truncado).toBe(true);
    });

    it('200 casinhas cabem em menos de 20 KB (comprimido)', async () => {
      const { auth } = await entrar();
      const casinhas = Array.from({ length: 200 }, (_, i) => {
        const publica = gerarLocalizacaoPublica(PRACA_DA_SE);
        return {
          id: randomUUID(),
          nome: `Casinha Ponto de ônibus do Rosário ${i}`,
          animais: 'ambos' as const,
          status: 'atencao' as const,
          latPublica: publica.lat,
          lngPublica: publica.lng,
        };
      });
      await prisma.casinha.createMany({ data: casinhas });
      await prisma.necessidade.createMany({
        data: casinhas.flatMap((c) =>
          (['agua', 'racao'] as const).map((tipo) => ({
            casinhaId: c.id,
            tipo,
            criadaNoCelularEm: new Date(),
            expiraEm: new Date(),
          })),
        ),
      });

      const resposta = await buscarArea(auth).expect(200);

      expect(resposta.body.casinhas).toHaveLength(200);
      // Em produção o Caddy comprime as respostas (encode gzip/zstd).
      expect(gzipSync(resposta.text).length).toBeLessThan(20 * 1024);
    });
  });

  describe('GET /casinhas/:id (detalhe)', () => {
    const detalhe = (auth: Auth, id: string) => http().get(`/v1/casinhas/${id}`).set(auth);

    it('400 com id que não é UUID e 404 com casinha inexistente', async () => {
      const { auth } = await entrar();
      await detalhe(auth, 'abc').expect(400);
      await detalhe(auth, randomUUID()).expect(404);
    });

    it('colaborador: pública, sem registro de acesso, com necessidades, adotantes e histórico', async () => {
      const { auth } = await entrar();
      const marta = await criarUsuario(prisma, { apelido: 'Marta' });
      const casinha = await criarCasinha(prisma, { criadaPorId: marta.perfil.id });
      await adotar(casinha.id, marta.perfil.id);
      const agua = await prisma.necessidade.create({
        data: {
          casinhaId: casinha.id,
          tipo: 'agua',
          urgencia: 'urgente',
          criadaNoCelularEm: new Date(),
          expiraEm: new Date(Date.now() + 86_400_000),
          validadoLocal: true,
        },
      });
      const inicio = Date.now() - 60 * 60_000;
      await prisma.atividade.createMany({
        data: Array.from({ length: 35 }, (_, i) => ({
          casinhaId: casinha.id,
          // A penúltima é o reporte da água; a mais nova (i = 34) fica sem autor: conta excluída.
          tipo: i === 33 ? ('reporte' as const) : ('check_in' as const),
          necessidadeId: i === 33 ? agua.id : null,
          usuarioId: i === 34 ? null : marta.perfil.id,
          criadaEm: new Date(inicio + i * 60_000),
          validadoLocal: true,
        })),
      });

      const { body } = await detalhe(auth, casinha.id).expect(200);

      expect(body).toMatchObject({
        id: casinha.id,
        exata: false,
        lat: expect.closeTo(casinha.latPublica, 6),
        adotantes: ['Marta'],
        minhasPermissoes: {
          editar: false,
          adotar: true,
          deixarDeAdotar: false,
          denunciar: true,
        },
      });
      expect(body.necessidadesAbertas).toEqual([
        {
          id: expect.any(String),
          tipo: 'agua',
          urgencia: 'urgente',
          observacao: null,
          criadaEm: expect.any(String),
          expiraEm: expect.any(String),
        },
      ]);
      expect(body.atividades).toHaveLength(30);
      expect(body.atividades[0].apelido).toBeNull();
      expect(body.atividades[1]).toMatchObject({
        tipo: 'reporte',
        apelido: 'Marta',
        necessidade: 'agua',
      });
      expect(body.atividades[2].necessidade).toBeNull();
      const datas = body.atividades.map((a: { criadaEm: string }) => Date.parse(a.criadaEm));
      expect(datas).toEqual([...datas].sort((a, b) => b - a));
      // Nada de proximidade nem ids internos na resposta.
      expect(JSON.stringify(body)).not.toMatch(/validadoLocal|criadaPorId|latPublica|usuarioId/);
      expect(await prisma.acessoLocalizacao.count()).toBe(0);
    });

    it('criador vê a exata sem gastar cota', async () => {
      const criador = await entrar('verificado');
      const casinha = await criarCasinha(prisma, { criadaPorId: criador.perfil.id });

      const { body } = await detalhe(criador.auth, casinha.id).expect(200);

      expect(body).toMatchObject({ exata: true, ...PRACA_DA_SE });
      expect(body.minhasPermissoes.editar).toBe(true);
      expect(await prisma.acessoLocalizacao.count()).toBe(0);
    });

    it('inativa: 404 para colaborador, visível para moderador (com a exata)', async () => {
      const colaborador = await entrar();
      const moderador = await entrar('moderador');
      const casinha = await criarCasinha(prisma, { situacao: 'inativa' });

      await detalhe(colaborador.auth, casinha.id).expect(404);
      const { body } = await detalhe(moderador.auth, casinha.id).expect(200);
      expect(body).toMatchObject({ exata: true, minhasPermissoes: { desativar: true } });
    });

    it('ocultada por denúncia: 404 para estranhos, visível para o adotante', async () => {
      const estranho = await entrar();
      const adotante = await entrar();
      const casinha = await criarCasinha(prisma, { moderacao: 'oculto_auto' });
      await adotar(casinha.id, adotante.perfil.id);

      await detalhe(estranho.auth, casinha.id).expect(404);
      const { body } = await detalhe(adotante.auth, casinha.id).expect(200);
      expect(body).toMatchObject({ exata: true, minhasPermissoes: { deixarDeAdotar: true } });
    });

    it(`verificado: ${LIMITE_EXATAS_POR_DIA} casinhas distintas por dia; a seguinte vem pública`, async () => {
      const { perfil, auth } = await entrar('verificado');
      const casinhas = [];
      for (let i = 0; i <= LIMITE_EXATAS_POR_DIA; i++) casinhas.push(await criarCasinha(prisma));

      for (const casinha of casinhas.slice(0, LIMITE_EXATAS_POR_DIA)) {
        const { body } = await detalhe(auth, casinha.id).expect(200);
        expect(body.exata).toBe(true);
      }
      const excedente = casinhas[LIMITE_EXATAS_POR_DIA];
      const { body } = await detalhe(auth, excedente.id).expect(200);
      expect(body).toMatchObject({ exata: false, lat: expect.closeTo(excedente.latPublica, 6) });

      // Rever uma já vista hoje continua exata e não conta de novo.
      const revista = await detalhe(auth, casinhas[0].id).expect(200);
      expect(revista.body.exata).toBe(true);
      const acessos = await prisma.acessoLocalizacao.findMany({ where: { usuarioId: perfil.id } });
      expect(acessos).toHaveLength(LIMITE_EXATAS_POR_DIA);
      expect(acessos.every((a) => a.dia.getTime() === diaAtual().getTime())).toBe(true);
    });

    it('verificado: pedidos simultâneos não furam o limite', async () => {
      const { auth } = await entrar('verificado');
      const casinhas = [];
      for (let i = 0; i < LIMITE_EXATAS_POR_DIA + 10; i++) {
        casinhas.push(await criarCasinha(prisma));
      }

      const respostas = await Promise.all(casinhas.map((c) => detalhe(auth, c.id).expect(200)));

      expect(respostas.filter((r) => r.body.exata)).toHaveLength(LIMITE_EXATAS_POR_DIA);
      expect(await prisma.acessoLocalizacao.count()).toBe(LIMITE_EXATAS_POR_DIA);
    });
  });

  describe('GET /me/casinhas', () => {
    it('lista as que criei ou adoto (com a exata), sem as de outros nem as inativas', async () => {
      const eu = await entrar();
      const outro = await entrar();
      const criada = await criarCasinha(prisma, { criadaPorId: eu.perfil.id, nome: 'A criada' });
      const adotada = await criarCasinha(prisma, {
        criadaPorId: outro.perfil.id,
        nome: 'B adotada',
      });
      await adotar(adotada.id, eu.perfil.id);
      await criarCasinha(prisma, { criadaPorId: outro.perfil.id });
      await criarCasinha(prisma, { criadaPorId: eu.perfil.id, situacao: 'inativa' });

      const { body } = await http().get('/v1/me/casinhas').set(eu.auth).expect(200);

      expect(body).toEqual([
        expect.objectContaining({
          id: criada.id,
          exata: true,
          souCriador: true,
          souAdotante: false,
        }),
        expect.objectContaining({
          id: adotada.id,
          exata: true,
          souCriador: false,
          souAdotante: true,
        }),
      ]);
    });
  });
});
