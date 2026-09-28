import type { Relogio } from '../../../../shared/domain/relogio.js';
import type { Transacao } from '../../../../shared/domain/transacao.js';
import type { UsuarioLogado } from '../../../../shared/domain/usuario-logado.js';
import type { NovaAtividade } from '../../domain/entities/atividade.js';
import type { StatusCasinha } from '../../domain/entities/casinha.js';
import type { Necessidade } from '../../domain/entities/necessidade.js';
import type { AtividadesRepository } from '../../domain/repositories/atividades.repository.js';
import type { CasinhasRepository } from '../../domain/repositories/casinhas.repository.js';
import type { NecessidadesRepository } from '../../domain/repositories/necessidades.repository.js';
import { AcaoNaNecessidade } from './acao-na-necessidade.js';
import { AtenderNecessidadeUseCase } from './atender-necessidade.use-case.js';
import { ExecucaoDeAcao } from './execucao-de-acao.js';

/** Use-case testado sem banco nem Nest: só as portas, com implementações em memória. */
function montar(necessidade: Necessidade) {
  const agora = new Date('2026-09-28T12:00:00Z');
  const necessidades = new Map([[necessidade.id, { ...necessidade }]]);
  const atividades: NovaAtividade[] = [];
  const chamadas: string[] = [];

  const repoNecessidades: NecessidadesRepository = {
    buscarPorId: async (id) => necessidades.get(id) ?? null,
    buscarAberta: async () => null,
    criar: async () => {},
    atualizar: async (id, mudancas) => {
      necessidades.set(id, { ...necessidades.get(id)!, ...mudancas });
    },
  };
  const repoAtividades: AtividadesRepository = {
    buscarPorId: async (id) => {
      const a = atividades.find((x) => x.id === id);
      return a ? { usuarioId: a.usuarioId, necessidadeId: a.necessidadeId ?? null } : null;
    },
    existeDoUsuarioDesde: async () => false,
    registrar: async (a) => void atividades.push(a),
  };
  const repoCasinhas: CasinhasRepository = {
    registrarVisita: async () => void chamadas.push('visita'),
    statusAtual: async () => 'atencao',
  };
  const transacao: Transacao = { executar: (trabalho) => trabalho() };
  const relogio: Relogio = { agora: () => agora };
  const statusDepois = (): StatusCasinha =>
    [...necessidades.values()].some((n) => n.status === 'aberta') ? 'atencao' : 'ok';

  const execucao = new ExecucaoDeAcao(
    transacao,
    { travarParaAcao: async () => void chamadas.push('trava') },
    repoAtividades,
    repoCasinhas,
    { recalcular: async () => statusDepois() },
  );
  const useCase = new AtenderNecessidadeUseCase(
    new AcaoNaNecessidade(execucao, repoNecessidades),
    execucao,
    repoNecessidades,
    repoAtividades,
    { estaPerto: async () => true },
    { consumirContribuicao: async () => void chamadas.push('limite') },
    relogio,
  );
  return { useCase, necessidades, atividades, chamadas, agora };
}

const aberta: Necessidade = {
  id: 'n1',
  casinhaId: 'c1',
  tipo: 'agua',
  urgencia: 'normal',
  observacao: null,
  status: 'aberta',
  criadaPorId: 'outra',
  criadaEm: new Date('2026-09-27T12:00:00Z'),
  expiraEm: new Date('2026-09-29T12:00:00Z'),
  atendidaPorId: null,
  atendidaEm: null,
};
const marta: UsuarioLogado = { id: 'marta', nivel: 'colaborador' };

describe('AtenderNecessidadeUseCase', () => {
  it('atende a necessidade aberta, registra no histórico e a casinha fica ok', async () => {
    const { useCase, necessidades, atividades, chamadas, agora } = montar(aberta);

    const r = await useCase.executar(marta, 'n1', { atividadeId: 'a1' });

    expect(r).toEqual({ resultado: 'ok', necessidadeId: 'n1', status: 'ok' });
    expect(necessidades.get('n1')).toMatchObject({
      status: 'atendida',
      atendidaPorId: 'marta',
      atendidaEm: agora,
    });
    expect(atividades).toEqual([
      expect.objectContaining({ id: 'a1', tipo: 'atendimento', validadoLocal: true }),
    ]);
    expect(chamadas).toEqual(['trava', 'limite', 'visita']);
  });

  it('já atendida: devolve ja_atendida e não muda quem atendeu (RN03)', async () => {
    const { useCase, necessidades } = montar({
      ...aberta,
      status: 'atendida',
      atendidaPorId: 'lucas',
    });

    const r = await useCase.executar(marta, 'n1', { atividadeId: 'a1' });

    expect(r.resultado).toBe('ja_atendida');
    expect(necessidades.get('n1')?.atendidaPorId).toBe('lucas');
  });

  it('reenvio do mesmo atividadeId (fila offline) não repete o efeito', async () => {
    const { useCase, atividades, chamadas } = montar(aberta);
    await useCase.executar(marta, 'n1', { atividadeId: 'a1' });

    const r = await useCase.executar(marta, 'n1', { atividadeId: 'a1' });

    expect(r).toEqual({ resultado: 'ok', necessidadeId: 'n1', status: 'atencao' });
    expect(atividades).toHaveLength(1);
    expect(chamadas.filter((c) => c === 'limite')).toHaveLength(1);
  });

  it('necessidade que não existe: NotFoundError', async () => {
    const { useCase } = montar(aberta);
    await expect(
      useCase.executar(marta, 'nao-existe', { atividadeId: 'a1' }),
    ).rejects.toMatchObject({ name: 'NotFoundError' });
  });
});
