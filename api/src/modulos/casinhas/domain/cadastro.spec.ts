import { limiteDeCadastros, posicaoAceita } from './cadastro.js';

describe('regras do cadastro de casinha', () => {
  it('limite diário por nível (RN06)', () => {
    expect(limiteDeCadastros('colaborador')).toBe(5);
    expect(limiteDeCadastros('verificado')).toBe(20);
    expect(limiteDeCadastros('moderador')).toBe(20);
  });

  it('GPS com até 30 m de erro, ou pino ajustado à mão (RF02.1)', () => {
    expect(posicaoAceita(30, false)).toBe(true);
    expect(posicaoAceita(31, false)).toBe(false);
    expect(posicaoAceita(80, true)).toBe(true);
  });
});
