import type { Ponto } from '../../../../shared/domain/geo.js';
import type { CasinhaResumo } from '../../domain/entities/casinha.js';
import { arredondarCoordenada } from '../../domain/visibilidade.js';
import type { CasinhaNoMapa } from '../dto/casinhas.dto.js';

/** A exata se o usuário pode vê-la; senão a pública (o app desenha a área de 500 m). */
export function coordenadas(c: { latPublica: number; lngPublica: number }, exata?: Ponto) {
  return exata
    ? { lat: arredondarCoordenada(exata.lat), lng: arredondarCoordenada(exata.lng), exata: true }
    : {
        lat: arredondarCoordenada(c.latPublica),
        lng: arredondarCoordenada(c.lngPublica),
        exata: false,
      };
}

export function paraMapa(c: CasinhaResumo, exata?: Ponto): CasinhaNoMapa {
  return {
    id: c.id,
    nome: c.nome,
    status: c.status,
    animais: c.animais,
    ...coordenadas(c, exata),
    necessidadesAbertas: c.necessidadesAbertas,
  };
}
