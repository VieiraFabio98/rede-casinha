import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  ValidateIf,
} from 'class-validator';

import { NIVEIS_ACESSO, type NivelAcesso } from '../../../../shared/domain/usuario-logado.js';
import type {
  SituacaoCasinha,
  StatusModeracao,
} from '../../../casinhas/domain/entities/casinha.js';
import {
  ALVOS_DENUNCIA,
  type AlvoDenuncia,
  type MotivoDenuncia,
} from '../../domain/entities/denuncia.js';

const aparar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Toda ação de moderação diz o porquê (fica em `acoes_moderacao`). */
export class MotivoDto {
  @Transform(aparar)
  @IsString()
  @Length(3, 500)
  motivo: string;
}

export class AlvoDto extends MotivoDto {
  @IsIn(ALVOS_DENUNCIA)
  alvoTipo: AlvoDenuncia;

  @IsUUID('all')
  alvoId: string;
}

export class MesclarDto extends MotivoDto {
  /** A casinha que fica. A origem (da rota) é desativada e aponta para esta. */
  @IsUUID('all')
  destinoId: string;
}

export class NivelDto extends MotivoDto {
  @IsIn(NIVEIS_ACESSO)
  nivel: NivelAcesso;
}

export class BloqueioDto extends MotivoDto {
  /** Até quando. `null` desbloqueia. */
  @ValidateIf((_o, valor) => valor !== null)
  @Type(() => Date)
  @IsDate()
  ate: Date | null;
}

export class ResolverDenunciaDto {
  @IsBoolean()
  procedente: boolean;

  @IsOptional()
  @Transform(aparar)
  @IsString()
  @Length(3, 500)
  motivo?: string;
}

export class FeitoResposta {
  resultado: 'ok';
}

export class DenunciasDoAlvo {
  alvoTipo: AlvoDenuncia;
  alvoId: string;
  /** Resumo para reconhecer o alvo (nome da casinha, tipo da necessidade, apelido). */
  descricaoAlvo: string;
  /** Situação atual do alvo: visível, oculto, cancelado… */
  estadoAlvo: string;
  total: number;
  motivos: MotivoDenuncia[];
  /** "Perigo aos animais" ou "expõe pessoa": responder em até 24 h. */
  prioridade: boolean;
  maisAntigaEm: Date;
  denuncias: {
    id: string;
    motivo: MotivoDenuncia;
    descricao: string | null;
    apelido: string | null;
    criadaEm: Date;
  }[];
}

export class CasinhaNaFila {
  id: string;
  nome: string;
  situacao: SituacaoCasinha;
  moderacao: StatusModeracao;
}

export class PedidoDesativacao {
  atividadeId: string;
  casinha: CasinhaNaFila;
  apelido: string | null;
  motivo: string | null;
  criadoEm: Date;
}

export class PossivelDuplicata {
  a: CasinhaNaFila;
  b: CasinhaNaFila;
  distanciaM: number;
}

export class FilaModeracao {
  /** Agrupadas por alvo; prioritárias primeiro, depois as mais antigas. */
  denuncias: DenunciasDoAlvo[];
  casinhasEmRevisao: CasinhaNaFila[];
  pedidosDesativacao: PedidoDesativacao[];
  possiveisDuplicatas: PossivelDuplicata[];
}
