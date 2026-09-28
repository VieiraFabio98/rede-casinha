import { Camera, Map } from '@maplibre/maplibre-react-native';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Botao } from '@/components/botao';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { AJUSTE_MAXIMO_M, ajusteDentroDoLimite } from '@/domain/cadastro';
import type { Ponto } from '@/domain/geo';
import { useTheme } from '@/hooks/use-theme';
import { textos } from '@/i18n/pt-BR';
import { ESTILO_MAPA_URL, ZOOM_MAXIMO } from '@/map/estilo';

const t = textos.novaCasinha;
const TAMANHO_PINO = 48;

/**
 * Ajuste manual (RF02.1): o pino fica fixo no centro e a pessoa arrasta o mapa. Só confirma a
 * até 50 m da leitura do GPS, e pede confirmação antes de aceitar.
 */
export function AjustePino({
  gps,
  aoConfirmar,
  aoVoltar,
}: {
  gps: Ponto;
  aoConfirmar: (pino: Ponto) => void;
  aoVoltar: () => void;
}) {
  const cores = useTheme();
  const insets = useSafeAreaInsets();
  const [pino, setPino] = useState<Ponto>(gps);
  const dentro = ajusteDentroDoLimite(gps, pino);

  const confirmar = () =>
    Alert.alert(t.confirmarTitulo, t.confirmarMensagem, [
      { text: t.cancelar, style: 'cancel' },
      { text: t.confirmar, onPress: () => aoConfirmar(pino) },
    ]);

  return (
    <ThemedView style={styles.tela}>
      <ThemedText style={styles.instrucao}>{t.passoAjuste}</ThemedText>
      <View style={styles.mapa}>
        <Map
          style={styles.flex}
          mapStyle={ESTILO_MAPA_URL}
          touchPitch={false}
          touchRotate={false}
          attribution={false}
          logo={false}
          onRegionDidChange={(e) => {
            const [lng, lat] = e.nativeEvent.center;
            setPino({ lat, lng });
          }}>
          <Camera
            initialViewState={{ center: [gps.lng, gps.lat], zoom: 18 }}
            maxZoom={ZOOM_MAXIMO}
          />
        </Map>
        {/* A ponta do pino marca o centro do mapa. */}
        <View pointerEvents="none" style={styles.pino}>
          <SymbolView
            name={{ ios: 'mappin', android: 'location_on' }}
            size={TAMANHO_PINO}
            tintColor={dentro ? cores.primary : '#C62828'}
          />
        </View>
      </View>
      <ThemedView style={[styles.rodape, { paddingBottom: insets.bottom + Spacing.two }]}>
        {!dentro && (
          <ThemedText type="small" style={styles.aviso}>
            {t.ajusteLonge(AJUSTE_MAXIMO_M)}
          </ThemedText>
        )}
        <Botao titulo={t.confirmarPino} disabled={!dentro} onPress={confirmar} />
        <Botao titulo={t.voltar} variante="texto" onPress={aoVoltar} />
      </ThemedView>
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
  instrucao: {
    padding: Spacing.three,
  },
  mapa: {
    flex: 1,
  },
  pino: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -TAMANHO_PINO / 2,
    marginTop: -TAMANHO_PINO,
  },
  rodape: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    gap: Spacing.one,
  },
  aviso: {
    color: '#C62828',
  },
});
