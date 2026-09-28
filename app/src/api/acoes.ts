import type { QueryClient } from '@tanstack/react-query';

import { posicaoRecente, temPermissaoLocalizacao } from '@/map/localizacao';
import { enfileirar, novoId } from '@/offline/outbox/fila';

import { chavesCasinhas } from './casinhas';
import type {
  CasinhaDetalhe,
  CasinhaNoMapa,
  CasinhasNaArea,
  MinhaCasinha,
  StatusCasinha,
  TipoNecessidade,
} from './tipos';

type Necessidade = CasinhaDetalhe['necessidadesAbertas'][number];
type Atendida = CasinhaDetalhe['atendidasRecentemente'][number];
type Atividade = CasinhaDetalhe['atividades'][number];
type Urgencia = Necessidade['urgencia'];

/** Nomes das operações na outbox (tela "Pendências"). */
export type OperacaoCasinha =
  | 'reportar'
  | 'reconfirmar'
  | 'atender'
  | 'contestar'
  | 'check_in'
  | 'denunciar'
  | 'pedir_desativacao';

export type AlvoDenuncia = 'casinha' | 'necessidade' | 'foto' | 'perfil';
export type MotivoDenuncia =
  'falsa' | 'duplicada' | 'ofensiva' | 'expoe_pessoa' | 'perigo_animais' | 'outro';

/**
 * Posição para o `validado_local` (até 100 m da casinha). Só se a permissão já foi dada:
 * uma ação nunca pede permissão. A API usa e descarta.
 */
async function posicao(): Promise<{ lat: number; lng: number } | object> {
  try {
    if (!(await temPermissaoLocalizacao())) return {};
    const recente = await posicaoRecente();
    return recente ? { lng: recente[0], lat: recente[1] } : {};
  } catch {
    return {};
  }
}

const agoraIso = () => new Date().toISOString();

// ─── UI otimista ─────────────────────────────────────────────────────────────
// A ação aparece na hora; quando a fila envia, as consultas são recarregadas do servidor.

/** Versão local da RN01: logo depois de uma ação a casinha não está "sem notícias". */
function statusLocal(
  abertas: { tipo: TipoNecessidade; urgencia: Urgencia; criadaEm: string }[],
): StatusCasinha {
  const essencialAntiga = abertas.some(
    (n) =>
      (n.tipo === 'agua' || n.tipo === 'racao') &&
      Date.now() - Date.parse(n.criadaEm) > 48 * 60 * 60 * 1000,
  );
  if (essencialAntiga || abertas.some((n) => n.urgencia === 'urgente')) return 'urgente';
  return abertas.length ? 'atencao' : 'ok';
}

function atividade(
  id: string,
  tipo: Atividade['tipo'],
  apelido: string,
  necessidade: TipoNecessidade | null = null,
  observacao: string | null = null,
): Atividade {
  return { id, tipo, apelido, necessidade, observacao, criadaEm: agoraIso(), foto: null };
}

/** Aplica a mudança no detalhe e repete status/necessidades no mapa e em "Minhas casinhas". */
function atualizar(
  cliente: QueryClient,
  casinhaId: string,
  mudar: (d: CasinhaDetalhe) => Partial<CasinhaDetalhe>,
) {
  let resumo: Pick<CasinhaNoMapa, 'status' | 'necessidadesAbertas'> | null = null;
  cliente.setQueryData<CasinhaDetalhe>(chavesCasinhas.detalhe(casinhaId), (d) => {
    if (!d) return d;
    const novo = { ...d, ...mudar(d) };
    novo.status = statusLocal(novo.necessidadesAbertas);
    resumo = {
      status: novo.status,
      necessidadesAbertas: novo.necessidadesAbertas.map((n) => n.tipo),
    };
    return novo;
  });
  if (!resumo) return;
  const noResumo = <T extends CasinhaNoMapa>(c: T): T =>
    c.id === casinhaId ? { ...c, ...resumo } : c;
  cliente.setQueriesData<CasinhasNaArea>({ queryKey: ['casinhas', 'area'] }, (d) =>
    d ? { ...d, casinhas: d.casinhas.map(noResumo) } : d,
  );
  cliente.setQueryData<MinhaCasinha[]>(chavesCasinhas.minhas, (d) => d?.map(noResumo));
}

// ─── Ações ───────────────────────────────────────────────────────────────────

/** "O que está faltando?": um pedido por tipo. Tipo já aberto vira "ainda precisa" no servidor. */
export async function reportar(
  casinhaId: string,
  pedido: { tipo: TipoNecessidade; urgencia: Urgencia; observacao?: string },
  apelido: string,
) {
  const id = novoId();
  await enfileirar(
    {
      id,
      operacao: 'reportar' satisfies OperacaoCasinha,
      metodo: 'POST',
      caminho: '/necessidades',
      corpo: { id, casinhaId, ...pedido, ...(await posicao()), criadaNoCelularEm: agoraIso() },
    },
    (cliente) =>
      atualizar(cliente, casinhaId, (d) => {
        const aberta = d.necessidadesAbertas.find((n) => n.tipo === pedido.tipo);
        const necessidades = aberta
          ? d.necessidadesAbertas.map((n) =>
              n === aberta && pedido.urgencia === 'urgente'
                ? { ...n, urgencia: 'urgente' as const }
                : n,
            )
          : [
              {
                id,
                tipo: pedido.tipo,
                urgencia: pedido.urgencia,
                observacao: pedido.observacao ?? null,
                criadaEm: agoraIso(),
                expiraEm: agoraIso(),
              },
              ...d.necessidadesAbertas,
            ];
        return {
          necessidadesAbertas: necessidades,
          atividades: [
            atividade(id, aberta ? 'reconfirmacao' : 'reporte', apelido, pedido.tipo),
            ...d.atividades,
          ],
        };
      }),
  );
}

/** "Ainda precisa". */
export async function reconfirmar(casinhaId: string, necessidade: Necessidade, apelido: string) {
  const atividadeId = novoId();
  await enfileirar(
    {
      id: atividadeId,
      operacao: 'reconfirmar' satisfies OperacaoCasinha,
      metodo: 'POST',
      caminho: `/necessidades/${necessidade.id}/reconfirmar`,
      corpo: { atividadeId, ...(await posicao()), criadaNoCelularEm: agoraIso() },
    },
    (cliente) =>
      atualizar(cliente, casinhaId, (d) => ({
        atividades: [
          atividade(atividadeId, 'reconfirmacao', apelido, necessidade.tipo),
          ...d.atividades,
        ],
      })),
  );
}

/** "Abasteci" / "Atendi". */
export async function atender(casinhaId: string, necessidade: Necessidade, apelido: string) {
  const atividadeId = novoId();
  await enfileirar(
    {
      id: atividadeId,
      operacao: 'atender' satisfies OperacaoCasinha,
      metodo: 'POST',
      caminho: `/necessidades/${necessidade.id}/atender`,
      corpo: { atividadeId, ...(await posicao()), criadaNoCelularEm: agoraIso() },
    },
    (cliente) =>
      atualizar(cliente, casinhaId, (d) => ({
        necessidadesAbertas: d.necessidadesAbertas.filter((n) => n.id !== necessidade.id),
        atendidasRecentemente: [
          { id: necessidade.id, tipo: necessidade.tipo, atendidaEm: agoraIso(), apelido },
          ...d.atendidasRecentemente,
        ],
        atividades: [
          atividade(atividadeId, 'atendimento', apelido, necessidade.tipo),
          ...d.atividades,
        ],
      })),
  );
}

/** "Não foi resolvido": reabre até 24 h depois do atendimento. */
export async function contestar(
  casinhaId: string,
  atendida: Atendida,
  observacao: string,
  apelido: string,
) {
  const atividadeId = novoId();
  await enfileirar(
    {
      id: atividadeId,
      operacao: 'contestar' satisfies OperacaoCasinha,
      metodo: 'POST',
      caminho: `/necessidades/${atendida.id}/contestar`,
      corpo: { atividadeId, observacao },
    },
    (cliente) =>
      atualizar(cliente, casinhaId, (d) => ({
        atendidasRecentemente: d.atendidasRecentemente.filter((n) => n.id !== atendida.id),
        necessidadesAbertas: d.necessidadesAbertas.some((n) => n.tipo === atendida.tipo)
          ? d.necessidadesAbertas
          : [
              {
                id: atendida.id,
                tipo: atendida.tipo,
                urgencia: 'normal',
                observacao,
                criadaEm: agoraIso(),
                expiraEm: agoraIso(),
              },
              ...d.necessidadesAbertas,
            ],
        atividades: [
          atividade(atividadeId, 'contestacao', apelido, atendida.tipo, observacao),
          ...d.atividades,
        ],
      })),
  );
}

/** "Passei aqui, tudo ok". */
export async function checkIn(casinhaId: string, apelido: string) {
  const atividadeId = novoId();
  await enfileirar(
    {
      id: atividadeId,
      operacao: 'check_in' satisfies OperacaoCasinha,
      metodo: 'POST',
      caminho: `/casinhas/${casinhaId}/check-in`,
      corpo: { atividadeId, ...(await posicao()), criadaNoCelularEm: agoraIso() },
    },
    (cliente) =>
      atualizar(cliente, casinhaId, (d) => ({
        atividades: [atividade(atividadeId, 'check_in', apelido), ...d.atividades],
      })),
  );
}

/**
 * Denúncia (RF06.1). Pela fila: funciona offline. Não há efeito otimista: a moderação decide.
 * Repetir a mesma denúncia não duplica (a API guarda uma por pessoa e alvo).
 */
export async function denunciar(
  alvo: { alvoTipo: AlvoDenuncia; alvoId: string },
  motivo: MotivoDenuncia,
  descricao?: string,
) {
  await enfileirar({
    id: novoId(),
    operacao: 'denunciar' satisfies OperacaoCasinha,
    metodo: 'POST',
    caminho: '/denuncias',
    corpo: { ...alvo, motivo, descricao },
  });
}

/** "A casinha não existe mais" (RF02.7): pedido para a moderação conferir. */
export async function pedirDesativacao(casinhaId: string, motivo: string, apelido: string) {
  const atividadeId = novoId();
  await enfileirar(
    {
      id: atividadeId,
      operacao: 'pedir_desativacao' satisfies OperacaoCasinha,
      metodo: 'POST',
      caminho: `/casinhas/${casinhaId}/desativacao`,
      corpo: { atividadeId, motivo },
    },
    (cliente) =>
      atualizar(cliente, casinhaId, (d) => ({
        atividades: [
          atividade(atividadeId, 'desativacao_pedida', apelido, null, motivo),
          ...d.atividades,
        ],
      })),
  );
}
