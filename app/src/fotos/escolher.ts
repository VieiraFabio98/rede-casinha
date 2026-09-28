import {
  type ImagePickerOptions,
  launchCameraAsync,
  launchImageLibraryAsync,
  requestCameraPermissionsAsync,
} from 'expo-image-picker';
import { Alert } from 'react-native';

import { textos } from '@/i18n/pt-BR';

import type { FotoOriginal } from './pendentes';

const t = textos.fotos;

/** Qualidade máxima aqui: a compressão é feita depois, uma vez só (`prepararFoto`). */
const OPCOES: ImagePickerOptions = { mediaTypes: ['images'], quality: 1, exif: false };

async function daCamera(): Promise<FotoOriginal | null> {
  // A permissão é pedida só agora, no toque (Play: pedir no contexto).
  const { granted } = await requestCameraPermissionsAsync();
  if (!granted) {
    Alert.alert(t.semPermissaoCameraTitulo, t.semPermissaoCamera);
    return null;
  }
  const resultado = await launchCameraAsync(OPCOES);
  return resultado.canceled ? null : resultado.assets[0];
}

/** Photo Picker do sistema: não precisa de permissão de galeria (RNF12). */
async function daGaleria(): Promise<FotoOriginal | null> {
  const resultado = await launchImageLibraryAsync(OPCOES);
  return resultado.canceled ? null : resultado.assets[0];
}

/**
 * Mostra o aviso sobre o que não fotografar e deixa escolher câmera ou galeria.
 * `null` = desistiu ou sem permissão.
 */
export function escolherFoto(): Promise<FotoOriginal | null> {
  return new Promise((resolver) => {
    const tentar = (origem: () => Promise<FotoOriginal | null>) => () =>
      void origem()
        .then(resolver)
        .catch(() => {
          Alert.alert(t.erroCamera);
          resolver(null);
        });
    Alert.alert(
      t.escolherTitulo,
      t.aviso,
      [
        { text: t.cancelar, style: 'cancel', onPress: () => resolver(null) },
        { text: t.galeria, onPress: tentar(daGaleria) },
        { text: t.camera, onPress: tentar(daCamera) },
      ],
      { cancelable: true, onDismiss: () => resolver(null) },
    );
  });
}
