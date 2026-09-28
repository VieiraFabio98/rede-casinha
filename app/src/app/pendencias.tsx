import { useRouter } from 'expo-router';
import { Alert, FlatList, StyleSheet, View } from 'react-native';

import { cadastrarMesmoAssim, desistirDoCadastro } from '@/api/cadastro';
import type { CandidataDuplicata } from '@/api/tipos';
import { Candidatas } from '@/cadastro/candidatas';
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

/** Cadastro que bateu numa casinha a até 30 m (RN04): a pessoa decide se é a mesma. */
function Duplicata({ item }: { item: ItemOutbox }) {
  const router = useRouter();
  const candidatas = (item.detalheErro ?? []) as CandidataDuplicata[];
  return (
    <>
      <ThemedText type="small">{textos.novaCasinha.duplicataExplicacao}</ThemedText>
      <Candidatas
        candidatas={candidatas}
        aoEscolher={async (c) => {
          await desistirDoCadastro(item.id);
          router.push({ pathname: '/casinha/[id]', params: { id: c.id } });
        }}
      />
      <Botao
        titulo={textos.novaCasinha.eNova}
        variante="secundario"
        onPress={() => void cadastrarMesmoAssim(item.id)}
      />
    </>
  );
}

function Item({ item }: { item: ItemOutbox }) {
  const comErro = item.status === 'erro_permanente';
  const duplicata = comErro && item.codigoErro === 'possivel_duplicata';
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
      {item.ultimoErro && !duplicata && (
        <ThemedText type="small">{t.ultimaFalha(item.ultimoErro)}</ThemedText>
      )}
      {duplicata && <Duplicata item={item} />}
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
