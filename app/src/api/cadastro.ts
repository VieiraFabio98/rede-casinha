import type { QueryClient } from '@tanstack/react-query';

import type { FotoPreparada } from '@/fotos/pendentes';
import type { Ponto } from '@/domain/geo';
import { clienteConsultas } from '@/api/consultas';
import { descartar, enfileirar, novoId, reenviar } from '@/offline/outbox/fila';

import { type CorpoCadastro, OPERACAO_CADASTRO } from './cadastro-envio';
import { chavesCasinhas } from './casinhas';
import type {
  AnimaisAtendidos,
  CasinhaDetalhe,
  CasinhaNoMapa,
  CasinhasNaArea,
  MinhaCasinha,
} from './tipos';

export interface NovaCasinha {
  nome: string;
  animais: AnimaisAtendidos;
  descricao?: string;
  /** Posição EXATA (GPS ou pino ajustado). */
  posicao: Ponto;
  precisaoM: number;
  ajusteManual: boolean;
  fotos: FotoPreparada[];
}

/**
 * A casinha aparece na hora no mapa, em "Minhas casinhas" e no detalhe (com a exata: quem
 * cadastra é o criador). Se o servidor recusar, as consultas recarregadas a tiram.
 */
function mostrarNaHora(cliente: QueryClient, corpo: CorpoCadastro, apelido: string) {
  const agora = corpo.criadaNoCelularEm;
  const noMapa: CasinhaNoMapa = {
    id: corpo.id,
    nome: corpo.nome,
    status: 'ok',
    animais: corpo.animais,
    lat: corpo.lat,
    lng: corpo.lng,
    exata: true,
    necessidadesAbertas: [],
  };
  cliente.setQueryData<CasinhaDetalhe>(chavesCasinhas.detalhe(corpo.id), {
    ...noMapa,
    necessidadesAbertas: [],
    descricao: corpo.descricao ?? null,
    ultimaAtividadeEm: agora,
    criadaEm: agora,
    atendidasRecentemente: [],
    adotantes: [apelido],
    atividades: [
      {
        id: corpo.id,
        tipo: 'cadastro',
        necessidade: null,
        apelido,
        observacao: null,
        criadaEm: agora,
        foto: null,
      },
    ],
    fotos: corpo.fotos.map((f) => ({ id: f.id, url: f.arquivo, urlMiniatura: f.miniatura })),
    minhasPermissoes: {
      editar: true,
      adotar: false,
      deixarDeAdotar: true,
      pedirDesativacao: true,
      desativar: false,
      denunciar: true,
    },
  });
  cliente.setQueryData<MinhaCasinha[]>(chavesCasinhas.minhas, (d) =>
    d ? [{ ...noMapa, souCriador: true, souAdotante: true }, ...d] : d,
  );
  cliente.setQueriesData<CasinhasNaArea>({ queryKey: ['casinhas', 'area'] }, (d) =>
    d ? { ...d, casinhas: [...d.casinhas, noMapa] } : d,
  );
}

/**
 * Põe o cadastro na fila (RF02.4: funciona offline). Devolve o id da casinha, para a tela
 * acompanhar o envio (`aguardarEnvio`).
 */
export async function cadastrarCasinha(nova: NovaCasinha, apelido: string): Promise<string> {
  const id = novoId();
  const corpo: CorpoCadastro = {
    id,
    nome: nova.nome.trim(),
    animais: nova.animais,
    ...(nova.descricao?.trim() && { descricao: nova.descricao.trim() }),
    lat: nova.posicao.lat,
    lng: nova.posicao.lng,
    precisaoM: Math.round(nova.precisaoM * 10) / 10,
    ajusteManual: nova.ajusteManual,
    forcar: false,
    criadaNoCelularEm: new Date().toISOString(),
    fotos: nova.fotos,
  };
  await enfileirar(
    { id, operacao: OPERACAO_CADASTRO, metodo: 'POST', caminho: '/casinhas', corpo },
    (cliente) => mostrarNaHora(cliente, corpo, apelido),
  );
  return id;
}

/** "É nova": cadastra mesmo com casinha a até 30 m (ela entra em revisão, RN04). */
export const cadastrarMesmoAssim = (id: string) =>
  reenviar(id, (corpo) => ({ ...(corpo as CorpoCadastro), forcar: true }));

/** "É esta": desiste do cadastro (a casinha já existe) e tira a versão otimista da tela. */
export async function desistirDoCadastro(id: string) {
  await descartar(id);
  clienteConsultas.removeQueries({ queryKey: chavesCasinhas.detalhe(id) });
  await clienteConsultas.invalidateQueries({ queryKey: chavesCasinhas.todas });
}
