import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import type { ArmazemOutbox, ItemOutbox, MudancasItem } from './tipos';

/**
 * Migrations do banco local, em ordem. Nunca edite uma que já foi publicada: acrescente outra.
 * A versão aplicada fica em `PRAGMA user_version`.
 */
const MIGRATIONS = [
  `CREATE TABLE outbox (
     id TEXT PRIMARY KEY NOT NULL,
     usuario_id TEXT NOT NULL,
     operacao TEXT NOT NULL,
     metodo TEXT NOT NULL,
     caminho TEXT NOT NULL,
     payload TEXT,
     fotos TEXT,
     status TEXT NOT NULL,
     tentativas INTEGER NOT NULL DEFAULT 0,
     proxima_tentativa_em INTEGER,
     ultimo_erro TEXT,
     criado_em INTEGER NOT NULL
   );
   CREATE INDEX outbox_usuario_ordem ON outbox (usuario_id, status, criado_em);`,
  `ALTER TABLE outbox ADD COLUMN codigo_erro TEXT;
   ALTER TABLE outbox ADD COLUMN detalhe_erro TEXT;`,
];

async function migrar(db: SQLiteDatabase) {
  const linha = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const versao = linha?.user_version ?? 0;
  for (let i = versao; i < MIGRATIONS.length; i++) {
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.execAsync(MIGRATIONS[i]);
      await tx.execAsync(`PRAGMA user_version = ${i + 1}`);
    });
  }
}

interface Linha {
  id: string;
  usuario_id: string;
  operacao: string;
  metodo: ItemOutbox['metodo'];
  caminho: string;
  payload: string | null;
  status: ItemOutbox['status'];
  tentativas: number;
  proxima_tentativa_em: number | null;
  ultimo_erro: string | null;
  codigo_erro: string | null;
  detalhe_erro: string | null;
  criado_em: number;
}

const paraJson = (valor: unknown) => (valor === undefined ? null : JSON.stringify(valor));
const deJson = (texto: string | null) => (texto === null ? undefined : JSON.parse(texto));

const paraItem = (l: Linha): ItemOutbox => ({
  id: l.id,
  usuarioId: l.usuario_id,
  operacao: l.operacao,
  metodo: l.metodo,
  caminho: l.caminho,
  corpo: deJson(l.payload),
  status: l.status,
  tentativas: l.tentativas,
  proximaTentativaEm: l.proxima_tentativa_em,
  ultimoErro: l.ultimo_erro,
  codigoErro: l.codigo_erro,
  detalheErro: deJson(l.detalhe_erro) ?? null,
  criadoEm: l.criado_em,
});

/** Coluna de cada campo e como gravar o valor (JSON para o que não é texto nem número). */
const COLUNAS: Record<keyof MudancasItem, [string, (valor: unknown) => unknown]> = {
  status: ['status', (v) => v],
  tentativas: ['tentativas', (v) => v],
  proximaTentativaEm: ['proxima_tentativa_em', (v) => v ?? null],
  ultimoErro: ['ultimo_erro', (v) => v ?? null],
  codigoErro: ['codigo_erro', (v) => v ?? null],
  detalheErro: ['detalhe_erro', (v) => (v === null ? null : paraJson(v))],
  corpo: ['payload', paraJson],
};

/** Outbox no SQLite do aparelho: sobrevive a fechar o app e a reiniciar o celular. */
export function criarArmazemSqlite(nomeArquivo = 'outbox.db'): ArmazemOutbox {
  let aberto: Promise<SQLiteDatabase> | null = null;
  const banco = () =>
    (aberto ??= openDatabaseAsync(nomeArquivo).then(async (db) => {
      await migrar(db);
      return db;
    }));

  return {
    async inserir(item) {
      const db = await banco();
      // OR IGNORE: enfileirar duas vezes o mesmo id não duplica a operação.
      await db.runAsync(
        `INSERT OR IGNORE INTO outbox
           (id, usuario_id, operacao, metodo, caminho, payload, status, tentativas,
            proxima_tentativa_em, ultimo_erro, criado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        item.id,
        item.usuarioId,
        item.operacao,
        item.metodo,
        item.caminho,
        paraJson(item.corpo),
        item.status,
        item.tentativas,
        item.proximaTentativaEm,
        item.ultimoErro,
        item.criadoEm,
      );
    },

    async primeiroPendente(usuarioId) {
      const db = await banco();
      const linha = await db.getFirstAsync<Linha>(
        `SELECT * FROM outbox WHERE usuario_id = ? AND status = 'pendente'
         ORDER BY criado_em, rowid LIMIT 1`,
        usuarioId,
      );
      return linha ? paraItem(linha) : null;
    },

    async atualizar(id, mudancas) {
      const campos = Object.keys(mudancas) as (keyof MudancasItem)[];
      if (campos.length === 0) return;
      const db = await banco();
      await db.runAsync(
        `UPDATE outbox SET ${campos.map((c) => `${COLUNAS[c][0]} = ?`).join(', ')} WHERE id = ?`,
        ...campos.map((c) => COLUNAS[c][1](mudancas[c]) as string | number | null),
        id,
      );
    },

    async remover(id) {
      const db = await banco();
      await db.runAsync('DELETE FROM outbox WHERE id = ?', id);
    },

    async listar(usuarioId) {
      const db = await banco();
      const linhas = await db.getAllAsync<Linha>(
        'SELECT * FROM outbox WHERE usuario_id = ? ORDER BY criado_em, rowid',
        usuarioId,
      );
      return linhas.map(paraItem);
    },

    async recuperarInterrompidos() {
      const db = await banco();
      await db.runAsync(`UPDATE outbox SET status = 'pendente' WHERE status = 'enviando'`);
    },

    async removerDoUsuario(usuarioId) {
      const db = await banco();
      await db.runAsync('DELETE FROM outbox WHERE usuario_id = ?', usuarioId);
    },

    async liberarEspera(usuarioId) {
      const db = await banco();
      await db.runAsync(
        `UPDATE outbox SET proxima_tentativa_em = NULL
         WHERE usuario_id = ? AND status = 'pendente'`,
        usuarioId,
      );
    },
  };
}
