import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { atender, checkIn, reconfirmar } from '@/api/acoes';
import { adotar, deixarDeAdotar } from '@/api/adocao';
import { useCasinha } from '@/api/casinhas';
import { ErroApi } from '@/api/cliente';
import type { CasinhaDetalhe, FotoUrls } from '@/api/tipos';
import { useSessao } from '@/auth/sessao';
import { Botao } from '@/components/botao';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { tempoRelativo, textoAtividade } from '@/domain/historico';
import { COR_STATUS, PINO_STATUS, SELO_STATUS } from '@/domain/status';
import { MAXIMO_FOTOS_DA_CASINHA } from '@/fotos/dimensoes';
import { enviarFoto } from '@/fotos/enviar';
import { escolherFoto } from '@/fotos/escolher';
import { FotoAmpliada, Galeria, Miniatura } from '@/fotos/galeria';
import { prepararFoto } from '@/fotos/pendentes';
import { textos } from '@/i18n/pt-BR';
import { AvisoMapa } from '@/map/aviso-mapa';
import { useFila } from '@/offline/outbox/use-fila';

const t = textos.casinha;
const tm = textos.mapa;

const ta = textos.adocao;
const tf = textos.fotos;

/** Ações que ainda não existem na API (editar: com o cadastro, T1.6). */
const emBreve = (acao: string) => Alert.alert(acao, t.emBreve);

const mensagemDeErro = (erro: unknown, semConexao: string, generica: string) =>
  erro instanceof ErroApi ? (erro.semConexao ? semConexao : erro.message) : generica;

/**
 * Adotar (com o compromisso explicado antes) e deixar de adotar. Online, com resposta na hora:
 * quem adota precisa estar perto da casinha agora (RF04.1).
 */
function Adocao({ casinha }: { casinha: CasinhaDetalhe }) {
  const [ocupado, setOcupado] = useState(false);
  const p = casinha.minhasPermissoes;

  async function executar(acao: () => Promise<string>) {
    setOcupado(true);
    try {
      Alert.alert(await acao());
    } catch (erro) {
      Alert.alert(mensagemDeErro(erro, ta.semConexao, ta.erro));
    } finally {
      setOcupado(false);
    }
  }

  const pedirAdocao = () =>
    Alert.alert(ta.confirmarTitulo, ta.compromisso, [
      { text: ta.cancelar, style: 'cancel' },
      {
        text: ta.confirmar,
        onPress: () =>
          void executar(async () => {
            const resultado = await adotar(casinha.id);
            if (resultado === 'ok') return ta.adotou;
            return resultado === 'sem_posicao' ? ta.semPosicao : ta.naoPermitido;
          }),
      },
    ]);

  const pedirSaida = () =>
    Alert.alert(ta.deixarTitulo, ta.deixarMensagem, [
      { text: ta.cancelar, style: 'cancel' },
      {
        text: ta.deixar,
        style: 'destructive',
        onPress: () =>
          void executar(async () => {
            await deixarDeAdotar(casinha.id);
            return ta.deixou;
          }),
      },
    ]);

  return (
    <>
      {p.adotar && (
        <>
          <Botao
            titulo={t.adotar}
            variante="secundario"
            carregando={ocupado}
            onPress={pedirAdocao}
          />
          <ThemedText type="small" themeColor="textSecondary">
            {ta.compromisso}
          </ThemedText>
        </>
      )}
      {p.deixarDeAdotar && (
        <Botao
          titulo={t.deixarDeAdotar}
          variante="texto"
          carregando={ocupado}
          onPress={pedirSaida}
        />
      )}
    </>
  );
}

/** Fotos de perfil. Quem cuida da casinha adiciona (vai pela fila: funciona offline). */
function Fotos({ casinha }: { casinha: CasinhaDetalhe }) {
  const [preparando, setPreparando] = useState(false);

  async function adicionar() {
    const original = await escolherFoto();
    if (!original) return;
    setPreparando(true);
    try {
      await enviarFoto(casinha.id, await prepararFoto(original));
    } catch {
      Alert.alert(tf.erroPreparar);
    } finally {
      setPreparando(false);
    }
  }

  return (
    <Galeria
      fotos={casinha.fotos}
      podeAdicionar={
        casinha.minhasPermissoes.editar && casinha.fotos.length < MAXIMO_FOTOS_DA_CASINHA
      }
      preparando={preparando}
      aoAdicionar={() => void adicionar()}
    />
  );
}

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
  const [fotoAmpliada, setFotoAmpliada] = useState<FotoUrls | null>(null);

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

        {(casinha.fotos.length > 0 || p.editar) && (
          <Secao titulo={tf.titulo}>
            <Fotos casinha={casinha} />
          </Secao>
        )}

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
          <Adocao casinha={casinha} />
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
              {a.foto && (
                <Miniatura
                  foto={a.foto}
                  tamanho={64}
                  rotulo={tf.fotoDaAtividade}
                  aoTocar={() => setFotoAmpliada(a.foto)}
                />
              )}
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
              onPress={() =>
                router.push({
                  pathname: '/desativacao/[casinhaId]',
                  params: { casinhaId: casinha.id },
                })
              }
            />
          )}
          {p.denunciar && (
            <Botao
              titulo={t.denunciar}
              variante="texto"
              onPress={() =>
                router.push({
                  pathname: '/denunciar/[casinhaId]',
                  params: { casinhaId: casinha.id },
                })
              }
            />
          )}
        </View>
      </ScrollView>
      <FotoAmpliada foto={fotoAmpliada} aoFechar={() => setFotoAmpliada(null)} />

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
