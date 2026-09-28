import { type NivelAcesso, ORDEM_NIVEL } from '../../../shared/domain/usuario-logado.js';

/** O que o usuário pode fazer numa casinha (o app mostra ou esconde os botões). */
export interface MinhasPermissoes {
  editar: boolean;
  adotar: boolean;
  deixarDeAdotar: boolean;
  pedirDesativacao: boolean;
  desativar: boolean;
  denunciar: boolean;
}

/** Máximo de adotantes ativos por casinha (RF04.2). */
export const MAXIMO_ADOTANTES = 3;

/** Botões da casinha conforme a matriz de permissões (docs/02-requisitos.md). */
export function permissoesNaCasinha(quem: {
  nivel: NivelAcesso;
  souCriador: boolean;
  souAdotante: boolean;
  adotantesAtivos: number;
}): MinhasPermissoes {
  const moderador = ORDEM_NIVEL[quem.nivel] >= ORDEM_NIVEL.moderador;
  return {
    editar: moderador || quem.souCriador || quem.souAdotante,
    adotar: !quem.souAdotante && quem.adotantesAtivos < MAXIMO_ADOTANTES,
    deixarDeAdotar: quem.souAdotante,
    pedirDesativacao: !moderador,
    desativar: moderador,
    denunciar: true,
  };
}
