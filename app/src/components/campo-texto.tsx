import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type CampoTextoProps = TextInputProps & {
  rotulo: string;
  dica?: string;
};

export function CampoTexto({ rotulo, dica, style, ...resto }: CampoTextoProps) {
  const cores = useTheme();
  return (
    <View style={styles.container}>
      <ThemedText type="smallBold">{rotulo}</ThemedText>
      <TextInput
        accessibilityLabel={rotulo}
        placeholderTextColor={cores.textSecondary}
        style={[
          styles.campo,
          { color: cores.text, backgroundColor: cores.backgroundElement },
          style,
        ]}
        {...resto}
      />
      {dica ? (
        <ThemedText type="small" themeColor="textSecondary">
          {dica}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
  },
  campo: {
    minHeight: 52,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    fontSize: 18,
  },
});
