/// <reference types="jest" />
import { ajusteDentroDoLimite, nomeValido, precisaoBoa } from './cadastro';
import { distanciaM } from './geo';

const PRACA = { lat: -23.5505, lng: -46.6333 };
/** ~1 m de latitude. */
const METRO = 1 / 111_195;

describe('regras do cadastro no app', () => {
  it('distância em metros (haversine)', () => {
    expect(distanciaM(PRACA, { lat: PRACA.lat + 100 * METRO, lng: PRACA.lng })).toBeCloseTo(100, 0);
  });

  it('precisão do GPS até 30 m', () => {
    expect(precisaoBoa(30)).toBe(true);
    expect(precisaoBoa(30.5)).toBe(false);
  });

  it('pino ajustado até 50 m da leitura do GPS', () => {
    expect(ajusteDentroDoLimite(PRACA, { lat: PRACA.lat + 49 * METRO, lng: PRACA.lng })).toBe(true);
    expect(ajusteDentroDoLimite(PRACA, { lat: PRACA.lat + 51 * METRO, lng: PRACA.lng })).toBe(
      false,
    );
  });

  it('nome de 3 a 60 caracteres', () => {
    expect(nomeValido('  ab ')).toBe(false);
    expect(nomeValido('Casinha da praça')).toBe(true);
    expect(nomeValido('x'.repeat(61))).toBe(false);
  });
});
