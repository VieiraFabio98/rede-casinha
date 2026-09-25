import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { atender, checkIn, reconfirmar } from '@/api/acoes';
import { useCasinha } from '@/api/casinhas';
import { ErroApi } from '@/api/cliente';
import type { CasinhaDetalhe } from '@/api/tipos';
import { useSessao } from '@/auth/sessao';
import { Botao } from '@/components/botao';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { tempoRelativo, textoAtividade } from '@/domain/historico';
import { COR_STATUS, PINO_STATUS, SELO_STATUS } from '@/domain/status';
import { textos } from '@/i18n/pt-BR';
import { AvisoMapa } from '@/map/aviso-mapa';
import { useFila } from '@/offline/outbox/use-fila';

const t = textos.casinha;
const tm = textos.mapa;

/** Ações que ainda não existem na API: cada uma chega na sua task (T1.9, T1.10…). */
const emBreve = (acao: string) => Alert.alert(acao, t.emBreve);

function horaDosDados(instante: number) {
  return new Date(instante).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Abre o app de mapas do celular no local exato (só chamado com `exata = true`). */
async function comoChegar(c: CasinhaDetalhe) {
  const rotulo = encodeURIComponent(c.nome);
  try {
    await Linking.openURL(`geo:${c.lat},${c.lng}?q=${c.lat},${c.lng}(${rotulo})`);
  } catch {
    try {
      await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}`);
    } catch {
      Alert.alert(t.comoChegar, t.semMapas);
    }
  }
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View style={styles.secao}>
      <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header">
        {titulo.toUpperCase()}
      </ThemedText>
      {children}
    </View>
  );
}

/** Selo de algo feito no celular que ainda não chegou ao servidor. */
function AguardandoEnvio() {
  return (
    <ThemedText type="small" themeColor="textSecondary">
      {t.aguardandoEnvio}
    </ThemedText>
  );
}

function Necessidades({
  casinha,
  pendentes,
  apelido,
}: {
  casinha: CasinhaDetalhe;
  pendentes: Set<string>;
  apelido: string;
}) {
  if (casinha.necessidadesAbertas.length === 0) {
    return <ThemedText>{t.nadaFaltando}</ThemedText>;
  }
  return casinha.necessidadesAbertas.map((n) => {
    const nome = tm.necessidades[n.tipo];
    const urgente = n.urgencia === 'urgente';
    return (
      <ThemedView
        key={n.id}
        type="backgroundElement"
        style={[styles.necessidade, urgente && { borderColor: COR_STATUS.urgente.cor }]}>
        <View style={styles.linha}>
          <ThemedText type="smallBold" style={styles.nomeNecessidade}>
            {nome}
          </ThemedText>
          {urgente && (
            <View style={[styles.etiqueta, { backgroundColor: COR_STATUS.urgente.cor }]}>
              <ThemedText type="small" style={{ color: COR_STATUS.urgente.corTexto }}>
                {t.urgente}
              </ThemedText>
            </View>
          )}
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {t.pedidoHa(tempoRelativo(n.criadaEm))}
        </ThemedText>
        {n.observacao && <ThemedText type="small">{n.observacao}</ThemedText>}
        {pendentes.has(n.id) && <AguardandoEnvio />}
        <View style={styles.botoesNecessidade}>
          <Botao
            titulo={n.tipo === 'racao' || n.tipo === 'agua' ? t.abasteci : t.atendi}
            accessibilityHint={t.abasteciDica(nome.toLowerCase())}
            onPress={() => void atender(casinha.id, n, apelido)}
            style={styles.botaoNecessidade}
          />
          <Botao
            titulo={t.aindaPrecisa}
            variante="secundario"
            accessibilityHint={t.aindaPrecisaDica(nome.toLowerCase())}
            onPress={() => void reconfirmar(casinha.id, n, apelido)}
            style={styles.botaoNecessidade}
          />
        </View>
      </ThemedView>
    );
  });
}

export default function CasinhaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const consulta = useCasinha(id);
  const casinha = consulta.data;
  const apelido = useSessao().me?.perfil?.apelido ?? '';
  const pendentes = new Set(useFila().map((item) => item.id));

  const erro = consulta.error;
  const semConexao = erro instanceof ErroApi && erro.semConexao;
  const aviso = (() => {
    if (!erro) return null;
    if (semConexao && casinha)
      return <AvisoMapa texto={t.offline(horaDosDados(consulta.dataUpdatedAt))} />;
    if (erro instanceof ErroApi && erro.status === 404)
      return <AvisoMapa texto={t.naoEncontrada} />;
    return (
      <AvisoMapa
        texto={semConexao ? t.semConexao : t.erro}
        acao={{ rotulo: t.tentarDeNovo, aoTocar: () => consulta.refetch() }}
      />
    );
  })();

  if (!casinha) {
    return (
      <ThemedView style={[styles.tela, styles.centro]}>
        <Stack.Screen options={{ title: '' }} />
        {aviso ?? (
          <>
            <ActivityIndicator />
            <ThemedText themeColor="textSecondary">{t.carregando}</ThemedText>
          </>
        )}
      </ThemedView>
    );
  }

  const p = casinha.minhasPermissoes;
  return (
    <ThemedView style={styles.tela}>
      <Stack.Screen options={{ title: casinha.nome }} />
      <ScrollView contentContainerStyle={styles.conteudo}>
        {aviso}

        <View style={styles.cabecalho}>
          <View style={styles.linha}>
            <Image source={SELO_STATUS[casinha.status]} style={styles.seloGrande} />
            <ThemedText type="subtitle" style={styles.status}>
              {tm.status[casinha.status]}
            </ThemedText>
          </View>
          <ThemedText themeColor="textSecondary">{t.animais[casinha.animais]}</ThemedText>
          <View style={styles.linha}>
            {casinha.exata ? (
              <Image source={PINO_STATUS[casinha.status]} style={styles.pino} />
            ) : (
              <View style={styles.area} />
            )}
            <ThemedText type="small" style={styles.flex}>
              {casinha.exata ? tm.localExato : tm.localAproximado}
            </ThemedText>
          </View>
          {casinha.exata && (
            <Botao
              titulo={t.comoChegar}
              variante="secundario"
              onPress={() => comoChegar(casinha)}
            />
          )}
          {casinha.descricao && <ThemedText>{casinha.descricao}</ThemedText>}
        </View>

        <Secao titulo={t.oQueFalta}>
          <Necessidades casinha={casinha} pendentes={pendentes} apelido={apelido} />
        </Secao>

        {casinha.atendidasRecentemente.length > 0 && (
          <Secao titulo={t.resolvidoHaPouco}>
            {casinha.atendidasRecentemente.map((n) => (
              <View key={n.id} style={styles.atendida}>
                <View style={styles.flex}>
                  <ThemedText type="smallBold">{tm.necessidades[n.tipo]}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t.resolvidoPor(n.apelido ?? t.usuarioRemovido, tempoRelativo(n.atendidaEm))}
                  </ThemedText>
                </View>
                <Botao
                  titulo={t.naoFoiResolvido}
                  variante="texto"
                  onPress={() =>
                    router.push({
                      pathname: '/contestar/[necessidadeId]',
                      params: { necessidadeId: n.id, casinhaId: casinha.id },
                    })
                  }
                />
              </View>
            ))}
          </Secao>
        )}

        <Secao titulo={t.adotantes}>
          <ThemedText>
            {casinha.adotantes.length ? casinha.adotantes.join(', ') : t.ninguemAdotou}
          </ThemedText>
          {p.adotar && (
            <Botao titulo={t.adotar} variante="secundario" onPress={() => emBreve(t.adotar)} />
          )}
          {p.deixarDeAdotar && (
            <Botao
              titulo={t.deixarDeAdotar}
              variante="texto"
              onPress={() => emBreve(t.deixarDeAdotar)}
            />
          )}
        </Secao>

        <Secao titulo={t.historico}>
          {casinha.atividades.length === 0 && (
            <ThemedText themeColor="textSecondary">{t.semHistorico}</ThemedText>
          )}
          {casinha.atividades.map((a) => (
            <View key={a.id} style={styles.atividade}>
              <ThemedText>{textoAtividade(a)}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {tempoRelativo(a.criadaEm)}
                {a.observacao ? ` · ${a.observacao}` : ''}
                {pendentes.has(a.id) ? ` · ${t.aguardandoEnvio}` : ''}
              </ThemedText>
            </View>
          ))}
        </Secao>

        <View style={styles.acoesSecundarias}>
          {p.editar && (
            <Botao titulo={t.editar} variante="texto" onPress={() => emBreve(t.editar)} />
          )}
          {p.pedirDesativacao && (
            <Botao
              titulo={t.pedirDesativacao}
              variante="texto"
              onPress={() => emBreve(t.pedirDesativacao)}
            />
          )}
          {p.denunciar && (
            <Botao titulo={t.denunciar} variante="texto" onPress={() => emBreve(t.denunciar)} />
          )}
        </View>
      </ScrollView>

      {/* Ação principal no rodapé, no alcance do polegar. */}
      <ThemedView style={[styles.rodape, { paddingBottom: insets.bottom + Spacing.two }]}>
        <Botao
          titulo={t.reportar}
          style={styles.botaoRodape}
          onPress={() =>
            router.push({ pathname: '/reportar/[casinhaId]', params: { casinhaId: casinha.id } })
          }
        />
        <Botao
          titulo={t.passeiAqui}
          variante="secundario"
          style={styles.botaoRodape}
          onPress={async () => {
            await checkIn(casinha.id, apelido);
            Alert.alert(t.obrigadoCheckIn);
          }}
        />
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  tela: {
    flex: 1,
  },
  centro: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  conteudo: {
    padding: Spacing.three,
    gap: Spacing.four,
  },
  flex: {
    flex: 1,
  },
  cabecalho: {
    gap: Spacing.two,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  status: {
    flex: 1,
    fontSize: 24,
    lineHeight: 30,
  },
  seloGrande: {
    width: 36,
    height: 36,
  },
  pino: {
    width: 20,
    height: 26,
  },
  area: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#9E9E9E',
    backgroundColor: 'rgba(158,158,158,0.35)',
  },
  secao: {
    gap: Spacing.two,
  },
  necessidade: {
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  botoesNecessidade: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  atendida: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  nomeNecessidade: {
    fontSize: 18,
  },
  etiqueta: {
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
  },
  botaoNecessidade: {
    flex: 1,
    paddingHorizontal: Spacing.two,
  },
  atividade: {
    gap: Spacing.half,
  },
  acoesSecundarias: {
    alignItems: 'flex-start',
  },
  botaoRodape: {
    flex: 1,
    paddingHorizontal: Spacing.two,
  },
  rodape: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    elevation: 8,
  },
});
