import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';

import { destino, type Ponto } from '../src/shared/domain/geo.js';
import { diaAtual } from '../src/shared/domain/tempo.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { LIMITES } from '../src/modulos/limites/domain/limites.js';
import { criarAppDeTeste } from './app.js';
import { criarPrismaDeTeste, limparBanco } from './banco.js';
import { criarCasinha, criarUsuario } from './fabricas.js';
import { listarRotas } from './rotas.js';

const PRACA_DA_SE: Ponto = { lat: -23.5505, lng: -46.6333 };

/**
 * Rotas abertas sem login. Mudou esta lista? Revise antes: toda leitura de casinha exige login
 * (D01) e as fotos só abrem com URL assinada.
 */
const ROTAS_PUBLICAS = [
  'GET /fotos/:id',
  'GET /fotos/:id/miniatura',
  'GET /saude',
  'POST /auth/codigo',
  'POST /auth/codigo/verificar',
  'POST /auth/google',
  'POST /auth/renovar',
  'POST /auth/sair',
  'POST /auth/senha',
];

/**
 * Rotas que pedem só o token, sem `@Nivel()`: funcionam com cadastro pendente e conta bloqueada.
 * Só a própria conta (ver, concluir o cadastro, excluir). Todo o resto exige `@Nivel()`.
 */
const ROTAS_SO_COM_TOKEN = ['DELETE /me', 'GET /me', 'GET /me/contagens', 'POST /me/cadastro'];

describe('segurança (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let jwt: JwtService;

  const http = () => request(app.getHttpServer());

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

  describe('rotas', () => {
    const rotas = () => listarRotas(app);

    it('só as rotas revisadas são públicas', () => {
      expect(
        rotas()
          .filter((r) => r.publica)
          .map((r) => r.rota),
      ).toEqual(ROTAS_PUBLICAS);
    });

    it('fora as da própria conta, toda rota com login exige cadastro concluído e conta ativa (@Nivel)', () => {
      expect(
        rotas()
          .filter((r) => !r.publica && r.nivel === null)
          .map((r) => r.rota),
      ).toEqual(ROTAS_SO_COM_TOKEN);
    });

    it('toda rota /admin exige moderador', () => {
      const admin = rotas().filter((r) => r.rota.split(' ')[1].startsWith('/admin'));
      expect(admin.length).toBeGreaterThan(0);
      expect(admin.filter((r) => r.nivel !== 'moderador')).toEqual([]);
    });
  });

  describe('HTTP', () => {
    it('cabeçalhos de segurança (helmet) e sem X-Powered-By', async () => {
      const { headers } = await http().get('/saude').expect(200);
      expect(headers).toMatchObject({
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'SAMEORIGIN',
        'strict-transport-security': expect.stringContaining('max-age='),
      });
      expect(headers['x-powered-by']).toBeUndefined();
    });

    it('CORS só para os sites da lista (CORS_ORIGENS)', async () => {
      const liberado = await http().get('/saude').set('Origin', 'https://site.teste').expect(200);
      expect(liberado.headers['access-control-allow-origin']).toBe('https://site.teste');

      const outro = await http().get('/saude').set('Origin', 'https://malicioso.teste');
      expect(outro.headers['access-control-allow-origin']).toBeUndefined();

      const preflight = await http()
        .options('/v1/me')
        .set('Origin', 'https://malicioso.teste')
        .set('Access-Control-Request-Method', 'DELETE');
      expect(preflight.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('corpo com campo a mais é recusado (whitelist dos DTOs)', async () => {
      const { usuario } = await criarUsuario(prisma);
      const auth = { Authorization: `Bearer ${await jwt.signAsync({ sub: usuario.id })}` };
      const casinha = await criarCasinha(prisma);
      await http()
        .post(`/v1/casinhas/${casinha.id}/check-in`)
        .set(auth)
        .send({ atividadeId: randomUUID(), status: 'ok' })
        .expect(400);
    });
  });

  describe('limites (RN06)', () => {
    it('pedidos simultâneos não furam o limite: de 12 cadastros ao mesmo tempo, passam 5', async () => {
      const { usuario } = await criarUsuario(prisma);
      const auth = { Authorization: `Bearer ${await jwt.signAsync({ sub: usuario.id })}` };

      const respostas = await Promise.all(
        Array.from({ length: 12 }, (_, i) =>
          http()
            .post('/v1/casinhas')
            .set(auth)
            .send({
              id: randomUUID(),
              nome: `Casinha ${i}`,
              animais: 'ambos',
              ...destino(PRACA_DA_SE, 1000 * (i + 1), 0),
              precisaoM: 10,
            }),
        ),
      );

      const status = respostas.map((r) => r.status).sort();
      expect(status.filter((s) => s === 200)).toHaveLength(5);
      expect(status.filter((s) => s === 403)).toHaveLength(7);
      expect(await prisma.casinha.count()).toBe(5);
      // Os recusados não contam: a transação deles foi desfeita.
      expect(await prisma.limiteUso.findFirstOrThrow()).toMatchObject({ quantidade: 5 });
    });

    it('contestar conta como contribuição', async () => {
      const { usuario, perfil } = await criarUsuario(prisma);
      const auth = { Authorization: `Bearer ${await jwt.signAsync({ sub: usuario.id })}` };
      const casinha = await criarCasinha(prisma);
      const agora = new Date();
      const necessidade = await prisma.necessidade.create({
        data: {
          casinhaId: casinha.id,
          tipo: 'agua',
          status: 'atendida',
          criadaNoCelularEm: agora,
          expiraEm: agora,
          atendidaEm: agora,
          atendidaPorId: perfil.id,
        },
      });
      await prisma.limiteUso.create({
        data: {
          usuarioId: perfil.id,
          acao: 'contribuicoes',
          dia: diaAtual(agora),
          quantidade: LIMITES.contribuicoes,
        },
      });

      const { body } = await http()
        .post(`/v1/necessidades/${necessidade.id}/contestar`)
        .set(auth)
        .send({ atividadeId: randomUUID(), observacao: 'Continua sem água' })
        .expect(403);

      expect(body.codigo).toBe('limite_diario');
      expect(
        await prisma.necessidade.findUniqueOrThrow({ where: { id: necessidade.id } }),
      ).toMatchObject({ status: 'atendida' });
    });
  });
});
