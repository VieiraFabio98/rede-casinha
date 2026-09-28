import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';

import { destino, type Ponto } from '../src/shared/domain/geo.js';
import type { NivelAcesso, PrismaClient } from '../src/generated/prisma/client.js';
import { LIMITES } from '../src/modulos/limites/domain/limites.js';
import { criarAppDeTeste } from './app.js';
import { criarPrismaDeTeste, limparBanco } from './banco.js';
import { criarCasinha, criarUsuario } from './fabricas.js';

const DIA = 24 * 60 * 60 * 1000;
const PRACA_DA_SE: Ponto = { lat: -23.5505, lng: -46.6333 };

type Auth = Record<string, string>;

describe('denúncias e moderação (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let jwt: JwtService;

  const http = () => request(app.getHttpServer());

  /** `idadeDias`: idade da conta (só contas com ≥ 7 dias contam para a ocultação automática). */
  async function entrar(nivel: NivelAcesso = 'colaborador', idadeDias = 30) {
    const { perfil, usuario } = await criarUsuario(prisma, { nivel });
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { criadoEm: new Date(Date.now() - idadeDias * DIA) },
    });
    const token = await jwt.signAsync({ sub: usuario.id });
    return { perfil, auth: { Authorization: `Bearer ${token}` } as Auth };
  }

  const denunciar = (auth: Auth, corpo: object) =>
    http()
      .post('/v1/denuncias')
      .set(auth)
      .send({ motivo: 'falsa', ...corpo });

  const admin = (auth: Auth, metodo: 'get' | 'post', caminho: string, corpo?: object) =>
    http()[metodo](`/v1/admin${caminho}`).set(auth).send(corpo);

  const necessidade = (casinhaId: string, tipo: 'agua' | 'racao' = 'agua') =>
    prisma.necessidade.create({
      data: {
        casinhaId,
        tipo,
        criadaNoCelularEm: new Date(),
        expiraEm: new Date(Date.now() + DIA),
      },
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

  describe('POST /denuncias', () => {
    it('registra; repetir não duplica; a resposta não diz nada sobre o alvo', async () => {
      const { auth, perfil } = await entrar();
      const casinha = await criarCasinha(prisma);
      const corpo = { alvoTipo: 'casinha', alvoId: casinha.id, descricao: ' Não existe ' };

      const r1 = await denunciar(auth, corpo).expect(200);
      await denunciar(auth, corpo).expect(200);

      expect(r1.body).toEqual({ resultado: 'ok' });
      expect(await prisma.denuncia.findMany()).toEqual([
        expect.objectContaining({
          alvoTipo: 'casinha',
          denuncianteId: perfil.id,
          descricao: 'Não existe',
          status: 'aberta',
        }),
      ]);
    });

    it('404 para alvo inexistente ou que o denunciante não vê; 400 para si mesmo', async () => {
      const { auth, perfil } = await entrar();
      const oculta = await criarCasinha(prisma, { moderacao: 'oculto_moderador' });

      await denunciar(auth, { alvoTipo: 'casinha', alvoId: randomUUID() }).expect(404);
      await denunciar(auth, { alvoTipo: 'necessidade', alvoId: randomUUID() }).expect(404);
      await denunciar(auth, { alvoTipo: 'casinha', alvoId: oculta.id }).expect(404);
      await denunciar(auth, { alvoTipo: 'perfil', alvoId: perfil.id }).expect(400);
    });

    it('3 denúncias de contas com ≥ 7 dias ocultam a casinha automaticamente', async () => {
      const casinha = await criarCasinha(prisma);
      for (let i = 0; i < 3; i++) {
        const { auth } = await entrar();
        await denunciar(auth, { alvoTipo: 'casinha', alvoId: casinha.id }).expect(200);
      }

      const oculta = await prisma.casinha.findUniqueOrThrow({ where: { id: casinha.id } });
      expect(oculta.moderacao).toBe('oculto_auto');
      expect(await prisma.acaoModeracao.findFirstOrThrow()).toMatchObject({
        moderadorId: null,
        acao: 'ocultar_auto',
        alvoId: casinha.id,
      });
      // Sai do mapa para quem não é dono nem adotante.
      const { auth } = await entrar();
      await http().get(`/v1/casinhas/${casinha.id}`).set(auth).expect(404);
    });

    it('brigada de contas novas não oculta nada', async () => {
      const casinha = await criarCasinha(prisma);
      for (let i = 0; i < 5; i++) {
        const { auth } = await entrar('colaborador', 2);
        await denunciar(auth, { alvoTipo: 'casinha', alvoId: casinha.id }).expect(200);
      }

      const ainda = await prisma.casinha.findUniqueOrThrow({ where: { id: casinha.id } });
      expect(ainda.moderacao).toBe('visivel');
      expect(await prisma.denuncia.count()).toBe(5);
    });

    it('necessidade com 3 denúncias é cancelada e sai do status da casinha', async () => {
      const casinha = await criarCasinha(prisma);
      const n = await necessidade(casinha.id);
      await prisma.casinha.update({ where: { id: casinha.id }, data: { status: 'atencao' } });
      for (let i = 0; i < 3; i++) {
        const { auth } = await entrar();
        await denunciar(auth, { alvoTipo: 'necessidade', alvoId: n.id }).expect(200);
      }

      expect((await prisma.necessidade.findUniqueOrThrow({ where: { id: n.id } })).status).toBe(
        'cancelada',
      );
      expect((await prisma.casinha.findUniqueOrThrow({ where: { id: casinha.id } })).status).toBe(
        'ok',
      );
    });

    it('perfil denunciado não é bloqueado automaticamente: só vai para a fila', async () => {
      const { perfil: alvo } = await entrar();
      for (let i = 0; i < 3; i++) {
        const { auth } = await entrar();
        await denunciar(auth, { alvoTipo: 'perfil', alvoId: alvo.id, motivo: 'ofensiva' }).expect(
          200,
        );
      }
      const depois = await prisma.perfil.findUniqueOrThrow({ where: { id: alvo.id } });
      expect(depois.bloqueadoAte).toBeNull();
      expect(await prisma.acaoModeracao.count()).toBe(0);
    });

    it(`limite de ${LIMITES.denuncias} denúncias por dia`, async () => {
      const { auth } = await entrar();
      const casinhas = await prisma.casinha.createManyAndReturn({
        data: Array.from({ length: LIMITES.denuncias + 1 }, (_, i) => ({
          nome: `C${i}`,
          animais: 'gatos' as const,
          latPublica: -23.55,
          lngPublica: -46.63,
        })),
      });
      for (const c of casinhas.slice(0, LIMITES.denuncias)) {
        await denunciar(auth, { alvoTipo: 'casinha', alvoId: c.id }).expect(200);
      }
      const r = await denunciar(auth, {
        alvoTipo: 'casinha',
        alvoId: casinhas[LIMITES.denuncias].id,
      }).expect(403);
      expect(r.body.codigo).toBe('limite_diario');
    });
  });

  describe('pedido de desativação ("a casinha não existe mais")', () => {
    it('vai para a fila; "ativar" (manter) tira da fila; idempotente pelo atividadeId', async () => {
      const { auth } = await entrar();
      const mod = await entrar('moderador');
      const casinha = await criarCasinha(prisma, { nome: 'Da praça' });
      const corpo = { atividadeId: randomUUID(), motivo: 'Retiraram a casinha' };

      await http().post(`/v1/casinhas/${casinha.id}/desativacao`).set(auth).send(corpo).expect(200);
      await http().post(`/v1/casinhas/${casinha.id}/desativacao`).set(auth).send(corpo).expect(200);

      const fila = await admin(mod.auth, 'get', '/fila').expect(200);
      expect(fila.body.pedidosDesativacao).toEqual([
        expect.objectContaining({
          casinha: expect.objectContaining({ nome: 'Da praça' }),
          motivo: 'Retiraram a casinha',
        }),
      ]);
      expect(await prisma.atividade.count({ where: { tipo: 'desativacao_pedida' } })).toBe(1);

      await admin(mod.auth, 'post', `/casinhas/${casinha.id}/ativar`, {
        motivo: 'Fui lá e ela continua no lugar',
      }).expect(200);
      const depois = await admin(mod.auth, 'get', '/fila').expect(200);
      expect(depois.body.pedidosDesativacao).toEqual([]);
    });
  });

  describe('/admin', () => {
    it('exige moderador: colaborador e verificado recebem 403', async () => {
      for (const nivel of ['colaborador', 'verificado'] as const) {
        const { auth } = await entrar(nivel);
        await admin(auth, 'get', '/fila').expect(403);
      }
    });

    it('fila: denúncias agrupadas por alvo, prioritárias primeiro; duplicatas a até 30 m', async () => {
      const mod = await entrar('moderador');
      const comum = await criarCasinha(prisma, { nome: 'Comum' });
      const perigo = await criarCasinha(prisma, {
        nome: 'Perigo',
        exata: destino(PRACA_DA_SE, 5_000, 0),
      });
      const quase = await criarCasinha(prisma, {
        nome: 'Gêmea',
        exata: destino(PRACA_DA_SE, 20, 90),
      });
      await criarCasinha(prisma, {
        nome: 'Em revisão',
        situacao: 'em_revisao',
        exata: destino(PRACA_DA_SE, 9_000, 0),
      });
      const a = await entrar();
      const b = await entrar();
      await denunciar(a.auth, { alvoTipo: 'casinha', alvoId: comum.id }).expect(200);
      await denunciar(b.auth, { alvoTipo: 'casinha', alvoId: comum.id, motivo: 'ofensiva' }).expect(
        200,
      );
      await denunciar(a.auth, {
        alvoTipo: 'casinha',
        alvoId: perigo.id,
        motivo: 'perigo_animais',
      }).expect(200);

      const { body } = await admin(mod.auth, 'get', '/fila').expect(200);

      expect(body.denuncias.map((d: { descricaoAlvo: string }) => d.descricaoAlvo)).toEqual([
        'Perigo',
        'Comum',
      ]);
      expect(body.denuncias[1]).toMatchObject({ total: 2, prioridade: false });
      expect(body.denuncias[1].motivos.sort()).toEqual(['falsa', 'ofensiva']);
      expect(body.casinhasEmRevisao.map((c: { nome: string }) => c.nome)).toEqual(['Em revisão']);
      expect(body.possiveisDuplicatas).toEqual([expect.objectContaining({ distanciaM: 20 })]);
      const par = body.possiveisDuplicatas[0];
      expect([par.a.id, par.b.id].sort()).toEqual([comum.id, quase.id].sort());
    });

    it('ocultar e restaurar casinha: denúncias viram procedentes/improcedentes; tudo registrado', async () => {
      const mod = await entrar('moderador');
      const casinha = await criarCasinha(prisma);
      const x = await entrar();
      await denunciar(x.auth, { alvoTipo: 'casinha', alvoId: casinha.id }).expect(200);
      const alvo = { alvoTipo: 'casinha', alvoId: casinha.id };

      await admin(mod.auth, 'post', '/ocultar', { ...alvo, motivo: 'Nome ofensivo' }).expect(200);
      expect(
        (await prisma.casinha.findUniqueOrThrow({ where: { id: casinha.id } })).moderacao,
      ).toBe('oculto_moderador');
      expect((await prisma.denuncia.findFirstOrThrow()).status).toBe('procedente');

      await denunciar((await entrar()).auth, alvo).expect(404); // oculta: ninguém mais vê
      await admin(mod.auth, 'post', '/restaurar', { ...alvo, motivo: 'Nome corrigido' }).expect(
        200,
      );
      expect(
        (await prisma.casinha.findUniqueOrThrow({ where: { id: casinha.id } })).moderacao,
      ).toBe('visivel');
      const acoes = await prisma.acaoModeracao.findMany({ orderBy: { criadaEm: 'asc' } });
      expect(acoes.map((a) => [a.acao, a.moderadorId, a.motivo])).toEqual([
        ['ocultar', mod.perfil.id, 'Nome ofensivo'],
        ['restaurar', mod.perfil.id, 'Nome corrigido'],
      ]);
    });

    it('ocultar/restaurar necessidade cancela e reabre; perfil não se oculta (400); motivo é obrigatório', async () => {
      const mod = await entrar('moderador');
      const casinha = await criarCasinha(prisma);
      const n = await necessidade(casinha.id);
      const alvo = { alvoTipo: 'necessidade', alvoId: n.id, motivo: 'Pedido falso' };

      await admin(mod.auth, 'post', '/ocultar', { ...alvo, motivo: '' }).expect(400);
      await admin(mod.auth, 'post', '/ocultar', alvo).expect(200);
      expect((await prisma.necessidade.findUniqueOrThrow({ where: { id: n.id } })).status).toBe(
        'cancelada',
      );
      await admin(mod.auth, 'post', '/restaurar', alvo).expect(200);
      expect((await prisma.necessidade.findUniqueOrThrow({ where: { id: n.id } })).status).toBe(
        'aberta',
      );
      await admin(mod.auth, 'post', '/ocultar', {
        alvoTipo: 'perfil',
        alvoId: mod.perfil.id,
        motivo: 'x x x',
      }).expect(400);
    });

    it('desativar tira a casinha do mapa', async () => {
      const mod = await entrar('moderador');
      const casinha = await criarCasinha(prisma);
      await admin(mod.auth, 'post', `/casinhas/${casinha.id}/desativar`, {
        motivo: 'Destruída',
      }).expect(200);
      expect((await prisma.casinha.findUniqueOrThrow({ where: { id: casinha.id } })).situacao).toBe(
        'inativa',
      );
    });

    it('mesclar leva histórico, necessidades e adotantes para o destino e desativa a origem', async () => {
      const mod = await entrar('moderador');
      const origem = await criarCasinha(prisma, { nome: 'Origem' });
      const destinoC = await criarCasinha(prisma, { nome: 'Destino' });
      const [u1, u2, u3] = await Promise.all([entrar(), entrar(), entrar()]);
      // Origem: água e ração abertas; adotada por u1 e u2. Destino: água aberta; adotada por u2 e u3.
      await necessidade(origem.id, 'agua');
      await necessidade(origem.id, 'racao');
      await necessidade(destinoC.id, 'agua');
      for (const [casinhaId, usuarioId] of [
        [origem.id, u1.perfil.id],
        [origem.id, u2.perfil.id],
        [destinoC.id, u2.perfil.id],
        [destinoC.id, u3.perfil.id],
      ]) {
        await prisma.adocao.create({ data: { casinhaId, usuarioId } });
      }
      await prisma.atividade.create({ data: { casinhaId: origem.id, tipo: 'check_in' } });

      await admin(mod.auth, 'post', `/casinhas/${origem.id}/mesclar`, {
        destinoId: destinoC.id,
        motivo: 'Mesma casinha, cadastrada duas vezes',
      }).expect(200);

      const abertas = await prisma.necessidade.findMany({
        where: { casinhaId: destinoC.id, status: 'aberta' },
      });
      expect(abertas.map((n) => n.tipo).sort()).toEqual(['agua', 'racao']);
      const adotantes = await prisma.adocao.findMany({
        where: { casinhaId: destinoC.id, ativa: true },
      });
      expect(adotantes.map((a) => a.usuarioId).sort()).toEqual(
        [u1.perfil.id, u2.perfil.id, u3.perfil.id].sort(),
      );
      expect(await prisma.atividade.count({ where: { casinhaId: origem.id } })).toBe(0);
      expect(await prisma.casinha.findUniqueOrThrow({ where: { id: origem.id } })).toMatchObject({
        situacao: 'inativa',
        mescladaEmId: destinoC.id,
      });
      expect((await prisma.casinha.findUniqueOrThrow({ where: { id: destinoC.id } })).status).toBe(
        'atencao',
      );
    });

    it('nível: moderador promove a verificado, mas só admin cria moderador', async () => {
      const mod = await entrar('moderador');
      const adm = await entrar('admin');
      const { perfil: alvo } = await entrar();

      await admin(mod.auth, 'post', `/usuarios/${alvo.id}/nivel`, {
        nivel: 'verificado',
        motivo: 'Protetora conhecida',
      }).expect(200);
      expect(await prisma.perfil.findUniqueOrThrow({ where: { id: alvo.id } })).toMatchObject({
        nivel: 'verificado',
        verificadoPorId: mod.perfil.id,
      });

      await admin(mod.auth, 'post', `/usuarios/${alvo.id}/nivel`, {
        nivel: 'moderador',
        motivo: 'Ajuda na região',
      }).expect(403);
      await admin(adm.auth, 'post', `/usuarios/${alvo.id}/nivel`, {
        nivel: 'moderador',
        motivo: 'Ajuda na região',
      }).expect(200);
      await admin(mod.auth, 'post', `/usuarios/${mod.perfil.id}/nivel`, {
        nivel: 'admin',
        motivo: 'eu mesmo',
      }).expect(400);
    });

    it('bloquear impede qualquer ação; desbloquear devolve o acesso', async () => {
      const mod = await entrar('moderador');
      const alvo = await entrar();
      const ate = new Date(Date.now() + 7 * DIA).toISOString();

      await admin(mod.auth, 'post', `/usuarios/${alvo.perfil.id}/bloqueio`, {
        ate,
        motivo: 'Atendimentos falsos',
      }).expect(200);
      const r = await http().get('/v1/me/casinhas').set(alvo.auth).expect(403);
      expect(r.body.codigo).toBe('conta_bloqueada');

      await admin(mod.auth, 'post', `/usuarios/${alvo.perfil.id}/bloqueio`, {
        ate: null,
        motivo: 'Conversamos',
      }).expect(200);
      await http().get('/v1/me/casinhas').set(alvo.auth).expect(200);
      // Moderador não bloqueia outro moderador.
      const outroMod = await entrar('moderador');
      await admin(mod.auth, 'post', `/usuarios/${outroMod.perfil.id}/bloqueio`, {
        ate,
        motivo: 'x x x',
      }).expect(403);
    });

    it('resolver uma denúncia avulsa', async () => {
      const mod = await entrar('moderador');
      const casinha = await criarCasinha(prisma);
      await denunciar((await entrar()).auth, { alvoTipo: 'casinha', alvoId: casinha.id }).expect(
        200,
      );
      const d = await prisma.denuncia.findFirstOrThrow();

      await admin(mod.auth, 'post', `/denuncias/${d.id}/resolver`, { procedente: false }).expect(
        200,
      );

      expect(await prisma.denuncia.findUniqueOrThrow({ where: { id: d.id } })).toMatchObject({
        status: 'improcedente',
        resolvidaPorId: mod.perfil.id,
      });
      const fila = await admin(mod.auth, 'get', '/fila').expect(200);
      expect(fila.body.denuncias).toEqual([]);
    });
  });
});
