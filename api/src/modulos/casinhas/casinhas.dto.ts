import { Type } from 'class-transformer';
import { IsNumber, Max, Min } from 'class-validator';

import {
  AnimaisAtendidos,
  StatusCasinha,
  TipoAtividade,
  TipoNecessidade,
  Urgencia,
} from '../../generated/prisma/client.js';

/** Área visível do mapa. A busca usa a coordenada PÚBLICA das casinhas. */
export class AreaDto {
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  minLat: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  minLng: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  maxLat: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  maxLng: number;
}

export class CasinhaNoMapa {
  id: string;
  nome: string;
  status: StatusCasinha;
  animais: AnimaisAtendidos;
  /** Exata se `exata = true`; senão, a pública (desenhar como área de 500 m, nunca como pino). */
  lat: number;
  lng: number;
  exata: boolean;
  /** Tipos das necessidades abertas (filtros e ícones do mapa). */
  necessidadesAbertas: TipoNecessidade[];
}

export class CasinhasNaAreaResposta {
  casinhas: CasinhaNoMapa[];
  /** `true` se a área tinha mais de 1.000 casinhas e só as 1.000 primeiras vieram: aproxime o mapa. */
  truncado: boolean;
}

export class MinhaCasinha extends CasinhaNoMapa {
  souCriador: boolean;
  souAdotante: boolean;
}

export class NecessidadeAberta {
  id: string;
  tipo: TipoNecessidade;
  urgencia: Urgencia;
  observacao: string | null;
  criadaEm: Date;
  expiraEm: Date;
}

/** Necessidade resolvida há menos de 24 h: ainda pode ser contestada (RN03). */
export class AtendidaRecentemente {
  id: string;
  tipo: TipoNecessidade;
  atendidaEm: Date;
  /** Quem atendeu (`null` = conta excluída). */
  apelido: string | null;
}

export class AtividadeResumo {
  id: string;
  tipo: TipoAtividade;
  /** Tipo da necessidade envolvida (reporte, atendimento etc.), para o texto "abasteceu ração". */
  necessidade: TipoNecessidade | null;
  /** `null` quando a conta foi excluída (mostrar "Usuário removido"). */
  apelido: string | null;
  observacao: string | null;
  criadaEm: Date;
}

/** O que o usuário logado pode fazer nesta casinha (o app mostra ou esconde os botões). */
export class MinhasPermissoes {
  editar: boolean;
  /** Ainda sujeito, na hora de adotar, à distância de até 100 m (exceto para o criador). */
  adotar: boolean;
  deixarDeAdotar: boolean;
  pedirDesativacao: boolean;
  desativar: boolean;
  denunciar: boolean;
}

export class CasinhaDetalhe {
  id: string;
  nome: string;
  descricao: string | null;
  animais: AnimaisAtendidos;
  status: StatusCasinha;
  /** Exata se `exata = true`; senão, a pública. "Como chegar" só com `exata = true`. */
  lat: number;
  lng: number;
  exata: boolean;
  ultimaAtividadeEm: Date;
  criadaEm: Date;
  necessidadesAbertas: NecessidadeAberta[];
  /** Resolvidas nas últimas 24 h, para o botão "Não foi resolvido". */
  atendidasRecentemente: AtendidaRecentemente[];
  /** Apelidos dos adotantes ativos. */
  adotantes: string[];
  /** As 30 mais recentes, da mais nova para a mais antiga. */
  atividades: AtividadeResumo[];
  minhasPermissoes: MinhasPermissoes;
}
