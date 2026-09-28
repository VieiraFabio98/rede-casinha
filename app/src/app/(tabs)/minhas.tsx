import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useMinhasCasinhas } from '@/api/casinhas';
import { ErroApi } from '@/api/cliente';
import type { MinhaCasinha } from '@/api/tipos';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { COR_STATUS, SELO_STATUS } from '@/domain/status';
import { useTheme } from '@/hooks/use-theme';
import { textos } from '@/i18n/pt-BR';
import { AvisoMapa } from '@/map/aviso-mapa';

const t = textos.minhas;
const tm = textos.mapa;

const hora = (instante: number) =>
  new Date(instante).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

function Cartao({ casinha }: { casinha: MinhaCasinha }) {
  const router = useRouter();
  const cores = useTheme();
  const precisa = casinha.necessidadesAbertas.map((tipo) => tm.necessidades[tipo]).join(', ');
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/casinha/[id]', params: { id: casinha.id } })}
      style={({ pressed }) => [
        styles.cartao,
        {
          backgroundColor: cores.backgroundElement,
          borderLeftColor: COR_STATUS[casinha.status].cor,
          opacity: pressed ? 0.8 : 1,
        },
      ]}>
      <View style={styles.linha}>
        <Image source={SELO_STATUS[casinha.status]} style={styles.selo} />
        <ThemedText type="smallBold" style={styles.nome} numberOfLines={2}>
          {casinha.nome}
        </ThemedText>
      </View>
      <ThemedText type="small">{tm.status[casinha.status]}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {precisa ? `${tm.precisaDe}: ${precisa}` : tm.nadaFaltando}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {[casinha.souAdotante && t.voceAdota, casinha.souCriador && t.criadaPorVoce]
          .filter(Boolean)
          .join(' · ')}
      </ThemedText>
    </Pressable>
  );
}

/** Casinhas que a pessoa criou ou adota, da mais grave para a mais tranquila (a API ordena). */
export default function MinhasCasinhasScreen() {
  const consulta = useMinhasCasinhas();
  const erro = consulta.error;
  const semConexao = erro instanceof ErroApi && erro.semConexao;

  const aviso = !erro ? null : semConexao && consulta.data ? (
    <AvisoMapa texto={t.offline(hora(consulta.dataUpdatedAt))} />
  ) : (
    <AvisoMapa
      texto={t.erro}
      acao={{ rotulo: t.tentarDeNovo, aoTocar: () => consulta.refetch() }}
    />
  );

  return (
    <ThemedView style={styles.tela}>
      <SafeAreaView style={styles.tela} edges={['top']}>
        <FlatList
          data={consulta.data ?? []}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.lista}
          refreshControl={
            <RefreshControl
              refreshing={consulta.isRefetching}
              onRefresh={() => consulta.refetch()}
            />
          }
          ListHeaderComponent={
            <View style={styles.cabecalho}>
              <ThemedText type="subtitle">{t.titulo}</ThemedText>
              <ThemedText themeColor="textSecondary">{t.compromisso}</ThemedText>
              {aviso}
            </View>
          }
          ListEmptyComponent={
            <ThemedText themeColor="textSecondary">
              {consulta.isPending ? t.carregando : t.vazio}
            </ThemedText>
          }
          renderItem={({ item }) => <Cartao casinha={item} />}
        />
      </SafeAreaView>
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
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  cartao: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderLeftWidth: 6,
    gap: Spacing.half,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  selo: {
    width: 28,
    height: 28,
  },
  nome: {
    flex: 1,
    fontSize: 17,
  },
});
