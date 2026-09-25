import { Alert, FlatList, StyleSheet, View } from 'react-native';

import { Botao } from '@/components/botao';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { tempoRelativo } from '@/domain/historico';
import { COR_STATUS } from '@/domain/status';
import { textos } from '@/i18n/pt-BR';
import { descartar, tentarAgora } from '@/offline/outbox/fila';
import type { ItemOutbox } from '@/offline/outbox/tipos';
import { useFila } from '@/offline/outbox/use-fila';

const t = textos.pendencias;

function confirmarDescarte(item: ItemOutbox) {
  Alert.alert(t.descartarTitulo, t.descartarMensagem, [
    { text: t.cancelar, style: 'cancel' },
    { text: t.descartar, style: 'destructive', onPress: () => void descartar(item.id) },
  ]);
}

function Item({ item }: { item: ItemOutbox }) {
  const comErro = item.status === 'erro_permanente';
  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.item, comErro && { borderColor: COR_STATUS.urgente.cor }]}>
      <ThemedText type="smallBold">
        {t.operacoes[item.operacao] ?? t.operacaoDesconhecida}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {tempoRelativo(new Date(item.criadoEm).toISOString())} ·{' '}
        {comErro ? t.statusErro : item.status === 'enviando' ? t.statusEnviando : t.statusPendente}
      </ThemedText>
      {item.ultimoErro && <ThemedText type="small">{t.ultimaFalha(item.ultimoErro)}</ThemedText>}
      {comErro && (
        <Botao titulo={t.descartar} variante="texto" onPress={() => confirmarDescarte(item)} />
      )}
    </ThemedView>
  );
}

/** Tela "Pendências": o que ainda não chegou ao servidor (docs/04-arquitetura.md, "Offline"). */
export default function PendenciasScreen() {
  const itens = useFila();
  const temPendente = itens.some((i) => i.status !== 'erro_permanente');

  return (
    <ThemedView style={styles.tela}>
      <FlatList
        data={itens}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.lista}
        ListHeaderComponent={
          <View style={styles.cabecalho}>
            <ThemedText themeColor="textSecondary">{t.explicacao}</ThemedText>
            {temPendente && <Botao titulo={t.tentarAgora} onPress={() => void tentarAgora()} />}
          </View>
        }
        ListEmptyComponent={<ThemedText>{t.vazio}</ThemedText>}
        renderItem={({ item }) => <Item item={item} />}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  tela: {
    flex: 1,
  },
  lista: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cabecalho: {
    gap: Spacing.three,
    marginBottom: Spacing.two,
  },
  item: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
    borderWidth: 2,
    borderColor: 'transparent',
  },
});
