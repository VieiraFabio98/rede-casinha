import {
  Camera,
  Map,
  NativeUserLocation,
  type CameraRef,
  type LngLat,
  type LngLatBounds,
  type MapRef,
} from '@maplibre/maplibre-react-native';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { textos } from '@/i18n/pt-BR';

import { lerCamera, salvarCamera } from './camera-salva';
import {
  CAMERA_PADRAO,
  ESTILO_MAPA_URL,
  ZOOM_LOCALIZACAO,
  ZOOM_MAXIMO,
  ZOOM_MINIMO,
  type CameraSalva,
} from './estilo';
import {
  jaPerguntouLocalizacao,
  pedirPermissaoLocalizacao,
  posicaoAtual,
  posicaoRecente,
  temPermissaoLocalizacao,
} from './localizacao';

const t = textos.mapa;

function centralizar(camera: CameraRef | null, centro: LngLat) {
  try {
    // O easeTo devolve a Promise do módulo nativo, apesar do tipo `void`.
    void Promise.resolve(
      camera?.easeTo({ center: centro, zoom: ZOOM_LOCALIZACAO, duration: 800 }),
    ).catch(() => {});
  } catch {
    // Câmera ainda não montada: o mapa fica na posição inicial.
  }
}

export interface Vista {
  limites: LngLatBounds;
  zoom: number;
}

interface Props {
  /** Camadas do mapa (ex.: casinhas). */
  children?: ReactNode;
  /** Para quem está fora mover a câmera (ex.: aproximar num grupo). */
  cameraRef?: RefObject<CameraRef | null>;
  /** Área e zoom visíveis: ao abrir e a cada movimento terminado. */
  aoMudarVista?: (vista: Vista) => void;
  /** Toque no mapa fora das camadas interativas. */
  aoTocarMapa?: () => void;
  /** Espaço reservado no topo (barra de filtros): a bússola aparece abaixo dele. */
  espacoTopo?: number;
}

/**
 * Mapa com a câmera inicial resolvida assim: localização do usuário (se já há
 * permissão) → última câmera salva → região padrão.
 */
export function MapaBase({
  children,
  cameraRef: cameraExterna,
  aoMudarVista,
  aoTocarMapa,
  espacoTopo = 0,
}: Props) {
  const cores = useTheme();
  const insets = useSafeAreaInsets();
  const mapaRef = useRef<MapRef>(null);
  const cameraInterna = useRef<CameraRef>(null);
  const cameraRef = cameraExterna ?? cameraInterna;
  const usuarioMexeu = useRef(false);
  const iniciou = useRef(false);

  const [inicio, setInicio] = useState<CameraSalva | null>(null);
  const [comPermissao, setComPermissao] = useState(false);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    if (iniciou.current) return;
    iniciou.current = true;

    (async () => {
      let permitido = await temPermissaoLocalizacao();
      const recente = permitido ? await posicaoRecente().catch(() => null) : null;
      setInicio(
        recente ? { centro: recente, zoom: ZOOM_LOCALIZACAO } : (lerCamera() ?? CAMERA_PADRAO),
      );

      // No primeiro uso, explica e pede a permissão uma vez; depois, só pelo botão.
      if (!permitido && !jaPerguntouLocalizacao()) permitido = await pedirPermissaoLocalizacao();
      setComPermissao(permitido);

      if (permitido && !recente) {
        const atual = await posicaoAtual().catch(() => null);
        // Não puxa a câmera se a pessoa já começou a navegar pelo mapa.
        if (atual && !usuarioMexeu.current) centralizar(cameraRef.current, atual);
      }
    })();
  }, [cameraRef]);

  async function irParaMinhaLocalizacao() {
    const permitido = await pedirPermissaoLocalizacao();
    setComPermissao(permitido);
    if (!permitido) return;

    setBuscando(true);
    try {
      const recente = await posicaoRecente().catch(() => null);
      if (recente) centralizar(cameraRef.current, recente);
      centralizar(cameraRef.current, await posicaoAtual());
    } catch {
      Alert.alert(t.localizacao.falhaTitulo, t.localizacao.falhaMensagem);
    } finally {
      setBuscando(false);
    }
  }

  if (!inicio) return <ThemedView style={styles.container} />;

  return (
    <ThemedView style={styles.container}>
      <Map
        ref={mapaRef}
        mapStyle={ESTILO_MAPA_URL}
        touchPitch={false}
        attribution={false}
        logo={false}
        compassPosition={{ top: insets.top + espacoTopo + Spacing.two, right: Spacing.two }}
        onPress={aoTocarMapa}
        onDidFinishLoadingMap={() => {
          mapaRef.current
            ?.getViewState()
            .then((v) => aoMudarVista?.({ limites: v.bounds, zoom: v.zoom }))
            .catch(() => {});
        }}
        onRegionWillChange={(e) => {
          if (e.nativeEvent.userInteraction) usuarioMexeu.current = true;
        }}
        onRegionDidChange={(e) => {
          const { center, zoom, bounds } = e.nativeEvent;
          salvarCamera({ centro: center, zoom });
          aoMudarVista?.({ limites: bounds, zoom });
        }}>
        <Camera
          ref={cameraRef}
          initialViewState={{ center: inicio.centro, zoom: inicio.zoom }}
          minZoom={ZOOM_MINIMO}
          maxZoom={ZOOM_MAXIMO}
        />
        {comPermissao && <NativeUserLocation />}
        {children}
      </Map>

      {/* Atribuição sempre visível (exigência da licença ODbL do OpenStreetMap). */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.verAtribuicao}
        hitSlop={Spacing.two}
        onPress={() => mapaRef.current?.showAttribution()}
        style={[styles.atribuicao, { backgroundColor: cores.background }]}>
        <ThemedText type="small" themeColor="textSecondary">
          {t.atribuicao}
        </ThemedText>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.minhaLocalizacao}
        accessibilityState={{ busy: buscando }}
        disabled={buscando}
        onPress={irParaMinhaLocalizacao}
        style={({ pressed }) => [
          styles.botaoLocalizacao,
          { backgroundColor: cores.background, opacity: pressed ? 0.8 : 1 },
        ]}>
        {buscando ? (
          <ActivityIndicator color={cores.primary} />
        ) : (
          <SymbolView
            name={{ ios: 'location', android: 'my_location' }}
            tintColor={cores.primary}
            size={26}
          />
        )}
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  atribuicao: {
    position: 'absolute',
    left: Spacing.two,
    bottom: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.one,
    opacity: 0.85,
  },
  botaoLocalizacao: {
    position: 'absolute',
    right: Spacing.three,
    bottom: Spacing.five,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
});
