import { ActivityIndicator, Pressable, StyleSheet, type PressableProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type BotaoProps = Omit<PressableProps, 'children'> & {
  titulo: string;
  variante?: 'primario' | 'secundario' | 'texto';
  carregando?: boolean;
};

/** Botão com alvo de toque ≥ 48 dp (RNF07). */
export function Botao({
  titulo,
  variante = 'primario',
  carregando,
  disabled,
  style,
  ...resto
}: BotaoProps) {
  const cores = useTheme();
  const desativado = disabled || carregando;
  const fundo =
    variante === 'primario'
      ? cores.primary
      : variante === 'secundario'
        ? cores.backgroundElement
        : 'transparent';
  const corTexto =
    variante === 'primario' ? cores.background : variante === 'texto' ? cores.primary : cores.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!desativado, busy: !!carregando }}
      disabled={desativado}
      style={(estado) => [
        styles.botao,
        { backgroundColor: fundo, opacity: desativado ? 0.5 : estado.pressed ? 0.8 : 1 },
        typeof style === 'function' ? style(estado) : style,
      ]}
      {...resto}>
      {carregando ? (
        <ActivityIndicator color={corTexto} />
      ) : (
        <ThemedText style={[styles.texto, { color: corTexto }]}>{titulo}</ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  botao: {
    minHeight: 52,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texto: {
    fontWeight: 700,
    // Em botões estreitos (lado a lado) o título pode quebrar em duas linhas.
    textAlign: 'center',
  },
});
