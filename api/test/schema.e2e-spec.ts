import { NivelAcesso, type PrismaClient } from '../src/generated/prisma/client.js';
import { criarPrismaDeTeste, limparBanco } from './banco.js';
import { criarCasinha, criarUsuario } from './fabricas.js';

/** Garante que as regras que dependem do banco (índices parciais, CHECKs, FKs) existem. */
describe('schema do banco (e2e)', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = criarPrismaDeTeste();
    await limparBanco(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const agora = () => new Date();
  const umDia = () => new Date(Date.now() + 24 * 60 * 60 * 1000);

  describe('necessidades (RN02: uma aberta por tipo e casinha)', () => {
    it('recusa duas necessidades ABERTAS do mesmo tipo na mesma casinha', async () => {
      const casinha = await criarCasinha(prisma);
      const base = {
        casinhaId: casinha.id,
        tipo: 'agua' as const,
        criadaNoCelularEm: agora(),
        expiraEm: umDia(),
      };

      await prisma.necessidade.create({ data: base });
      await expect(prisma.necessidade.create({ data: base })).rejects.toMatchObject({
        code: 'P2002',
      });
    });

    it('aceita uma nova aberta quando a anterior do mesmo tipo já foi atendida', async () => {
      const casinha = await criarCasinha(prisma);
      const base = {
        casinhaId: casinha.id,
        tipo: 'racao' as const,
        criadaNoCelularEm: agora(),
        expiraEm: umDia(),
      };

      await prisma.necessidade.create({
        data: { ...base, status: 'atendida', atendidaEm: agora() },
      });
      await expect(prisma.necessidade.create({ data: base })).resolves.toMatchObject({
        status: 'aberta',
      });
    });

    it('aceita tipos diferentes abertos na mesma casinha', async () => {
      const casinha = await criarCasinha(prisma);
      const base = { casinhaId: casinha.id, criadaNoCelularEm: agora(), expiraEm: umDia() };

      await prisma.necessidade.create({ data: { ...base, tipo: 'agua' } });
      await expect(
        prisma.necessidade.create({ data: { ...base, tipo: 'cobertas' } }),
      ).resolves.toBeDefined();
    });
  });

  describe('adoções', () => {
    it('recusa duas adoções ATIVAS do mesmo usuário na mesma casinha', async () => {
      const { perfil } = await criarUsuario(prisma);
      const casinha = await criarCasinha(prisma);

      await prisma.adocao.create({ data: { casinhaId: casinha.id, usuarioId: perfil.id } });
      await expect(
        prisma.adocao.create({ data: { casinhaId: casinha.id, usuarioId: perfil.id } }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });

    it('permite adotar de novo depois de encerrar a adoção anterior', async () => {
      const { perfil } = await criarUsuario(prisma);
      const casinha = await criarCasinha(prisma);
      const dados = { casinhaId: casinha.id, usuarioId: perfil.id };

      await prisma.adocao.create({ data: { ...dados, ativa: false, encerradaEm: agora() } });
      await expect(prisma.adocao.create({ data: dados })).resolves.toMatchObject({ ativa: true });
    });

    it('recusa adoção encerrada sem data de encerramento (CHECK)', async () => {
      const { perfil } = await criarUsuario(prisma);
      const casinha = await criarCasinha(prisma);

      await expect(
        prisma.adocao.create({
          data: { casinhaId: casinha.id, usuarioId: perfil.id, ativa: false },
        }),
      ).rejects.toThrow(/adocoes_encerramento_coerente/);
    });
  });

  describe('casinhas', () => {
    it('recusa coordenadas fora da faixa válida (CHECK)', async () => {
      await expect(
        prisma.casinha.create({
          data: { nome: 'Inválida', animais: 'caes', latPublica: 91, lngPublica: 0 },
        }),
      ).rejects.toThrow(/casinhas_coordenadas_validas/);
    });

    it('apaga a localização exata junto com a casinha', async () => {
      const casinha = await criarCasinha(prisma);
      await prisma.casinha.delete({ where: { id: casinha.id } });

      await expect(
        prisma.casinhaLocalizacao.findUnique({ where: { casinhaId: casinha.id } }),
      ).resolves.toBeNull();
    });
  });

  describe('perfis', () => {
    it('recusa apelidos que só diferem em maiúsculas ou acentos', async () => {
      await criarUsuario(prisma, { apelido: 'Márcia' });
      await expect(criarUsuario(prisma, { apelido: 'marcia' })).rejects.toMatchObject({
        code: 'P2002',
      });
    });

    it('ao excluir a conta, as contribuições ficam anônimas (FKs com SET NULL)', async () => {
      const { usuario, perfil } = await criarUsuario(prisma, { nivel: NivelAcesso.colaborador });
      const casinha = await criarCasinha(prisma, { criadaPorId: perfil.id });
      await prisma.adocao.create({ data: { casinhaId: casinha.id, usuarioId: perfil.id } });

      await prisma.usuario.delete({ where: { id: usuario.id } });

      await expect(prisma.perfil.findUnique({ where: { id: perfil.id } })).resolves.toBeNull();
      await expect(prisma.casinha.findUnique({ where: { id: casinha.id } })).resolves.toMatchObject(
        {
          criadaPorId: null,
        },
      );
      await expect(prisma.adocao.count({ where: { usuarioId: perfil.id } })).resolves.toBe(0);
    });
  });
});
