import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Faixa de aviso sobre o mapa (offline, aproxime, erro). */
export function AvisoMapa({
  texto,
  carregando,
  acao,
}: {
  texto: string;
  carregando?: boolean;
  acao?: { rotulo: string; aoTocar: () => void };
}) {
  const cores = useTheme();
  return (
    <ThemedView style={styles.aviso} accessibilityLiveRegion="polite">
      {carregando && <ActivityIndicator color={cores.primary} />}
      <ThemedText type="small" style={styles.texto}>
        {texto}
      </ThemedText>
      {acao && (
        <Pressable accessibilityRole="button" hitSlop={Spacing.three} onPress={acao.aoTocar}>
          <ThemedText type="linkPrimary">{acao.rotulo}</ThemedText>
        </Pressable>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginHorizontal: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    elevation: 3,
  },
  texto: {
    flex: 1,
  },
});
