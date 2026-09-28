import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cadastrarCasinha, cadastrarMesmoAssim, desistirDoCadastro } from '@/api/cadastro';
import { chavesCasinhas } from '@/api/casinhas';
import { clienteConsultas } from '@/api/consultas';
import type { AnimaisAtendidos, CandidataDuplicata, ResultadoCadastro } from '@/api/tipos';
import { useSessao } from '@/auth/sessao';
import { AjustePino } from '@/cadastro/ajuste-pino';
import { Candidatas } from '@/cadastro/candidatas';
import { type LeituraGps, useLeituraGps } from '@/cadastro/use-leitura-gps';
import { Botao } from '@/components/botao';
import { CampoTexto } from '@/components/campo-texto';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import {
  MAXIMO_FOTOS,
  MINIMO_FOTOS,
  nomeValido,
  PRECISAO_MAXIMA_M,
  precisaoBoa,
} from '@/domain/cadastro';
import type { Ponto } from '@/domain/geo';
import { escolherFoto } from '@/fotos/escolher';
import { Galeria } from '@/fotos/galeria';
import { apagarArquivos, type FotoPreparada, prepararFoto } from '@/fotos/pendentes';
import { useTheme } from '@/hooks/use-theme';
import { textos } from '@/i18n/pt-BR';
import { pedirPermissaoLocalizacao } from '@/map/localizacao';
import { aguardarEnvio } from '@/offline/outbox/fila';

const t = textos.novaCasinha;
const ANIMAIS: AnimaisAtendidos[] = ['caes', 'gatos', 'ambos'];

type Etapa = 'posicao' | 'ajuste' | 'dados' | 'duplicata';

interface Local {
  ponto: Ponto;
  precisaoM: number;
  ajusteManual: boolean;
}

/** Passo 1 (RF02.1): espera o GPS chegar a 30 m ou oferece o ajuste manual do pino. */
function Posicao({
  ativo,
  aoUsar,
  aoAjustar,
}: {
  ativo: boolean;
  aoUsar: (local: Local) => void;
  aoAjustar: (gps: LeituraGps) => void;
}) {
  const cores = useTheme();
  const [permissao, setPermissao] = useState<'verificando' | 'ok' | 'negada'>('verificando');
  const gps = useLeituraGps(ativo && permissao === 'ok');

  async function pedir() {
    setPermissao('verificando');
    setPermissao((await pedirPermissaoLocalizacao()) ? 'ok' : 'negada');
  }
  useEffect(() => {
    let montado = true;
    void pedirPermissaoLocalizacao().then((ok) => montado && setPermissao(ok ? 'ok' : 'negada'));
    return () => {
      montado = false;
    };
  }, []);

  const melhor = gps.melhor;
  const boa = !!melhor && precisaoBoa(melhor.precisaoM);

  return (
    <ScrollView contentContainerStyle={styles.conteudo}>
      <ThemedText type="subtitle">{t.passoPosicao}</ThemedText>
      <ThemedText themeColor="textSecondary">{t.explicacaoPosicao}</ThemedText>

      {permissao === 'negada' && (
        <>
          <ThemedText>{t.semPermissao}</ThemedText>
          <Botao titulo={t.tentarDeNovo} onPress={() => void pedir()} />
        </>
      )}

      {permissao === 'ok' && gps.falhou && !melhor && (
        <>
          <ThemedText>{t.semGps}</ThemedText>
          <Botao titulo={t.tentarDeNovo} onPress={gps.recomecar} />
        </>
      )}

      {permissao === 'ok' && !gps.falhou && !melhor && (
        <View style={styles.linha}>
          <ActivityIndicator color={cores.primary} />
          <ThemedText>{t.buscandoGps}</ThemedText>
        </View>
      )}

      {melhor && (
        <ThemedView type="backgroundElement" style={styles.cartao}>
          <ThemedText
            type="subtitle"
            accessibilityLiveRegion="polite"
            style={{ color: boa ? cores.primary : cores.text }}>
            {t.precisao(melhor.precisaoM)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {boa ? t.precisaoBoa : gps.esgotou ? t.gpsNaoMelhorou : t.melhorando(PRECISAO_MAXIMA_M)}
          </ThemedText>
          {!boa && !gps.esgotou && <ActivityIndicator color={cores.primary} />}
        </ThemedView>
      )}

      {melhor && (
        <>
          <Botao
            titulo={t.usarPosicao}
            disabled={!boa}
            onPress={() =>
              aoUsar({
                ponto: { lat: melhor.lat, lng: melhor.lng },
                precisaoM: melhor.precisaoM,
                ajusteManual: false,
              })
            }
          />
          <Botao
            titulo={t.ajustarNoMapa}
            variante={boa ? 'texto' : 'secundario'}
            onPress={() => aoAjustar(melhor)}
          />
        </>
      )}
    </ScrollView>
  );
}

function OpcaoAnimais({
  rotulo,
  marcado,
  aoTocar,
}: {
  rotulo: string;
  marcado: boolean;
  aoTocar: () => void;
}) {
  const cores = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: marcado }}
      onPress={aoTocar}
      style={({ pressed }) => [
        styles.opcao,
        {
          backgroundColor: marcado ? cores.primary : cores.backgroundElement,
          opacity: pressed ? 0.8 : 1,
        },
      ]}>
      <ThemedText type="smallBold" style={{ color: marcado ? cores.background : cores.text }}>
        {rotulo}
      </ThemedText>
    </Pressable>
  );
}

/** Cadastro de casinha (RF02): posição, dados e fotos. Vai pela fila: funciona offline. */
export default function NovaCasinhaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const apelido = useSessao().me?.perfil?.apelido ?? '';

  const [etapa, setEtapa] = useState<Etapa>('posicao');
  const [gpsDoAjuste, setGpsDoAjuste] = useState<LeituraGps | null>(null);
  const [local, setLocal] = useState<Local | null>(null);
  const [nome, setNome] = useState('');
  const [animais, setAnimais] = useState<AnimaisAtendidos | null>(null);
  const [descricao, setDescricao] = useState('');
  const [fotos, setFotos] = useState<FotoPreparada[]>([]);
  const [preparandoFoto, setPreparandoFoto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [duplicata, setDuplicata] = useState<{
    id: string;
    candidatas: CandidataDuplicata[];
  } | null>(null);

  // Fotos preparadas e não enviadas não podem ficar esquecidas no celular.
  const fotosRef = useRef(fotos);
  useEffect(() => {
    fotosRef.current = fotos;
  }, [fotos]);
  const entregue = useRef(false);
  useEffect(
    () => () => {
      if (!entregue.current) {
        apagarArquivos(...fotosRef.current.flatMap((f) => [f.arquivo, f.miniatura]));
      }
    },
    [],
  );

  async function adicionarFoto() {
    const original = await escolherFoto();
    if (!original) return;
    setPreparandoFoto(true);
    try {
      const foto = await prepararFoto(original);
      setFotos((atual) => [...atual, foto]);
    } catch {
      Alert.alert(textos.fotos.erroPreparar);
    } finally {
      setPreparandoFoto(false);
    }
  }

  function removerFoto(id: string) {
    const foto = fotos.find((f) => f.id === id);
    if (foto) apagarArquivos(foto.arquivo, foto.miniatura);
    setFotos((atual) => atual.filter((f) => f.id !== id));
  }

  const abrirCasinha = (id: string) =>
    router.replace({ pathname: '/casinha/[id]', params: { id } });

  /** Acompanha o envio: sai para o detalhe, mostra as candidatas ou avisa do erro. */
  async function acompanhar(id: string) {
    const resultado = await aguardarEnvio(id);
    if (resultado.tipo === 'enviado') {
      const resposta = resultado.resposta as ResultadoCadastro | undefined;
      abrirCasinha(id);
      Alert.alert(t.cadastradaTitulo, resposta?.emRevisao ? t.emRevisao : t.cadastrada);
    } else if (resultado.tipo === 'pendente') {
      abrirCasinha(id);
      Alert.alert(t.salvaOfflineTitulo, t.salvaOffline);
    } else if (resultado.item.codigoErro === 'possivel_duplicata') {
      // Não foi criada: a versão otimista sai do mapa e de "Minhas casinhas".
      void clienteConsultas.invalidateQueries({ queryKey: chavesCasinhas.todas });
      setDuplicata({ id, candidatas: resultado.item.detalheErro as CandidataDuplicata[] });
      setEtapa('duplicata');
    } else {
      void clienteConsultas.invalidateQueries({ queryKey: chavesCasinhas.todas });
      router.back();
      Alert.alert(t.erroEnvioTitulo, t.erroEnvio(resultado.item.ultimoErro ?? ''));
    }
  }

  async function cadastrar() {
    if (!local || !animais) return;
    setEnviando(true);
    try {
      const id = await cadastrarCasinha(
        {
          nome,
          animais,
          descricao,
          posicao: local.ponto,
          precisaoM: local.precisaoM,
          ajusteManual: local.ajusteManual,
          fotos,
        },
        apelido,
      );
      // Daqui em diante os arquivos são da fila (ela apaga depois do envio).
      entregue.current = true;
      await acompanhar(id);
    } catch {
      Alert.alert(t.erroSalvar);
    } finally {
      setEnviando(false);
    }
  }

  async function eNova() {
    if (!duplicata) return;
    setEnviando(true);
    try {
      await cadastrarMesmoAssim(duplicata.id);
      await acompanhar(duplicata.id);
    } finally {
      setEnviando(false);
    }
  }

  async function eEsta(candidata: CandidataDuplicata) {
    if (duplicata) await desistirDoCadastro(duplicata.id);
    abrirCasinha(candidata.id);
  }

  const problemas = (
    [
      !nomeValido(nome) && t.faltaNome,
      !animais && t.faltaAnimais,
      fotos.length < MINIMO_FOTOS && t.faltaFoto,
    ] as (string | false)[]
  ).filter((p): p is string => !!p);

  if (etapa === 'ajuste' && gpsDoAjuste) {
    return (
      <>
        <Stack.Screen options={{ title: t.titulo }} />
        <AjustePino
          gps={gpsDoAjuste}
          aoVoltar={() => setEtapa('posicao')}
          aoConfirmar={(ponto) => {
            // Guarda a precisão da leitura do GPS; o ajuste manual é o que libera o cadastro.
            setLocal({ ponto, precisaoM: gpsDoAjuste.precisaoM, ajusteManual: true });
            setEtapa('dados');
          }}
        />
      </>
    );
  }

  return (
    <ThemedView style={styles.tela}>
      <Stack.Screen options={{ title: t.titulo }} />

      {etapa === 'posicao' && (
        <Posicao
          ativo
          aoUsar={(novo) => {
            setLocal(novo);
            setEtapa('dados');
          }}
          aoAjustar={(gps) => {
            setGpsDoAjuste(gps);
            setEtapa('ajuste');
          }}
        />
      )}

      {etapa === 'dados' && local && (
        <>
          <ScrollView contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
            <ThemedText type="subtitle">{t.passoDados}</ThemedText>
            <View style={styles.linha}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                {t.localMarcado(local.precisaoM, local.ajusteManual)}
              </ThemedText>
              <Botao titulo={t.mudarLocal} variante="texto" onPress={() => setEtapa('posicao')} />
            </View>

            <CampoTexto
              rotulo={t.nome}
              placeholder={t.dicaNome}
              value={nome}
              onChangeText={setNome}
              maxLength={60}
            />

            <ThemedText type="smallBold">{t.animais}</ThemedText>
            <View style={styles.opcoes} accessibilityRole="radiogroup">
              {ANIMAIS.map((a) => (
                <OpcaoAnimais
                  key={a}
                  rotulo={textos.casinha.animais[a]}
                  marcado={animais === a}
                  aoTocar={() => setAnimais(a)}
                />
              ))}
            </View>

            <CampoTexto
              rotulo={t.descricao}
              placeholder={t.dicaDescricao}
              value={descricao}
              onChangeText={setDescricao}
              maxLength={500}
              multiline
            />

            <ThemedText type="smallBold">{t.fotos}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t.dicaFotos(MINIMO_FOTOS, MAXIMO_FOTOS)}
            </ThemedText>
            <Galeria
              fotos={fotos.map((f) => ({ id: f.id, url: f.arquivo, urlMiniatura: f.miniatura }))}
              podeAdicionar={fotos.length < MAXIMO_FOTOS}
              preparando={preparandoFoto}
              aoAdicionar={() => void adicionarFoto()}
              aoRemover={removerFoto}
            />
          </ScrollView>

          <ThemedView style={[styles.rodape, { paddingBottom: insets.bottom + Spacing.two }]}>
            {problemas.length > 0 && (
              <ThemedText type="small" themeColor="textSecondary">
                {problemas.join(' ')}
              </ThemedText>
            )}
            <Botao
              titulo={enviando ? t.enviando : t.cadastrar}
              disabled={problemas.length > 0}
              carregando={enviando}
              onPress={() => void cadastrar()}
            />
          </ThemedView>
        </>
      )}

      {etapa === 'duplicata' && duplicata && (
        <ScrollView contentContainerStyle={styles.conteudo}>
          <ThemedText type="subtitle">{t.duplicataTitulo}</ThemedText>
          <ThemedText themeColor="textSecondary">{t.duplicataExplicacao}</ThemedText>
          <Candidatas candidatas={duplicata.candidatas} aoEscolher={(c) => void eEsta(c)} />
          <Botao
            titulo={t.eNova}
            variante="secundario"
            carregando={enviando}
            onPress={() => void eNova()}
          />
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  tela: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  conteudo: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  cartao: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  opcoes: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  opcao: {
    flex: 1,
    minHeight: 52,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  rodape: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    gap: Spacing.two,
    elevation: 8,
  },
});
