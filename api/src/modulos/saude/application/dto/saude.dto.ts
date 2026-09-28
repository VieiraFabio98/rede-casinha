export class SaudeResposta {
  /** `true` quando a API e o banco estão respondendo. */
  ok: boolean;

  /** Estado da conexão com o Postgres. */
  banco: 'ok' | 'erro';
}
