import type { INestApplication } from '@nestjs/common';
import { hash } from '@node-rs/argon2';
import request from 'supertest';

import { VERSAO_TERMOS } from '../src/config/termos.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import type { EmailMemoria } from '../src/shared/infra/email/email.service.js';
import { criarAppDeTeste, tokenGoogle } from './app.js';
import { criarPrismaDeTeste, limparBanco } from './banco.js';

describe('autenticação (e2e)', () => {
  let app: INestApplication;
  let emails: EmailMemoria;
  let prisma: PrismaClient;
  let contador = 0;

  const http = () => request(app.getHttpServer());
  const novoEmail = () => `pessoa${++contador}@teste.test`;
  const codigoEnviadoPara = (email: string) =>
    emails.ultimoPara(email)?.texto.match(/\b(\d{6})\b/)?.[1] ?? '';

  async function entrarComCodigo(email = novoEmail()) {
    await http().post('/v1/auth/codigo').send({ email }).expect(202);
    const resposta = await http()
      .post('/v1/auth/codigo/verificar')
      .send({ email, codigo: codigoEnviadoPara(email) })
      .expect(200);
    return { email, tokens: resposta.body };
  }

  beforeAll(async () => {
    prisma = criarPrismaDeTeste();
    await limparBanco(prisma);
    ({ app, emails } = await criarAppDeTeste());
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('código por e-mail', () => {
    it('envia o código e cria a conta no primeiro acesso', async () => {
      const { email, tokens } = await entrarComCodigo();

      expect(tokens).toMatchObject({ precisaCadastro: true });
      expect(tokens.acesso).toEqual(expect.any(String));
      expect(tokens.refresh).toEqual(expect.any(String));
      const usuario = await prisma.usuario.findUnique({ where: { email } });
      expect(usuario?.emailVerificadoEm).toBeInstanceOf(Date);
    });

    it('guarda o código só como hash', async () => {
      const email = novoEmail();
      await http().post('/v1/auth/codigo').send({ email }).expect(202);
      const registro = await prisma.codigoEmail.findFirstOrThrow({ where: { email } });

      expect(registro.codigoHash).not.toContain(codigoEnviadoPara(email));
      expect(registro.codigoHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('normaliza o e-mail (maiúsculas e espaços)', async () => {
      const email = novoEmail();
      await http()
        .post('/v1/auth/codigo')
        .send({ email: `  ${email.toUpperCase()} ` })
        .expect(202);
      await http()
        .post('/v1/auth/codigo/verificar')
        .send({ email, codigo: codigoEnviadoPara(email) })
        .expect(200);
    });

    it('recusa código errado e bloqueia depois de 5 tentativas', async () => {
      const email = novoEmail();
      await http().post('/v1/auth/codigo').send({ email }).expect(202);
      const certo = codigoEnviadoPara(email);
      const errado = certo === '000000' ? '111111' : '000000';

      for (let i = 0; i < 5; i++) {
        await http().post('/v1/auth/codigo/verificar').send({ email, codigo: errado }).expect(401);
      }
      // Mesmo o código certo não vale mais: é preciso pedir outro.
      await http().post('/v1/auth/codigo/verificar').send({ email, codigo: certo }).expect(401);
    });

    it('recusa código expirado', async () => {
      const email = novoEmail();
      await http().post('/v1/auth/codigo').send({ email }).expect(202);
      await prisma.codigoEmail.updateMany({
        where: { email },
        data: { expiraEm: new Date(Date.now() - 1000) },
      });

      await http()
        .post('/v1/auth/codigo/verificar')
        .send({ email, codigo: codigoEnviadoPara(email) })
        .expect(401);
    });

    it('o código só vale uma vez', async () => {
      const email = novoEmail();
      await http().post('/v1/auth/codigo').send({ email }).expect(202);
      const codigo = codigoEnviadoPara(email);

      await http().post('/v1/auth/codigo/verificar').send({ email, codigo }).expect(200);
      await http().post('/v1/auth/codigo/verificar').send({ email, codigo }).expect(401);
    });

    it('pedir outro código antes de 1 minuto responde 429', async () => {
      const email = novoEmail();
      await http().post('/v1/auth/codigo').send({ email }).expect(202);
      await http().post('/v1/auth/codigo').send({ email }).expect(429);
    });

    it('um código novo invalida o anterior', async () => {
      const email = novoEmail();
      await http().post('/v1/auth/codigo').send({ email }).expect(202);
      const antigo = codigoEnviadoPara(email);
      // Simula que o primeiro pedido foi há 2 minutos, para poder pedir outro.
      await prisma.codigoEmail.updateMany({
        where: { email },
        data: { criadoEm: new Date(Date.now() - 120_000) },
      });
      await http().post('/v1/auth/codigo').send({ email }).expect(202);
      const novo = codigoEnviadoPara(email);

      if (antigo !== novo) {
        await http().post('/v1/auth/codigo/verificar').send({ email, codigo: antigo }).expect(401);
      }
      await http().post('/v1/auth/codigo/verificar').send({ email, codigo: novo }).expect(200);
    });

    it('valida o formato do e-mail e do código', async () => {
      await http().post('/v1/auth/codigo').send({ email: 'nao-e-email' }).expect(400);
      await http()
        .post('/v1/auth/codigo/verificar')
        .send({ email: novoEmail(), codigo: '12ab56' })
        .expect(400);
    });
  });

  describe('Google', () => {
    it('cria a conta no primeiro login', async () => {
      const email = novoEmail();
      const resposta = await http()
        .post('/v1/auth/google')
        .send({ idToken: tokenGoogle({ sub: 'google-1', email }) })
        .expect(200);

      expect(resposta.body.precisaCadastro).toBe(true);
      await expect(prisma.usuario.findUnique({ where: { email } })).resolves.toMatchObject({
        googleSub: 'google-1',
      });
    });

    it('vincula à conta que já existia com o mesmo e-mail', async () => {
      const { email } = await entrarComCodigo();
      await http()
        .post('/v1/auth/google')
        .send({ idToken: tokenGoogle({ sub: 'google-2', email }) })
        .expect(200);

      expect(await prisma.usuario.count({ where: { email } })).toBe(1);
      await expect(prisma.usuario.findUnique({ where: { email } })).resolves.toMatchObject({
        googleSub: 'google-2',
      });
    });

    it('não vincula um e-mail que já pertence a outra conta Google', async () => {
      const email = novoEmail();
      await http()
        .post('/v1/auth/google')
        .send({ idToken: tokenGoogle({ sub: 'google-3', email }) })
        .expect(200);
      await http()
        .post('/v1/auth/google')
        .send({ idToken: tokenGoogle({ sub: 'google-4', email }) })
        .expect(401);
    });

    it('recusa e-mail não verificado pelo Google e token inválido', async () => {
      await http()
        .post('/v1/auth/google')
        .send({
          idToken: tokenGoogle({ sub: 'google-5', email: novoEmail(), emailVerificado: false }),
        })
        .expect(401);
      await http().post('/v1/auth/google').send({ idToken: 'lixo' }).expect(401);
    });
  });

  describe('senha (conta do revisor)', () => {
    it('entra com a senha certa e recusa a errada', async () => {
      const email = novoEmail();
      await prisma.usuario.create({
        data: { email, senhaHash: await hash('uma-senha-bem-longa') },
      });

      await http().post('/v1/auth/senha').send({ email, senha: 'uma-senha-bem-longa' }).expect(200);
      await http().post('/v1/auth/senha').send({ email, senha: 'errada' }).expect(401);
    });

    it('conta sem senha não entra por senha', async () => {
      const { email } = await entrarComCodigo();
      await http().post('/v1/auth/senha').send({ email, senha: 'qualquer-coisa' }).expect(401);
    });
  });

  describe('sessões', () => {
    it('renova: devolve um par novo e o refresh antigo deixa de valer', async () => {
      const { tokens } = await entrarComCodigo();
      const renovado = await http()
        .post('/v1/auth/renovar')
        .send({ refresh: tokens.refresh })
        .expect(200);

      expect(renovado.body.refresh).not.toBe(tokens.refresh);
      await http().get('/v1/me').set('Authorization', `Bearer ${renovado.body.acesso}`).expect(200);
    });

    it('reusar um refresh já trocado revoga todas as sessões (suspeita de roubo)', async () => {
      const { tokens } = await entrarComCodigo();
      const renovado = await http()
        .post('/v1/auth/renovar')
        .send({ refresh: tokens.refresh })
        .expect(200);

      await http().post('/v1/auth/renovar').send({ refresh: tokens.refresh }).expect(401);
      // O refresh legítimo mais recente também caiu.
      await http().post('/v1/auth/renovar').send({ refresh: renovado.body.refresh }).expect(401);
    });

    it('renovações simultâneas do mesmo refresh: só uma passa', async () => {
      const { tokens } = await entrarComCodigo();
      const respostas = await Promise.all([
        http().post('/v1/auth/renovar').send({ refresh: tokens.refresh }),
        http().post('/v1/auth/renovar').send({ refresh: tokens.refresh }),
      ]);

      expect(respostas.filter((r) => r.status === 200).length).toBeLessThanOrEqual(1);
    });

    it('sair revoga a sessão', async () => {
      const { tokens } = await entrarComCodigo();
      await http().post('/v1/auth/sair').send({ refresh: tokens.refresh }).expect(204);
      await http().post('/v1/auth/renovar').send({ refresh: tokens.refresh }).expect(401);
    });

    it('refresh expirado ou desconhecido responde 401', async () => {
      const { tokens } = await entrarComCodigo();
      await prisma.sessao.updateMany({
        data: { expiraEm: new Date(Date.now() - 1000) },
        where: { revogadaEm: null },
      });

      await http().post('/v1/auth/renovar').send({ refresh: tokens.refresh }).expect(401);
      await http().post('/v1/auth/renovar').send({ refresh: 'desconhecido' }).expect(401);
    });

    it('guarda o refresh só como hash', async () => {
      const { tokens } = await entrarComCodigo();
      expect(await prisma.sessao.count({ where: { refreshHash: tokens.refresh } })).toBe(0);
    });
  });

  describe('guard de acesso', () => {
    it('rota protegida sem token responde 401', async () => {
      await http().get('/v1/me').expect(401);
    });

    it('token adulterado responde 401', async () => {
      const { tokens } = await entrarComCodigo();
      const adulterado = `${tokens.acesso.slice(0, -2)}xx`;
      await http().get('/v1/me').set('Authorization', `Bearer ${adulterado}`).expect(401);
    });

    it('rota pública funciona sem token', async () => {
      await http().get('/saude').expect(200);
    });
  });

  describe('cadastro', () => {
    const cadastro = (apelido: string) => ({
      apelido,
      maiorDeIdade: true,
      termosVersao: VERSAO_TERMOS,
    });

    it('GET /me mostra perfil null até concluir o cadastro', async () => {
      const { email, tokens } = await entrarComCodigo();
      const resposta = await http()
        .get('/v1/me')
        .set('Authorization', `Bearer ${tokens.acesso}`)
        .expect(200);
      expect(resposta.body).toMatchObject({ email, perfil: null });
    });

    it('conclui o cadastro e depois o login já não pede cadastro', async () => {
      const { email, tokens } = await entrarComCodigo();
      const auth = `Bearer ${tokens.acesso}`;

      const perfil = await http()
        .post('/v1/me/cadastro')
        .set('Authorization', auth)
        .send(cadastro('Dona Marta'))
        .expect(201);
      expect(perfil.body).toMatchObject({ apelido: 'Dona Marta', nivel: 'colaborador' });

      await http()
        .post('/v1/me/cadastro')
        .set('Authorization', auth)
        .send(cadastro('Outro Nome'))
        .expect(409);
      const renovado = await http()
        .post('/v1/auth/renovar')
        .send({ refresh: tokens.refresh })
        .expect(200);
      expect(renovado.body.precisaCadastro).toBe(false);
      expect(email).toBeDefined();
    });

    it('recusa apelido já usado, mesmo com maiúsculas e acentos diferentes', async () => {
      const a = await entrarComCodigo();
      const b = await entrarComCodigo();
      await http()
        .post('/v1/me/cadastro')
        .set('Authorization', `Bearer ${a.tokens.acesso}`)
        .send(cadastro('Protetora Zélia'))
        .expect(201);

      const resposta = await http()
        .post('/v1/me/cadastro')
        .set('Authorization', `Bearer ${b.tokens.acesso}`)
        .send(cadastro('protetora zelia'))
        .expect(409);
      expect(resposta.body.codigo).toBe('apelido_em_uso');
    });

    it.each([
      ['menor de 18', { apelido: 'Lucas', maiorDeIdade: false, termosVersao: VERSAO_TERMOS }],
      [
        'termos desatualizados',
        { apelido: 'Lucas', maiorDeIdade: true, termosVersao: '2020-01-01' },
      ],
      ['apelido curto', { apelido: 'Lu', maiorDeIdade: true, termosVersao: VERSAO_TERMOS }],
      [
        'apelido com telefone',
        { apelido: 'Lucas 11987654321', maiorDeIdade: true, termosVersao: VERSAO_TERMOS },
      ],
      [
        'apelido com e-mail',
        { apelido: 'lucas@x.com', maiorDeIdade: true, termosVersao: VERSAO_TERMOS },
      ],
      [
        'campo extra',
        { apelido: 'Lucas', maiorDeIdade: true, termosVersao: VERSAO_TERMOS, nivel: 'admin' },
      ],
    ])('recusa com 400: %s', async (_caso, corpo) => {
      const { tokens } = await entrarComCodigo();
      await http()
        .post('/v1/me/cadastro')
        .set('Authorization', `Bearer ${tokens.acesso}`)
        .send(corpo)
        .expect(400);
    });
  });
});
