import { acessoAExata } from './acesso-exata.js';

describe('acessoAExata (matriz de permissões)', () => {
  const estranho = { souCriador: false, souAdotante: false };

  it.each([
    ['colaborador', 'negado'],
    ['verificado', 'cota_diaria'],
    ['moderador', 'livre'],
    ['admin', 'livre'],
  ] as const)('%s sem vínculo com a casinha: %s', (nivel, esperado) => {
    expect(acessoAExata({ nivel, ...estranho })).toBe(esperado);
  });

  it('criador ou adotante vê a exata da própria casinha sem gastar cota', () => {
    expect(acessoAExata({ nivel: 'colaborador', souCriador: true, souAdotante: false })).toBe(
      'livre',
    );
    expect(acessoAExata({ nivel: 'verificado', souCriador: false, souAdotante: true })).toBe(
      'livre',
    );
  });
});
