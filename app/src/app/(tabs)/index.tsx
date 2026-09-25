import type { CameraRef } from '@maplibre/maplibre-react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCasinhasNaArea } from '@/api/casinhas';
import { ErroApi } from '@/api/cliente';
import type { CasinhaNoMapa } from '@/api/tipos';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAtrasado } from '@/hooks/use-atrasado';
import { useTheme } from '@/hooks/use-theme';
import { textos } from '@/i18n/pt-BR';
import { areaDaVista } from '@/map/area';
import { AvisoMapa } from '@/map/aviso-mapa';
import { BarraFiltros } from '@/map/barra-filtros';
import { CamadaCasinhas } from '@/map/camada-casinhas';
import { CartaoCasinha } from '@/map/cartao-casinha';
import { filtrarCasinhas, SEM_FILTROS, temFiltro, type Filtros } from '@/map/filtros';
import { Legenda } from '@/map/legenda';
import { MapaBase, type Vista } from '@/map/mapa-base';
import { useFila } from '@/offline/outbox/use-fila';

const t = textos.mapa;
/** Espera o mapa parar de mexer antes de buscar (evita uma consulta por quadro). */
const ESPERA_BUSCA_MS = 400;
/** Altura da barra de filtros, para a bússola ficar abaixo dela. */
const ALTURA_BARRA = 56;

function horaDosDados(instante: number) {
  const data = new Date(instante);
  const hora = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (data.toDateString() === new Date().toDateString()) return hora;
  return `${data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${hora}`;
}

export default function MapaScreen() {
  const cores = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const fila = useFila();
  const comErro = fila.filter((item) => item.status === 'erro_permanente').length;
  const aguardando = fila.length - comErro;
  const cameraRef = useRef<CameraRef>(null);

  const [vista, setVista] = useState<Vista | null>(null);
  const [filtros, setFiltros] = useState<Filtros>(SEM_FILTROS);
  const [legendaAberta, setLegendaAberta] = useState(false);
  const [selecionada, setSelecionada] = useState<CasinhaNoMapa | null>(null);

  const vistaParada = useAtrasado(vista, ESPERA_BUSCA_MS);
  const area = useMemo(
    () => (vistaParada ? areaDaVista(vistaParada.limites, vistaParada.zoom) : null),
    [vistaParada],
  );
  const consulta = useCasinhasNaArea(area);
  const todas = consulta.data?.casinhas;
  const casinhas = useMemo(() => filtrarCasinhas(todas ?? [], filtros), [todas, filtros]);

  const aviso = (() => {
    if (vistaParada && !area) return <AvisoMapa texto={t.aproxime} />;
    if (consulta.isError) {
      const semConexao = consulta.error instanceof ErroApi && consulta.error.semConexao;
      if (semConexao && consulta.data) {
        return <AvisoMapa texto={t.offline(horaDosDados(consulta.dataUpdatedAt))} />;
      }
      return (
        <AvisoMapa
          texto={semConexao ? t.semConexao : t.erro}
          acao={{ rotulo: t.tentarDeNovo, aoTocar: () => consulta.refetch() }}
        />
      );
    }
    if (!consulta.data && consulta.isFetching) return <AvisoMapa texto={t.carregando} carregando />;
    if (consulta.data?.truncado) return <AvisoMapa texto={t.muitas} />;
    if (temFiltro(filtros) && todas?.length && casinhas.length === 0) {
      return <AvisoMapa texto={t.nenhumaNoFiltro} />;
    }
    return null;
  })();

  return (
    <View style={styles.tela}>
      <MapaBase
        cameraRef={cameraRef}
        espacoTopo={ALTURA_BARRA}
        aoMudarVista={setVista}
        aoTocarMapa={() => setSelecionada(null)}>
        <CamadaCasinhas
          casinhas={casinhas}
          aoTocarCasinha={setSelecionada}
          aoTocarGrupo={(centro, zoom) =>
            cameraRef.current?.easeTo({ center: centro, zoom, duration: 500 })
          }
        />
      </MapaBase>

      <View
        style={[styles.topo, { paddingTop: insets.top + Spacing.two }]}
        pointerEvents="box-none">
        <BarraFiltros
          filtros={filtros}
          aoMudar={setFiltros}
          legendaAberta={legendaAberta}
          aoAlternarLegenda={() => setLegendaAberta((aberta) => !aberta)}
        />
        {legendaAberta && <Legenda />}
        {aviso}
        {(aguardando > 0 || comErro > 0) && (
          <AvisoMapa
            texto={[
              aguardando > 0 && textos.pendencias.aguardando(aguardando),
              comErro > 0 && textos.pendencias.comErro(comErro),
            ]
              .filter(Boolean)
              .join(' · ')}
            acao={{ rotulo: textos.pendencias.ver, aoTocar: () => router.push('/pendencias') }}
          />
        )}
      </View>

      {selecionada ? (
        <View style={styles.rodape} pointerEvents="box-none">
          <CartaoCasinha casinha={selecionada} aoFechar={() => setSelecionada(null)} />
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.novaCasinha}
          onPress={() => Alert.alert(t.novaCasinha, t.novaCasinhaEmBreve)}
          style={({ pressed }) => [
            styles.botaoNova,
            { backgroundColor: cores.primary, opacity: pressed ? 0.8 : 1 },
          ]}>
          <SymbolView
            name={{ ios: 'plus', android: 'add' }}
            tintColor={cores.background}
            size={24}
          />
          <ThemedText type="smallBold" style={{ color: cores.background }}>
            {t.novaCasinha}
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tela: {
    flex: 1,
  },
  topo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    gap: Spacing.two,
  },
  rodape: {
    position: 'absolute',
    left: 0,
    right: 0,
    // Acima do botão "minha localização" (56 dp em bottom: 32), que continua acessível.
    bottom: Spacing.five + 56 + Spacing.three,
  },
  botaoNova: {
    position: 'absolute',
    right: Spacing.three,
    // Acima do botão "minha localização" (56 dp em bottom: 32).
    bottom: Spacing.five + 56 + Spacing.three,
    minHeight: 52,
    paddingHorizontal: Spacing.three,
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    elevation: 4,
  },
});
