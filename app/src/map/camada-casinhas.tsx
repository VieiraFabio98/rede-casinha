import type {
  DataDrivenPropertyValueSpecification,
  ExpressionSpecification,
} from '@maplibre/maplibre-gl-style-spec';
import {
  GeoJSONSource,
  Images,
  Layer,
  type FilterSpecification,
  type GeoJSONSourceRef,
  type LngLat,
} from '@maplibre/maplibre-react-native';
import { useMemo, useRef } from 'react';

import type { CasinhaNoMapa } from '@/api/tipos';
import { COR_STATUS, PINO_STATUS, SELO_STATUS, SEVERIDADE } from '@/domain/status';

/** Raio do círculo da área aproximada (RF01.4): cobre o deslocamento máximo de 400 m. */
const RAIO_AREA_M = 500;
/** A partir deste zoom as casinhas aproximadas aparecem como área de 500 m. */
export const ZOOM_AREAS = 14;
/** Até este zoom, casinhas próximas viram grupos (clusters). */
const ZOOM_MAXIMO_GRUPOS = ZOOM_AREAS - 1;

/** Metros por pixel no zoom 0 (tiles de 512 px) no equador. */
const METROS_POR_PIXEL_Z0 = 40_075_016.686 / 512;

/** Raio em pixels, no zoom 14, de um círculo de 500 m nesta latitude. */
const raioNoZoom14 = (lat: number) =>
  RAIO_AREA_M / ((METROS_POR_PIXEL_Z0 * Math.cos((lat * Math.PI) / 180)) / 2 ** ZOOM_AREAS);

const imagens = Object.fromEntries([
  ...Object.entries(PINO_STATUS).map(([status, img]) => [`pino-${status}`, img]),
  ...Object.entries(SELO_STATUS).map(([status, img]) => [`selo-${status}`, img]),
]);

const { ok, atencao, urgente, sem_noticias } = COR_STATUS;

/** Cor por status (casinhas soltas). */
const corPorStatus: DataDrivenPropertyValueSpecification<string> = [
  'match',
  ['get', 'status'],
  'ok',
  ok.cor,
  'atencao',
  atencao.cor,
  'urgente',
  urgente.cor,
  sem_noticias.cor,
];

/** Cor e texto do grupo pela PIOR severidade entre as casinhas dele. */
const porSeveridade = (campo: 'cor' | 'corTexto'): DataDrivenPropertyValueSpecification<string> => [
  'match',
  ['get', 'severidade'],
  SEVERIDADE.ok,
  ok[campo],
  SEVERIDADE.atencao,
  atencao[campo],
  SEVERIDADE.urgente,
  urgente[campo],
  sem_noticias[campo],
];

const ehGrupo: ExpressionSpecification = ['has', 'point_count'];
const soltaAproximada: FilterSpecification = [
  'all',
  ['!', ehGrupo],
  ['!=', ['get', 'exata'], true],
];
const soltaExata: FilterSpecification = ['all', ['!', ehGrupo], ['==', ['get', 'exata'], true]];

interface Props {
  casinhas: CasinhaNoMapa[];
  aoTocarCasinha: (casinha: CasinhaNoMapa) => void;
  /** Toque num grupo: o mapa aproxima até o zoom em que o grupo se abre. */
  aoTocarGrupo: (centro: LngLat, zoom: number) => void;
}

/**
 * Casinhas no mapa: grupos coloridos pela pior situação, pino (cor + símbolo) para quem vê o
 * local exato e selo + círculo de 500 m para o local aproximado. Filho de `<Map>`.
 */
export function CamadaCasinhas({ casinhas, aoTocarCasinha, aoTocarGrupo }: Props) {
  const fonte = useRef<GeoJSONSourceRef>(null);

  const { dados, porId } = useMemo(() => {
    const colecao: GeoJSON.FeatureCollection<GeoJSON.Point> = {
      type: 'FeatureCollection',
      features: casinhas.map((c) => ({
        type: 'Feature',
        id: c.id,
        geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
        properties: {
          id: c.id,
          status: c.status,
          severidade: SEVERIDADE[c.status],
          exata: c.exata,
          raio14: raioNoZoom14(c.lat),
        },
      })),
    };
    return { dados: colecao, porId: new Map(casinhas.map((c) => [c.id, c])) };
  }, [casinhas]);

  return (
    <>
      <Images images={imagens} />
      <GeoJSONSource
        id="casinhas"
        ref={fonte}
        data={dados}
        cluster
        clusterRadius={50}
        clusterMaxZoom={ZOOM_MAXIMO_GRUPOS}
        clusterProperties={{ severidade: ['max', ['get', 'severidade']] }}
        onPress={async (evento) => {
          const alvo = evento.nativeEvent.features[0];
          if (!alvo) return;
          // Não deixa o toque chegar ao mapa (que fecharia o cartão da casinha).
          evento.stopPropagation();
          const props = alvo.properties ?? {};
          if (props.cluster) {
            const zoom = await fonte.current
              ?.getClusterExpansionZoom(props.cluster_id)
              .catch(() => null);
            const [lng, lat] = (alvo.geometry as GeoJSON.Point).coordinates;
            aoTocarGrupo([lng, lat], (zoom ?? ZOOM_MAXIMO_GRUPOS) + 0.5);
            return;
          }
          const casinha = porId.get(props.id);
          if (casinha) aoTocarCasinha(casinha);
        }}>
        {/* Área aproximada: círculo de 500 m reais (o raio em pixels dobra a cada zoom). */}
        <Layer
          id="casinhas-area"
          type="circle"
          minzoom={ZOOM_AREAS}
          filter={soltaAproximada}
          paint={{
            'circle-radius': [
              'interpolate',
              ['exponential', 2],
              ['zoom'],
              ZOOM_AREAS,
              ['get', 'raio14'],
              22,
              ['*', ['get', 'raio14'], 2 ** (22 - ZOOM_AREAS)],
            ],
            'circle-color': corPorStatus,
            'circle-opacity': 0.15,
            'circle-stroke-color': corPorStatus,
            'circle-stroke-width': 2,
            'circle-stroke-opacity': 0.7,
            'circle-pitch-alignment': 'map',
          }}
        />
        <Layer
          id="casinhas-aproximadas"
          type="symbol"
          filter={soltaAproximada}
          layout={{
            'icon-image': ['concat', 'selo-', ['get', 'status']],
            'icon-size': ['interpolate', ['linear'], ['zoom'], 9, 0.7, ZOOM_AREAS, 1],
            'icon-allow-overlap': true,
            'symbol-sort-key': ['get', 'severidade'],
          }}
        />
        <Layer
          id="casinhas-exatas"
          type="symbol"
          filter={soltaExata}
          layout={{
            'icon-image': ['concat', 'pino-', ['get', 'status']],
            'icon-anchor': 'bottom',
            'icon-allow-overlap': true,
            'symbol-sort-key': ['get', 'severidade'],
          }}
        />
        <Layer
          id="casinhas-grupos"
          type="circle"
          filter={ehGrupo}
          paint={{
            'circle-color': porSeveridade('cor'),
            'circle-radius': ['step', ['get', 'point_count'], 18, 10, 22, 50, 28],
            'circle-stroke-color': '#FFFFFF',
            'circle-stroke-width': 2.5,
          }}
        />
        <Layer
          id="casinhas-grupos-contagem"
          type="symbol"
          filter={ehGrupo}
          layout={{
            'text-field': ['get', 'point_count_abbreviated'],
            'text-font': ['Noto Sans Bold'],
            'text-size': 15,
            'text-allow-overlap': true,
          }}
          paint={{ 'text-color': porSeveridade('corTexto') }}
        />
      </GeoJSONSource>
    </>
  );
}
