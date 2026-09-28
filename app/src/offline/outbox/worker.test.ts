/// <reference types="jest" />
import { ErroApi } from '@/api/cliente';

import type { ArmazemOutbox, ItemOutbox } from './tipos';
import { criarWorker, ESPERA_MAXIMA_MS, esperaAposFalha } from './worker';

/** Outbox em memória com a mesma semântica do SQLite (ordem de criação, status). */
function armazemEmMemoria(): ArmazemOutbox & { itens: Map<string, ItemOutbox> } {
  const itens = new Map<string, ItemOutbox>();
  const doUsuario = (u: string) =>
    [...itens.values()].filter((i) => i.usuarioId === u).sort((a, b) => a.criadoEm - b.criadoEm);
  return {
    itens,
    async inserir(item) {
      if (!itens.has(item.id)) itens.set(item.id, { ...item });
    },
    async primeiroPendente(u) {
      return doUsuario(u).find((i) => i.status === 'pendente') ?? null;
    },
    async atualizar(id, mudancas) {
      const item = itens.get(id);
      if (item) itens.set(id, { ...item, ...mudancas });
    },
    async remover(id) {
      itens.delete(id);
    },
    async listar(u) {
      return doUsuario(u);
    },
    async recuperarInterrompidos() {
      for (const i of itens.values()) if (i.status === 'enviando') i.status = 'pendente';
    },
    async removerDoUsuario(u) {
      for (const i of doUsuario(u)) itens.delete(i.id);
    },
    async liberarEspera(u) {
      for (const i of doUsuario(u)) if (i.status === 'pendente') i.proximaTentativaEm = null;
    },
  };
}

let sequencia = 0;
function novoItem(dados: Partial<ItemOutbox> = {}): ItemOutbox {
  sequencia++;
  return {
    id: `op-${sequencia}`,
    usuarioId: 'u1',
    operacao: 'check_in',
    metodo: 'POST',
    caminho: `/casinhas/c${sequencia}/check-in`,
    corpo: { id: `op-${sequencia}` },
    status: 'pendente',
    tentativas: 0,
    proximaTentativaEm: null,
    ultimoErro: null,
    codigoErro: null,
    detalheErro: null,
    criadoEm: sequencia,
    ...dados,
  };
}

const semRede = () => new ErroApi(0, 'Sem conexão com a internet. Tente de novo.');

/** API simulada: guarda o que recebeu e é idempotente pelo id, como a real. */
function apiSimulada() {
  const recebidos: string[] = [];
  const aplicados = new Set<string>();
  let falha: ((item: ItemOutbox) => ErroApi | null) | null = null;
  return {
    recebidos,
    aplicados,
    falharCom(fn: typeof falha) {
      falha = fn;
    },
    enviar: jest.fn(async (item: ItemOutbox) => {
      const erro = falha?.(item);
      if (erro) throw erro;
      recebidos.push(item.id);
      aplicados.add(item.id); // reenviar o mesmo id não cria outro registro
    }),
  };
}

function montar() {
  const armazem = armazemEmMemoria();
  const api = apiSimulada();
  let relogio = 1_000_000;
  const worker = criarWorker({ armazem, enviar: api.enviar, agora: () => relogio });
  return {
    armazem,
    api,
    worker,
    avancar: (ms: number) => {
      relogio += ms;
    },
  };
}

describe('worker da outbox', () => {
  it('envia 10 operações em ordem de criação e esvazia a fila', async () => {
    const { armazem, api, worker } = montar();
    const itens = Array.from({ length: 10 }, () => novoItem());
    // Inseridos fora de ordem: vale a data de criação.
    for (const item of [...itens].reverse()) await armazem.inserir(item);

    const resultado = await worker.processar('u1');

    expect(resultado).toEqual({ enviados: 10, proximaEm: null });
    expect(api.recebidos).toEqual(itens.map((i) => i.id));
    expect(armazem.itens.size).toBe(0);
  });

  it('sem rede: para a fila no primeiro item, agenda backoff e envia tudo quando a rede volta', async () => {
    const { armazem, api, worker, avancar } = montar();
    const [a, b] = [novoItem(), novoItem()];
    await armazem.inserir(a);
    await armazem.inserir(b);
    api.falharCom(semRede);

    const primeira = await worker.processar('u1');

    expect(primeira.enviados).toBe(0);
    expect(primeira.proximaEm).toBe(1_000_000 + esperaAposFalha(1));
    expect(api.enviar).toHaveBeenCalledTimes(1); // não tentou o segundo item
    expect(armazem.itens.get(a.id)).toMatchObject({
      status: 'pendente',
      tentativas: 1,
      ultimoErro: 'Sem conexão com a internet. Tente de novo.',
    });

    // Antes do fim da espera, nem tenta.
    await worker.processar('u1');
    expect(api.enviar).toHaveBeenCalledTimes(1);

    api.falharCom(null);
    avancar(esperaAposFalha(1));
    const segunda = await worker.processar('u1');

    expect(segunda.enviados).toBe(2);
    expect(api.recebidos).toEqual([a.id, b.id]);
  });

  it.each([500, 503, 401, 408, 429])(
    'HTTP %i é temporário: o item continua na fila',
    async (status) => {
      const { armazem, api, worker } = montar();
      const item = novoItem();
      await armazem.inserir(item);
      api.falharCom(() => new ErroApi(status, 'falhou'));

      await worker.processar('u1');

      expect(armazem.itens.get(item.id)?.status).toBe('pendente');
    },
  );

  it('um 4xx vira erro permanente e não trava a fila', async () => {
    const { armazem, api, worker } = montar();
    const [recusado, seguinte] = [novoItem(), novoItem()];
    await armazem.inserir(recusado);
    await armazem.inserir(seguinte);
    api.falharCom((item) =>
      item.id === recusado.id ? new ErroApi(422, 'Limite diário atingido') : null,
    );

    const resultado = await worker.processar('u1');

    expect(resultado.enviados).toBe(1);
    expect(api.recebidos).toEqual([seguinte.id]);
    expect(armazem.itens.get(recusado.id)).toMatchObject({
      status: 'erro_permanente',
      ultimoErro: 'Limite diário atingido',
    });
    // Rodar de novo não tenta o item com erro permanente.
    await worker.processar('u1');
    expect(api.enviar).toHaveBeenCalledTimes(2);
  });

  it('guarda o código e os dados do erro (ex.: candidatas de uma duplicata)', async () => {
    const { armazem, api, worker } = montar();
    const cadastro = novoItem();
    await armazem.inserir(cadastro);
    const candidatas = [{ id: 'c9', nome: 'Casinha vizinha', miniatura: null }];
    api.falharCom(() => new ErroApi(409, 'Já existe perto', 'possivel_duplicata', candidatas));

    await worker.processar('u1');

    expect(armazem.itens.get(cadastro.id)).toMatchObject({
      status: 'erro_permanente',
      codigoErro: 'possivel_duplicata',
      detalheErro: candidatas,
    });
  });

  it('reenviar a mesma operação (id repetido) não duplica no servidor', async () => {
    const { armazem, api, worker } = montar();
    const item = novoItem();
    // A API aplicou, mas a resposta se perdeu (rede caiu): o item fica na fila.
    let respostaPerdida = true;
    api.enviar.mockImplementationOnce(async (i: ItemOutbox) => {
      api.aplicados.add(i.id);
      if (respostaPerdida) throw semRede();
    });
    await armazem.inserir(item);
    await armazem.inserir(item); // enfileirar duas vezes o mesmo id também não duplica

    await worker.processar('u1');
    respostaPerdida = false;
    await armazem.liberarEspera('u1');
    await worker.processar('u1');

    expect(api.enviar).toHaveBeenCalledTimes(2);
    expect(api.aplicados.size).toBe(1);
    expect(armazem.itens.size).toBe(0);
  });

  it('só uma rodada por vez (lock): chamadas simultâneas não enviam em dobro', async () => {
    const { armazem, api, worker } = montar();
    for (let i = 0; i < 5; i++) await armazem.inserir(novoItem());

    const [r1, r2, r3] = await Promise.all([
      worker.processar('u1'),
      worker.processar('u1'),
      worker.processar('u1'),
    ]);

    expect(r1).toBe(r2);
    expect(r2).toBe(r3);
    expect(api.enviar).toHaveBeenCalledTimes(5);
  });

  it('o que ficou "enviando" (app fechado no meio) volta para a fila', async () => {
    const { armazem, api, worker } = montar();
    const item = novoItem({ status: 'enviando' });
    await armazem.inserir(item);

    await worker.processar('u1');
    expect(api.enviar).not.toHaveBeenCalled();

    await armazem.recuperarInterrompidos();
    await worker.processar('u1');
    expect(api.recebidos).toEqual([item.id]);
  });

  it('não envia operações de outro usuário', async () => {
    const { armazem, api, worker } = montar();
    await armazem.inserir(novoItem({ usuarioId: 'outra-conta' }));

    await worker.processar('u1');

    expect(api.enviar).not.toHaveBeenCalled();
    expect(armazem.itens.size).toBe(1);
  });

  it('backoff dobra a cada falha até o máximo de 30 min', () => {
    expect([1, 2, 3, 4].map(esperaAposFalha)).toEqual([10_000, 20_000, 40_000, 80_000]);
    expect(esperaAposFalha(50)).toBe(ESPERA_MAXIMA_MS);
  });
});
