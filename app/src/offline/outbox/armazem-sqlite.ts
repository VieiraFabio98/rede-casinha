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
  criado_em: number;
}

const paraItem = (l: Linha): ItemOutbox => ({
  id: l.id,
  usuarioId: l.usuario_id,
  operacao: l.operacao,
  metodo: l.metodo,
  caminho: l.caminho,
  corpo: l.payload === null ? undefined : JSON.parse(l.payload),
  status: l.status,
  tentativas: l.tentativas,
  proximaTentativaEm: l.proxima_tentativa_em,
  ultimoErro: l.ultimo_erro,
  criadoEm: l.criado_em,
});

const COLUNAS: Record<keyof MudancasItem, string> = {
  status: 'status',
  tentativas: 'tentativas',
  proximaTentativaEm: 'proxima_tentativa_em',
  ultimoErro: 'ultimo_erro',
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
        item.corpo === undefined ? null : JSON.stringify(item.corpo),
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
        `UPDATE outbox SET ${campos.map((c) => `${COLUNAS[c]} = ?`).join(', ')} WHERE id = ?`,
        ...campos.map((c) => mudancas[c] ?? null),
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
