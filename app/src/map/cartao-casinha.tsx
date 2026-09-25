import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import type { CasinhaNoMapa } from '@/api/tipos';
import { Botao } from '@/components/botao';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { SELO_STATUS } from '@/domain/status';
import { useTheme } from '@/hooks/use-theme';
import { textos } from '@/i18n/pt-BR';

const t = textos.mapa;

/** Prévia da casinha tocada no mapa, com o botão para o detalhe. */
export function CartaoCasinha({
  casinha,
  aoFechar,
}: {
  casinha: CasinhaNoMapa;
  aoFechar: () => void;
}) {
  const cores = useTheme();
  const router = useRouter();
  const precisa = casinha.necessidadesAbertas.map((tipo) => t.necessidades[tipo]).join(', ');

  return (
    <ThemedView style={styles.cartao} accessibilityLiveRegion="polite">
      <View style={styles.topo}>
        <ThemedText type="subtitle" style={styles.nome} numberOfLines={2}>
          {casinha.nome}
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.fecharCasinha}
          hitSlop={Spacing.two}
          onPress={aoFechar}
          style={styles.fechar}>
          <SymbolView name={{ ios: 'xmark', android: 'close' }} tintColor={cores.text} size={24} />
        </Pressable>
      </View>
      <View style={styles.linha}>
        <Image source={SELO_STATUS[casinha.status]} style={styles.selo} />
        <ThemedText type="smallBold">{t.status[casinha.status]}</ThemedText>
      </View>
      <ThemedText>{precisa ? `${t.precisaDe}: ${precisa}` : t.nadaFaltando}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {casinha.exata ? t.localExato : t.localAproximado}
      </ThemedText>
      <Botao
        titulo={t.verDetalhes}
        onPress={() => router.push({ pathname: '/casinha/[id]', params: { id: casinha.id } })}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  cartao: {
    marginHorizontal: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
    elevation: 6,
  },
  topo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  nome: {
    flex: 1,
    fontSize: 22,
    lineHeight: 28,
  },
  fechar: {
    width: 48,
    height: 48,
    marginTop: -Spacing.two,
    marginRight: -Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  selo: {
    width: 24,
    height: 24,
  },
});
