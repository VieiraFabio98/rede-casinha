import { permissoesNaCasinha } from './permissoes.js';

const base = { nivel: 'colaborador' as const, souCriador: false, souAdotante: false };

describe('permissoesNaCasinha', () => {
  it('colaborador sem vínculo: adota, denuncia e pede desativação, mas não edita', () => {
    expect(permissoesNaCasinha({ ...base, adotantesAtivos: 0 })).toEqual({
      editar: false,
      adotar: true,
      deixarDeAdotar: false,
      pedirDesativacao: true,
      desativar: false,
      denunciar: true,
    });
  });

  it('adotante edita e deixa de adotar, mas não adota de novo', () => {
    const p = permissoesNaCasinha({ ...base, souAdotante: true, adotantesAtivos: 1 });
    expect(p).toMatchObject({ editar: true, adotar: false, deixarDeAdotar: true });
  });

  it('criador que não adota edita e pode adotar', () => {
    const p = permissoesNaCasinha({ ...base, souCriador: true, adotantesAtivos: 0 });
    expect(p).toMatchObject({ editar: true, adotar: true });
  });

  it('com 3 adotantes ninguém mais adota', () => {
    expect(permissoesNaCasinha({ ...base, adotantesAtivos: 3 }).adotar).toBe(false);
  });

  it('moderador edita e desativa direto (não precisa pedir)', () => {
    const p = permissoesNaCasinha({ ...base, nivel: 'moderador', adotantesAtivos: 0 });
    expect(p).toMatchObject({ editar: true, desativar: true, pedirDesativacao: false });
  });

  it('verificado não edita casinha alheia', () => {
    expect(permissoesNaCasinha({ ...base, nivel: 'verificado', adotantesAtivos: 0 }).editar).toBe(
      false,
    );
  });
});
