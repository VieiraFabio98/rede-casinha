import type { LngLat } from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import { Alert, Linking } from 'react-native';

import { textos } from '@/i18n/pt-BR';
import { armazenamentoRapido } from '@/offline/armazenamento-rapido';

const t = textos.mapa.localizacao;
const CHAVE_JA_PERGUNTOU = 'mapa.localizacao.perguntou';

export async function temPermissaoLocalizacao() {
  const { granted } = await Location.getForegroundPermissionsAsync();
  return granted;
}

/** Se o app já explicou e pediu a localização alguma vez (para não insistir a cada abertura). */
export function jaPerguntouLocalizacao() {
  return armazenamentoRapido.getBoolean(CHAVE_JA_PERGUNTOU) ?? false;
}

function confirmar(titulo: string, mensagem: string, botao: string) {
  return new Promise<boolean>((resolve) =>
    Alert.alert(
      titulo,
      mensagem,
      [
        { text: t.agoraNao, style: 'cancel', onPress: () => resolve(false) },
        { text: botao, onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}

/**
 * Explica o motivo antes do diálogo do sistema. Se o usuário negou de vez,
 * oferece abrir as configurações do app.
 */
export async function pedirPermissaoLocalizacao() {
  const atual = await Location.getForegroundPermissionsAsync();
  if (atual.granted) return true;

  armazenamentoRapido.set(CHAVE_JA_PERGUNTOU, true);

  if (!atual.canAskAgain) {
    if (await confirmar(t.negadaTitulo, t.negadaMensagem, t.abrirConfiguracoes)) {
      await Linking.openSettings();
    }
    return false;
  }

  if (!(await confirmar(t.titulo, t.mensagem, t.permitir))) return false;
  const { granted } = await Location.requestForegroundPermissionsAsync();
  return granted;
}

/** Última posição conhecida pelo sistema (instantânea; `null` se velha ou inexistente). */
export async function posicaoRecente(): Promise<LngLat | null> {
  const posicao = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 });
  return posicao ? [posicao.coords.longitude, posicao.coords.latitude] : null;
}

/** Posição atual pelo GPS/rede. Lança erro se a localização do celular estiver desligada. */
export async function posicaoAtual(): Promise<LngLat> {
  const posicao = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return [posicao.coords.longitude, posicao.coords.latitude];
}
