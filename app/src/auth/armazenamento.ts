import * as SecureStore from 'expo-secure-store';

import type { Me } from '@/api/tipos';

/** Tokens e o último `me` ficam no armazenamento seguro do Android (Keystore). */
const CHAVES = { refresh: 'rc.refresh', acesso: 'rc.acesso', me: 'rc.me' } as const;

export interface SessaoSalva {
  refresh: string | null;
  acesso: string | null;
  me: Me | null;
}

export async function lerSessao(): Promise<SessaoSalva> {
  const [refresh, acesso, me] = await Promise.all([
    SecureStore.getItemAsync(CHAVES.refresh),
    SecureStore.getItemAsync(CHAVES.acesso),
    SecureStore.getItemAsync(CHAVES.me),
  ]);
  return { refresh, acesso, me: me ? (JSON.parse(me) as Me) : null };
}

export async function salvarTokens(acesso: string, refresh: string) {
  await Promise.all([
    SecureStore.setItemAsync(CHAVES.acesso, acesso),
    SecureStore.setItemAsync(CHAVES.refresh, refresh),
  ]);
}

export async function salvarMe(me: Me) {
  await SecureStore.setItemAsync(CHAVES.me, JSON.stringify(me));
}

export async function apagarSessao() {
  await Promise.all(Object.values(CHAVES).map((chave) => SecureStore.deleteItemAsync(chave)));
}
