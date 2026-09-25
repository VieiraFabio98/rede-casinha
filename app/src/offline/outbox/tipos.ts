/** Uma escrita feita no celular que espera ser enviada à API (docs/04-arquitetura.md, "Offline"). */
export interface NovaOperacao {
  /**
   * Gerado no celular e enviado também no corpo: é o que torna o envio idempotente
   * (reenviar a mesma operação não duplica nada no servidor).
   */
  id: string;
  /** Nome da operação, para a tela "Pendências" (ex.: 'check_in', 'reportar_necessidade'). */
  operacao: string;
  metodo: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Caminho na API, ex.: `/casinhas/<id>/check-in`. */
  caminho: string;
  corpo?: unknown;
}

export type StatusItem = 'pendente' | 'enviando' | 'erro_permanente';

export interface ItemOutbox extends NovaOperacao {
  /** Dono da operação: só é enviada com a sessão dele (outra conta no mesmo celular não envia). */
  usuarioId: string;
  status: StatusItem;
  tentativas: number;
  /** Epoch ms. `null` = pode tentar já. */
  proximaTentativaEm: number | null;
  ultimoErro: string | null;
  criadoEm: number;
}

export type MudancasItem = Partial<
  Pick<ItemOutbox, 'status' | 'tentativas' | 'proximaTentativaEm' | 'ultimoErro'>
>;

/** Onde a fila fica guardada (SQLite no app, memória nos testes). */
export interface ArmazemOutbox {
  inserir(item: ItemOutbox): Promise<void>;
  /** O item pendente mais antigo do usuário. A fila nunca pula um item que está esperando. */
  primeiroPendente(usuarioId: string): Promise<ItemOutbox | null>;
  atualizar(id: string, mudancas: MudancasItem): Promise<void>;
  remover(id: string): Promise<void>;
  listar(usuarioId: string): Promise<ItemOutbox[]>;
  /** Volta a "pendente" o que ficou "enviando" (o app foi fechado no meio do envio). */
  recuperarInterrompidos(): Promise<void>;
  /** Tira a espera dos pendentes do usuário ("Tentar agora"). */
  liberarEspera(usuarioId: string): Promise<void>;
}
