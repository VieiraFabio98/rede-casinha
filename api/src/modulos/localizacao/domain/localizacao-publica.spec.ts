import { distanciaM } from '../../../shared/domain/geo.js';
import {
  DESLOCAMENTO_MAX_M,
  DESLOCAMENTO_MIN_M,
  gerarLocalizacaoPublica,
} from './localizacao-publica.js';

const PRACA_DA_SE = { lat: -23.5505, lng: -46.6333 };

describe('gerarLocalizacaoPublica', () => {
  it('10 mil sorteios ficam todos entre 150 e 400 m da exata', () => {
    for (let i = 0; i < 10_000; i++) {
      const distancia = distanciaM(PRACA_DA_SE, gerarLocalizacaoPublica(PRACA_DA_SE));
      expect(distancia).toBeGreaterThanOrEqual(DESLOCAMENTO_MIN_M - 1e-6);
      expect(distancia).toBeLessThanOrEqual(DESLOCAMENTO_MAX_M + 1e-6);
    }
  });

  it('espalha em todas as direções (nenhum quadrante vazio)', () => {
    const quadrantes = new Set<string>();
    for (let i = 0; i < 1_000; i++) {
      const { lat, lng } = gerarLocalizacaoPublica(PRACA_DA_SE);
      quadrantes.add(`${lat > PRACA_DA_SE.lat}${lng > PRACA_DA_SE.lng}`);
    }
    expect(quadrantes.size).toBe(4);
  });

  it('os extremos do sorteio dão exatamente 150 e ~400 m', () => {
    const minimo = gerarLocalizacaoPublica(PRACA_DA_SE, () => 0);
    const maximo = gerarLocalizacaoPublica(PRACA_DA_SE, () => 0.999_999);
    expect(distanciaM(PRACA_DA_SE, minimo)).toBeCloseTo(DESLOCAMENTO_MIN_M, 6);
    expect(distanciaM(PRACA_DA_SE, maximo)).toBeCloseTo(DESLOCAMENTO_MAX_M, 2);
  });
});
