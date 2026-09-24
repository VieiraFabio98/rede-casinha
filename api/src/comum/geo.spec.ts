import { caixaAoRedor, destino, distanciaM, RAIO_TERRA_M } from './geo.js';

const PRACA_DA_SE = { lat: -23.5505, lng: -46.6333 };

describe('geo', () => {
  it('1 grau de latitude mede ~111,2 km', () => {
    const esperado = (Math.PI / 180) * RAIO_TERRA_M;
    expect(distanciaM({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(esperado, 3);
  });

  it('distância de um ponto a ele mesmo é zero', () => {
    expect(distanciaM(PRACA_DA_SE, PRACA_DA_SE)).toBe(0);
  });

  it.each([30, 100, 150, 400, 5_000])('destino a %i m volta a %i m pela haversine', (metros) => {
    for (let azimute = 0; azimute < 360; azimute += 15) {
      const ponto = destino(PRACA_DA_SE, metros, azimute);
      expect(distanciaM(PRACA_DA_SE, ponto)).toBeCloseTo(metros, 6);
    }
  });

  it('destino ao norte aumenta a latitude e mantém a longitude', () => {
    const ponto = destino(PRACA_DA_SE, 1_000, 0);
    expect(ponto.lat).toBeGreaterThan(PRACA_DA_SE.lat);
    expect(ponto.lng).toBeCloseTo(PRACA_DA_SE.lng, 9);
  });

  it('normaliza a longitude ao cruzar o antimeridiano', () => {
    const ponto = destino({ lat: 0, lng: 179.9999 }, 1_000, 90);
    expect(ponto.lng).toBeLessThan(-179);
  });

  it('caixaAoRedor contém todos os pontos do círculo', () => {
    const raio = 30;
    const caixa = caixaAoRedor(PRACA_DA_SE, raio);
    for (let azimute = 0; azimute < 360; azimute += 5) {
      const { lat, lng } = destino(PRACA_DA_SE, raio, azimute);
      expect(lat).toBeGreaterThanOrEqual(caixa.minLat);
      expect(lat).toBeLessThanOrEqual(caixa.maxLat);
      expect(lng).toBeGreaterThanOrEqual(caixa.minLng);
      expect(lng).toBeLessThanOrEqual(caixa.maxLng);
    }
  });
});
