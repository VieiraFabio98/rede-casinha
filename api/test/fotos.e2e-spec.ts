import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';

import type { NivelAcesso, PrismaClient } from '../src/generated/prisma/client.js';
import { LimparFotosExpiradasUseCase } from '../src/modulos/fotos/application/use-cases/limpar-fotos-expiradas.use-case.js';
import {
  Armazenamento,
  type ArmazenamentoMemoria,
} from '../src/shared/infra/armazenamento/armazenamento.service.js';
import { criarAppDeTeste, RelogioDeTeste } from './app.js';
import { criarPrismaDeTeste, limparBanco } from './banco.js';
import { criarCasinha, criarUsuario } from './fabricas.js';

type Auth = Record<string, string>;

/** Segmento JPEG: FF <marcador> <tamanho> <conteúdo>. */
const segmento = (marcador: number, conteudo: Buffer) => {
  const cabecalho = Buffer.from([0xff, marcador, 0, 0]);
  cabecalho.writeUInt16BE(conteudo.length + 2, 2);
  return Buffer.concat([cabecalho, conteudo]);
};
const JFIF = segmento(0xe0, Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0', 'latin1'));
const EXIF = segmento(0xe1, Buffer.from('Exif\0\0GPS -23.5505 -46.6333', 'latin1'));
const SOS = segmento(0xda, Buffer.from([1, 1, 0, 0, 0x3f, 0]));
const jpeg = (...meio: Buffer[]) =>
  Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    ...meio,
    SOS,
    Buffer.from([1, 2, 3]),
    Buffer.from([0xff, 0xd9]),
  ]);

/** Como vem do celular, mas com EXIF (o servidor tem que tirar). */
const FOTO = jpeg(JFIF, EXIF, segmento(0xdb, Buffer.alloc(200, 7)));
const MINIATURA = jpeg(JFIF, EXIF);

const DIA_MS = 24 * 60 * 60 * 1000;

describe('fotos (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let jwt: JwtService;
  let arquivos: ArmazenamentoMemoria;
  let relogio: RelogioDeTeste;

  const http = () => request(app.getHttpServer());

  async function entrar(nivel: NivelAcesso = 'colaborador') {
    const { perfil, usuario } = await criarUsuario(prisma, { nivel });
    const token = await jwt.signAsync({ sub: usuario.id });
    return { perfil, auth: { Authorization: `Bearer ${token}` } as Auth };
  }

  function enviar(
    auth: Auth,
    dados: { casinhaId: string; atividadeId?: string },
    opcoes: { id?: string; foto?: Buffer | null; miniatura?: Buffer | null; tipo?: string } = {},
  ) {
    const { id = randomUUID(), foto = FOTO, miniatura = MINIATURA, tipo = 'image/jpeg' } = opcoes;
    let req = http().put(`/v1/fotos/${id}`).set(auth).field('casinhaId', dados.casinhaId);
    if (dados.atividadeId) req = req.field('atividadeId', dados.atividadeId);
    if (foto) req = req.attach('foto', foto, { filename: 'foto.jpg', contentType: tipo });
    if (miniatura) {
      req = req.attach('miniatura', miniatura, { filename: 'mini.jpg', contentType: tipo });
    }
    return req;
  }

  const buscarImagem = (url: string) =>
    http()
      .get(`/v1${url}`)
      .buffer(true)
      .parse((res, fim) => {
        const partes: Buffer[] = [];
        res.on('data', (parte: Buffer) => partes.push(parte));
        res.on('end', () => fim(null, Buffer.concat(partes)));
      });

  const checkIn = (casinhaId: string, usuarioId: string) =>
    prisma.atividade.create({ data: { casinhaId, tipo: 'check_in', usuarioId } });

  beforeAll(async () => {
    prisma = criarPrismaDeTeste();
    relogio = new RelogioDeTeste();
    ({ app } = await criarAppDeTeste({ relogio }));
    jwt = app.get(JwtService);
    arquivos = app.get(Armazenamento) as ArmazenamentoMemoria;
  });

  beforeEach(async () => {
    await limparBanco(prisma);
    arquivos.arquivos.clear();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('sem login: 401', async () => {
    const casinha = await criarCasinha(prisma);
    await enviar({}, { casinhaId: casinha.id }).expect(401);
  });

  it('criador envia foto de perfil: grava sem EXIF, aparece no detalhe e abre pela URL assinada', async () => {
    const { auth, perfil } = await entrar();
    const casinha = await criarCasinha(prisma, { criadaPorId: perfil.id });
    const id = randomUUID();

    const { body } = await enviar(auth, { casinhaId: casinha.id }, { id }).expect(200);

    expect(body).toEqual({
      id,
      url: expect.stringMatching(new RegExp(`^/fotos/${id}\\?exp=\\d+&assinatura=[\\w-]{43}$`)),
      urlMiniatura: expect.stringMatching(new RegExp(`^/fotos/${id}/miniatura\\?`)),
    });
    const salva = arquivos.arquivos.get(`fotos/${casinha.id}/${id}.jpg`)!;
    expect(salva.includes('GPS')).toBe(false);
    expect(salva.length).toBe(FOTO.length - EXIF.length);
    expect(arquivos.arquivos.get(`fotos/${casinha.id}/${id}_t.jpg`)!.includes('GPS')).toBe(false);
    expect(await prisma.foto.findUniqueOrThrow({ where: { id } })).toMatchObject({
      casinhaId: casinha.id,
      atividadeId: null,
      enviadaPorId: perfil.id,
      expiraEm: null,
    });

    const detalhe = await http().get(`/v1/casinhas/${casinha.id}`).set(auth).expect(200);
    expect(detalhe.body.fotos).toEqual([body]);

    // Sem token: a URL assinada basta.
    const foto = await buscarImagem(body.url).expect(200);
    expect(foto.headers['content-type']).toBe('image/jpeg');
    expect(foto.headers['cache-control']).toMatch(/^private, max-age=\d+, immutable$/);
    expect(foto.body).toEqual(salva);
    const mini = await buscarImagem(body.urlMiniatura).expect(200);
    expect(mini.body).toEqual(arquivos.arquivos.get(`fotos/${casinha.id}/${id}_t.jpg`));
  });

  it('reenviar a mesma foto não duplica nem gasta limite; outro usuário com o mesmo id: 409', async () => {
    const { auth, perfil } = await entrar();
    const casinha = await criarCasinha(prisma, { criadaPorId: perfil.id });
    const id = randomUUID();

    await enviar(auth, { casinhaId: casinha.id }, { id }).expect(200);
    await enviar(auth, { casinhaId: casinha.id }, { id }).expect(200);

    expect(await prisma.foto.count()).toBe(1);
    expect(await prisma.limiteUso.findFirstOrThrow()).toMatchObject({
      acao: 'fotos',
      quantidade: 1,
    });

    const outro = await entrar('moderador');
    const { body } = await enviar(outro.auth, { casinhaId: casinha.id }, { id }).expect(409);
    expect(body.codigo).toBe('foto_existente');
  });

  it('foto de perfil: só criador, adotante ou moderador; até 5 por casinha', async () => {
    const criador = await entrar();
    const casinha = await criarCasinha(prisma, { criadaPorId: criador.perfil.id });

    const estranho = await entrar();
    await enviar(estranho.auth, { casinhaId: casinha.id }).expect(403);

    const adotante = await entrar();
    await prisma.adocao.create({ data: { casinhaId: casinha.id, usuarioId: adotante.perfil.id } });
    await enviar(adotante.auth, { casinhaId: casinha.id }).expect(200);

    const moderador = await entrar('moderador');
    await enviar(moderador.auth, { casinhaId: casinha.id }).expect(200);

    for (let i = 0; i < 3; i++) await enviar(criador.auth, { casinhaId: casinha.id }).expect(200);
    const { body } = await enviar(criador.auth, { casinhaId: casinha.id }).expect(409);
    expect(body.codigo).toBe('limite_fotos_casinha');

    // Casinha que não existe ou inativa.
    await enviar(criador.auth, { casinhaId: randomUUID() }).expect(404);
    const inativa = await criarCasinha(prisma, {
      criadaPorId: criador.perfil.id,
      situacao: 'inativa',
    });
    await enviar(criador.auth, { casinhaId: inativa.id }).expect(409);
  });

  it('foto de atividade: só na própria atividade, uma por atividade, expira em 90 dias', async () => {
    const { auth, perfil } = await entrar();
    const casinha = await criarCasinha(prisma);
    const minha = await checkIn(casinha.id, perfil.id);
    const id = randomUUID();

    const { body } = await enviar(
      auth,
      { casinhaId: casinha.id, atividadeId: minha.id },
      { id },
    ).expect(200);

    const foto = await prisma.foto.findUniqueOrThrow({ where: { id } });
    expect(foto.expiraEm!.getTime() - foto.criadaEm.getTime()).toBe(90 * DIA_MS);
    const detalhe = await http().get(`/v1/casinhas/${casinha.id}`).set(auth).expect(200);
    expect(detalhe.body.fotos).toEqual([]);
    expect(detalhe.body.atividades).toEqual([
      expect.objectContaining({ id: minha.id, foto: body }),
    ]);

    const segunda = await enviar(auth, { casinhaId: casinha.id, atividadeId: minha.id }).expect(
      409,
    );
    expect(segunda.body.codigo).toBe('atividade_com_foto');

    const outro = await entrar();
    const alheia = await checkIn(casinha.id, outro.perfil.id);
    await enviar(auth, { casinhaId: casinha.id, atividadeId: alheia.id }).expect(404);
    const deOutraCasinha = await checkIn((await criarCasinha(prisma)).id, perfil.id);
    await enviar(auth, { casinhaId: casinha.id, atividadeId: deOutraCasinha.id }).expect(404);
  });

  it('recusa o que não é JPEG, arquivo faltando e arquivo acima de 1 MB', async () => {
    const { auth, perfil } = await entrar();
    const casinha = await criarCasinha(prisma, { criadaPorId: perfil.id });
    const png = Buffer.from('\x89PNG\r\n\x1a\n0000', 'latin1');

    await enviar(auth, { casinhaId: casinha.id }, { foto: png }).expect(400);
    await enviar(auth, { casinhaId: casinha.id }, { tipo: 'image/png' }).expect(400);
    await enviar(auth, { casinhaId: casinha.id }, { miniatura: null }).expect(400);
    await enviar(auth, { casinhaId: 'nao-e-uuid' }).expect(400);
    const grande = jpeg(
      JFIF,
      ...Array.from({ length: 17 }, () => segmento(0xdb, Buffer.alloc(65_000))),
    );
    await enviar(auth, { casinhaId: casinha.id }, { foto: grande }).expect(413);

    expect(await prisma.foto.count()).toBe(0);
    expect(arquivos.arquivos.size).toBe(0);
  });

  it('20 fotos por dia (RN06)', async () => {
    const { auth, perfil } = await entrar();
    const casinha = await criarCasinha(prisma);
    for (let i = 0; i < 20; i++) {
      const atividade = await checkIn(casinha.id, perfil.id);
      await enviar(auth, { casinhaId: casinha.id, atividadeId: atividade.id }).expect(200);
    }
    const atividade = await checkIn(casinha.id, perfil.id);
    const { body } = await enviar(auth, {
      casinhaId: casinha.id,
      atividadeId: atividade.id,
    }).expect(403);
    expect(body.codigo).toBe('limite_diario');
  });

  it('URL adulterada, expirada ou de foto ocultada não abre', async () => {
    const { auth, perfil } = await entrar();
    const casinha = await criarCasinha(prisma, { criadaPorId: perfil.id });
    const { body } = await enviar(auth, { casinhaId: casinha.id }).expect(200);

    const outraFoto = body.url.replace(body.id, randomUUID());
    await buscarImagem(outraFoto).expect(403);
    await buscarImagem(
      body.url.replace(/exp=(\d+)/, (_: string, n: string) => `exp=${+n + 60}`),
    ).expect(403);
    // A assinatura da miniatura não abre a foto grande.
    await buscarImagem(body.urlMiniatura.replace('/miniatura', '')).expect(403);
    await buscarImagem(`/fotos/${body.id}`).expect(400);

    await prisma.foto.update({ where: { id: body.id }, data: { moderacao: 'oculto_moderador' } });
    await buscarImagem(body.url).expect(404);
    await prisma.foto.update({ where: { id: body.id }, data: { moderacao: 'visivel' } });
    await buscarImagem(body.url).expect(200);

    relogio.avancar(2 * 60 * 60 * 1000);
    const expirada = await buscarImagem(body.url).expect(403);
    expect(JSON.parse(expirada.body.toString()).codigo).toBe('url_expirada');
  });

  it('fotos de atividade somem depois de 90 dias (arquivos e registro); as de perfil ficam', async () => {
    const { auth, perfil } = await entrar();
    const casinha = await criarCasinha(prisma, { criadaPorId: perfil.id });
    const atividade = await checkIn(casinha.id, perfil.id);
    const perfilDaCasinha = await enviar(auth, { casinhaId: casinha.id }).expect(200);
    const daAtividade = await enviar(auth, {
      casinhaId: casinha.id,
      atividadeId: atividade.id,
    }).expect(200);
    const limpar = app.get(LimparFotosExpiradasUseCase);

    relogio.avancar(89 * DIA_MS);
    expect(await limpar.executar()).toBe(0);
    relogio.avancar(2 * DIA_MS);
    expect(await limpar.executar()).toBe(1);

    expect(await prisma.foto.findMany({ select: { id: true } })).toEqual([
      { id: perfilDaCasinha.body.id },
    ]);
    expect([...arquivos.arquivos.keys()].some((k) => k.includes(daAtividade.body.id))).toBe(false);
    expect(arquivos.arquivos.size).toBe(2);
  });

  it('excluir a conta apaga as fotos enviadas e os arquivos', async () => {
    const { auth, perfil } = await entrar();
    const casinha = await criarCasinha(prisma, { criadaPorId: perfil.id });
    await enviar(auth, { casinhaId: casinha.id }).expect(200);
    const outro = await entrar('moderador');
    await enviar(outro.auth, { casinhaId: casinha.id }).expect(200);
    expect(arquivos.arquivos.size).toBe(4);

    await http().delete('/v1/me').set(auth).expect(204);

    expect(await prisma.foto.count()).toBe(1);
    expect(arquivos.arquivos.size).toBe(2);
  });
});
