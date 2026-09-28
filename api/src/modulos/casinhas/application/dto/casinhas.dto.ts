import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { FotoUrls } from '../../../fotos/application/dto/fotos.dto.js';
import type { TipoAtividade } from '../../../necessidades/domain/entities/atividade.js';
import type {
  TipoNecessidade,
  Urgencia,
} from '../../../necessidades/domain/entities/necessidade.js';
import type { StatusCasinha } from '../../../status/domain/entities/status-casinha.js';
import { ANIMAIS_ATENDIDOS, type AnimaisAtendidos } from '../../domain/entities/casinha.js';

const aparar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

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
  /** Foto anexada à atividade (ex.: do atendimento). */
  foto: FotoUrls | null;
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
  /** Fotos de perfil (até 5), da mais antiga para a mais nova. */
  fotos: FotoUrls[];
  minhasPermissoes: MinhasPermissoes;
}

/**
 * Cadastro de casinha (RF02). A posição é a EXATA: vai só para o módulo `localizacao`, e a
 * resposta nunca a devolve.
 */
export class CadastrarCasinhaDto {
  /** Gerado no celular. Reenviar o mesmo id não duplica nada (idempotência). */
  @IsUUID('all')
  id: string;

  /** Ex.: "Casinha da Praça do Rosário". */
  @Transform(aparar)
  @IsString()
  @Length(3, 60)
  nome: string;

  @IsIn(ANIMAIS_ATENDIDOS)
  animais: AnimaisAtendidos;

  @IsOptional()
  @Transform(aparar)
  @IsString()
  @MaxLength(500)
  descricao?: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  /** Precisão do GPS, em metros. Acima de 30 m, só com `ajusteManual`. */
  @IsNumber()
  @Min(0)
  @Max(10_000)
  precisaoM: number;

  /** O pino foi ajustado no mapa e confirmado (a até 50 m da leitura do GPS, conferido no app). */
  @IsOptional()
  @IsBoolean()
  ajusteManual?: boolean;

  /**
   * "É nova": cria mesmo com casinha a até 30 m. Ela entra em revisão (RN04). Sem isso, a
   * resposta é `possivel_duplicata` com as candidatas.
   */
  @IsOptional()
  @IsBoolean()
  forcar?: boolean;

  /** Quando o cadastro foi feito no celular (pode ser bem antes do envio, se estava offline). */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  criadaNoCelularEm?: Date;
}

/** Casinha a até 30 m do cadastro. Sem coordenadas nem distância. */
export class CandidataDuplicata {
  id: string;
  nome: string;
  miniatura: FotoUrls | null;
}

export class ResultadoCadastro {
  /** `possivel_duplicata`: nada foi criado; mostre as candidatas e reenvie com `forcar` se for nova. */
  resultado: 'ok' | 'possivel_duplicata';
  id: string;
  /** Criada com casinha a até 30 m (`forcar`): aparece no mapa, mas a moderação vai conferir. */
  emRevisao: boolean;
  candidatas: CandidataDuplicata[];
}
