import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

import { ESPERA_GPS_MS } from '@/domain/cadastro';
import type { Ponto } from '@/domain/geo';

export interface LeituraGps extends Ponto {
  /** Raio de erro informado pelo GPS, em metros. */
  precisaoM: number;
}

/**
 * Acompanha o GPS em alta precisão enquanto `ativo`, guardando a melhor leitura (menor erro).
 * `esgotou` fica `true` depois de 60 s: hora de sugerir o ajuste manual do pino.
 */
export function useLeituraGps(ativo: boolean) {
  const [melhor, setMelhor] = useState<LeituraGps | null>(null);
  const [esgotou, setEsgotou] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (!ativo) return;
    let cancelado = false;
    let assinatura: Location.LocationSubscription | null = null;
    const timer = setTimeout(() => setEsgotou(true), ESPERA_GPS_MS);

    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1_000, distanceInterval: 0 },
      ({ coords }) => {
        const leitura = {
          lat: coords.latitude,
          lng: coords.longitude,
          // Sem precisão informada: trata como ruim (a API aceita até 10 km).
          precisaoM: coords.accuracy ?? 9_999,
        };
        setMelhor((atual) => (!atual || leitura.precisaoM <= atual.precisaoM ? leitura : atual));
      },
      () => setFalhou(true),
    )
      .then((s) => (cancelado ? s.remove() : (assinatura = s)))
      .catch(() => setFalhou(true));

    return () => {
      cancelado = true;
      clearTimeout(timer);
      assinatura?.remove();
    };
  }, [ativo, tentativa]);

  return {
    melhor,
    esgotou,
    falhou,
    /** Recomeça a busca (ex.: depois de ligar o GPS). */
    recomecar: () => {
      setMelhor(null);
      setEsgotou(false);
      setFalhou(false);
      setTentativa((n) => n + 1);
    },
  };
}
