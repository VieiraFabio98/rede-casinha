import { acessoACasinha } from './visibilidade.js';

const visivel = { situacao: 'ativa' as const, moderacao: 'visivel' as const, criadaPorId: 'ana' };
const joao = { id: 'joao', nivel: 'colaborador' as const };

describe('acessoACasinha', () => {
  it('casinha visível: qualquer um', () => {
    expect(acessoACasinha(visivel, joao, false)).toBe('permitido');
  });

  it('desativada: só moderador', () => {
    const inativa = { ...visivel, situacao: 'inativa' as const };
    expect(acessoACasinha(inativa, joao, true)).toBe('inativa');
    expect(acessoACasinha(inativa, { id: 'm', nivel: 'moderador' }, false)).toBe('permitido');
  });

  it('ocultada: criador e adotantes veem; os outros não', () => {
    const oculta = { ...visivel, moderacao: 'oculto_auto' as const };
    expect(acessoACasinha(oculta, joao, false)).toBe('oculta');
    expect(acessoACasinha(oculta, joao, true)).toBe('permitido');
    expect(acessoACasinha(oculta, { id: 'ana', nivel: 'colaborador' }, false)).toBe('permitido');
  });
});
