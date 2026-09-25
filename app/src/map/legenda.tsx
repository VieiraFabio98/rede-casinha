import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { PINO_STATUS, SELO_STATUS, STATUS_POR_GRAVIDADE } from '@/domain/status';
import { textos } from '@/i18n/pt-BR';

const t = textos.mapa;

/** Legenda acessível: cor + símbolo + texto, nunca só a cor (RF01.6). */
export function Legenda() {
  return (
    <ThemedView style={styles.cartao} accessibilityRole="summary">
      {STATUS_POR_GRAVIDADE.map((status) => (
        <View key={status} style={styles.linha}>
          <Image source={SELO_STATUS[status]} style={styles.selo} />
          <ThemedText>{t.status[status]}</ThemedText>
        </View>
      ))}
      <View style={[styles.linha, styles.separador]}>
        <Image source={PINO_STATUS.ok} style={styles.pino} />
        <ThemedText type="small" style={styles.texto}>
          {t.legendaPino}
        </ThemedText>
      </View>
      <View style={styles.linha}>
        <View style={styles.area} />
        <ThemedText type="small" style={styles.texto}>
          {t.legendaArea}
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  cartao: {
    marginHorizontal: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
    elevation: 4,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  separador: {
    marginTop: Spacing.one,
  },
  texto: {
    flex: 1,
  },
  selo: {
    width: 28,
    height: 28,
  },
  pino: {
    width: 28,
    height: 36,
  },
  area: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    // Cinza claro: aparece tanto no tema claro quanto no escuro.
    borderColor: '#9E9E9E',
    backgroundColor: 'rgba(158,158,158,0.35)',
  },
});
