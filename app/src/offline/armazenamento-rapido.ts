import { createMMKV } from 'react-native-mmkv';

/**
 * Chave-valor síncrono (MMKV) para dados não sensíveis: câmera do mapa e, na
 * Fase 1, o cache persistido do TanStack Query. Tokens ficam no SecureStore.
 */
export const armazenamentoRapido = createMMKV({ id: 'rede-casinha' });
