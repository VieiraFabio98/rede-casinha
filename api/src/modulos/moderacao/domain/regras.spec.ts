import { ordemDaFila, recusaModerarUsuario } from './regras.js';

describe('regras de moderação', () => {
  const mod = { id: 'm', nivel: 'moderador' as const };
  const admin = { id: 'a', nivel: 'admin' as const };

  it('ninguém modera a própria conta', () => {
    expect(recusaModerarUsuario(mod, { id: 'm', nivel: 'moderador' })).toBe('propria_conta');
  });

  it('moderador promove a verificado, mas só admin mexe com moderador e admin', () => {
    const colab = { id: 'c', nivel: 'colaborador' as const };
    expect(recusaModerarUsuario(mod, colab, 'verificado')).toBeNull();
    expect(recusaModerarUsuario(mod, colab, 'moderador')).toBe('so_admin');
    expect(recusaModerarUsuario(mod, { id: 'x', nivel: 'moderador' })).toBe('so_admin');
    expect(recusaModerarUsuario(admin, colab, 'moderador')).toBeNull();
  });

  it('fila: prioritárias primeiro, depois as mais antigas', () => {
    const antiga = { prioridade: false, maisAntigaEm: new Date(1) };
    const nova = { prioridade: false, maisAntigaEm: new Date(2) };
    const urgente = { prioridade: true, maisAntigaEm: new Date(3) };
    expect([nova, urgente, antiga].sort(ordemDaFila)).toEqual([urgente, antiga, nova]);
  });
});
