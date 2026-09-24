import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';

/** Mensagem de erro anunciada pelo leitor de tela. */
export function MensagemErro({ texto }: { texto: string | null }) {
  if (!texto) return null;
  return (
    <ThemedText accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.erro}>
      {texto}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  erro: {
    color: '#C62828',
  },
});
