import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { textos } from '@/i18n/pt-BR';

type PlaceholderScreenProps = {
  titulo: string;
  /** Task do plano (docs/05-tasks.md) que implementa esta tela. */
  task: string;
};

export function PlaceholderScreen({ titulo, task }: PlaceholderScreenProps) {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle">{titulo}</ThemedText>
        <ThemedText themeColor="textSecondary">
          {textos.emConstrucao} · {task}
        </ThemedText>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
});
