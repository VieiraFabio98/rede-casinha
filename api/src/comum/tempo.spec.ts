import { diaAtual } from './tempo.js';

describe('diaAtual', () => {
  it('usa a data de São Paulo, não a do UTC', () => {
    // 25/09 às 23h30 em Brasília = 26/09 às 02h30 UTC.
    expect(diaAtual(new Date('2026-09-26T02:30:00Z'))).toEqual(new Date('2026-09-25T00:00:00Z'));
  });

  it('vira o dia à meia-noite de Brasília', () => {
    expect(diaAtual(new Date('2026-09-26T03:00:00Z'))).toEqual(new Date('2026-09-26T00:00:00Z'));
  });
});
