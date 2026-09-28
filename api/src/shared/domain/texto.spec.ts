import { normalizarApelido } from './texto.js';

describe('normalizarApelido', () => {
  it.each([
    ['Marta', 'marta'],
    ['  Márta ', 'marta'],
    ['JOÃO_Protetor', 'joao_protetor'],
    ['Conceição', 'conceicao'],
  ])('%s → %s', (entrada, esperado) => {
    expect(normalizarApelido(entrada)).toBe(esperado);
  });
});
