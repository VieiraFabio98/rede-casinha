/** Cliente HTTP da API: anexa o token de acesso e renova a sessão uma vez ao receber 401. */

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/v1';

export class ErroApi extends Error {
  constructor(
    /** 0 = sem conexão com a API. */
    readonly status: number,
    message: string,
    readonly codigo?: string,
  ) {
    super(message);
  }

  get semConexao() {
    return this.status === 0;
  }
}

interface Opcoes {
  metodo?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  corpo?: unknown;
  /** `false` nas rotas de login: não envia token nem tenta renovar. */
  autenticado?: boolean;
}

interface Sessao {
  obterAcesso: () => string | null;
  /** Renova a sessão e devolve o novo token de acesso (ou null se a sessão acabou). */
  renovar: () => Promise<string | null>;
}

let sessao: Sessao = { obterAcesso: () => null, renovar: async () => null };

/** Chamado pelo AuthProvider para ligar o cliente à sessão atual. */
export function ligarSessao(nova: Sessao) {
  sessao = nova;
}

export async function api<T>(caminho: string, opcoes: Opcoes = {}): Promise<T> {
  const { metodo = 'GET', corpo, autenticado = true } = opcoes;
  const executar = (token: string | null) =>
    fetch(`${API_URL}${caminho}`, {
      method: metodo,
      headers: {
        Accept: 'application/json',
        ...(corpo !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });

  let resposta: Response;
  try {
    const token = autenticado ? sessao.obterAcesso() : null;
    resposta = await executar(token);
    if (resposta.status === 401 && token) {
      const novo = await sessao.renovar();
      if (novo) resposta = await executar(novo);
    }
  } catch {
    throw new ErroApi(0, 'Sem conexão com a internet. Tente de novo.');
  }

  if (!resposta.ok) throw await erroDaResposta(resposta);
  if (resposta.status === 204 || resposta.status === 202) return undefined as T;
  return (await resposta.json()) as T;
}

async function erroDaResposta(resposta: Response): Promise<ErroApi> {
  try {
    const corpo = (await resposta.json()) as { message?: string | string[]; codigo?: string };
    const mensagem = Array.isArray(corpo.message) ? corpo.message[0] : corpo.message;
    return new ErroApi(
      resposta.status,
      mensagem ?? 'Algo deu errado. Tente de novo.',
      corpo.codigo,
    );
  } catch {
    return new ErroApi(resposta.status, 'Algo deu errado. Tente de novo.');
  }
}
