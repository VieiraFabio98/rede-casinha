import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';

import type { PrismaClient } from '../src/generated/prisma/client.js';
import { criarAppDeTeste } from './app.js';
import { criarPrismaDeTeste, limparBanco } from './banco.js';
import { criarCasinha, criarUsuario } from './fabricas.js';

describe('conta: contagens e exclusão (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let jwt: JwtService;

  const http = () => request(app.getHttpServer());
  const auth = async (usuarioId: string) => ({
    Authorization: `Bearer ${await jwt.signAsync({ sub: usuarioId })}`,
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

  /** Marta: criou e adota uma casinha, reportou, atendeu, fez check-in, enviou foto e denunciou. */
  async function montarMarta() {
    const { usuario, perfil } = await criarUsuario(prisma, { apelido: 'Marta' });
    const casinha = await criarCasinha(prisma, { criadaPorId: perfil.id });
    await prisma.adocao.create({ data: { casinhaId: casinha.id, usuarioId: perfil.id } });
    const necessidade = await prisma.necessidade.create({
      data: {
        casinhaId: casinha.id,
        tipo: 'agua',
        criadaPorId: perfil.id,
        atendidaPorId: perfil.id,
        status: 'atendida',
        atendidaEm: new Date(),
        criadaNoCelularEm: new Date(),
        expiraEm: new Date(),
      },
    });
    await prisma.atividade.createMany({
      data: [
        {
          casinhaId: casinha.id,
          tipo: 'reporte',
          usuarioId: perfil.id,
          necessidadeId: necessidade.id,
        },
        {
          casinhaId: casinha.id,
          tipo: 'atendimento',
          usuarioId: perfil.id,
          necessidadeId: necessidade.id,
        },
        { casinhaId: casinha.id, tipo: 'check_in', usuarioId: perfil.id },
        { casinhaId: casinha.id, tipo: 'adocao', usuarioId: perfil.id },
      ],
    });
    await prisma.foto.create({
      data: {
        casinhaId: casinha.id,
        chave: 'fotos/x.jpg',
        chaveMiniatura: 'fotos/x-min.jpg',
        enviadaPorId: perfil.id,
      },
    });
    const outra = await criarCasinha(prisma);
    await prisma.denuncia.create({
      data: { alvoTipo: 'casinha', alvoId: outra.id, motivo: 'falsa', denuncianteId: perfil.id },
    });
    await prisma.sessao.create({
      data: { usuarioId: usuario.id, refreshHash: 'h1', expiraEm: new Date(Date.now() + 1e9) },
    });
    await prisma.codigoEmail.create({
      data: { email: usuario.email, codigoHash: 'x', expiraEm: new Date(Date.now() + 1e6) },
    });
    return { usuario, perfil, casinha, necessidade };
  }

  it('GET /me/contagens: contribuições, atendimentos e casinhas adotadas', async () => {
    const { usuario } = await montarMarta();

    const { body } = await http()
      .get('/v1/me/contagens')
      .set(await auth(usuario.id))
      .expect(200);

    // reporte + atendimento + check-in (adoção não conta como contribuição).
    expect(body).toEqual({ contribuicoes: 3, atendimentos: 1, casinhasAdotadas: 1 });
  });

  it('DELETE /me apaga a conta e deixa o histórico da casinha como "Usuário removido"', async () => {
    const { usuario, casinha, necessidade } = await montarMarta();
    const token = await auth(usuario.id);

    await http().delete('/v1/me').set(token).expect(204);

    // Apagados.
    expect(await prisma.usuario.count({ where: { id: usuario.id } })).toBe(0);
    expect(await prisma.perfil.count({ where: { id: usuario.id } })).toBe(0);
    expect(await prisma.sessao.count()).toBe(0);
    expect(await prisma.adocao.count()).toBe(0);
    expect(await prisma.foto.count()).toBe(0);
    expect(await prisma.codigoEmail.count({ where: { email: usuario.email } })).toBe(0);
    // Mantidos, sem autor.
    expect(await prisma.atividade.count({ where: { casinhaId: casinha.id } })).toBe(4);
    expect(await prisma.atividade.count({ where: { usuarioId: { not: null } } })).toBe(0);
    expect(
      await prisma.necessidade.findUniqueOrThrow({ where: { id: necessidade.id } }),
    ).toMatchObject({
      criadaPorId: null,
      atendidaPorId: null,
    });
    expect(await prisma.casinha.findUniqueOrThrow({ where: { id: casinha.id } })).toMatchObject({
      criadaPorId: null,
    });
    expect(await prisma.denuncia.findFirstOrThrow()).toMatchObject({ denuncianteId: null });

    // Quem abre a casinha vê "Usuário removido" (apelido null) no histórico.
    const { usuario: outro } = await criarUsuario(prisma);
    const { body } = await http()
      .get(`/v1/casinhas/${casinha.id}`)
      .set(await auth(outro.id))
      .expect(200);
    expect(body.atividades.every((a: { apelido: string | null }) => a.apelido === null)).toBe(true);

    // O token antigo não serve para mais nada.
    await http().get('/v1/me').set(token).expect(404);
    await http().delete('/v1/me').set(token).expect(404);
  });

  it('dá para excluir com cadastro pendente e com a conta bloqueada', async () => {
    const pendente = await prisma.usuario.create({ data: { email: 'pendente@teste.test' } });
    await http()
      .delete('/v1/me')
      .set(await auth(pendente.id))
      .expect(204);

    const { usuario, perfil } = await criarUsuario(prisma);
    await prisma.perfil.update({
      where: { id: perfil.id },
      data: { bloqueadoAte: new Date(Date.now() + 1e9) },
    });
    await http()
      .delete('/v1/me')
      .set(await auth(usuario.id))
      .expect(204);
    expect(await prisma.usuario.count()).toBe(0);
  });

  it('sem login: 401', async () => {
    await http().delete('/v1/me').expect(401);
  });
});
