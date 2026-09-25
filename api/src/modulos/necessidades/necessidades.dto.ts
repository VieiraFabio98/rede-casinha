import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { StatusCasinha, TipoNecessidade, Urgencia } from '../../generated/prisma/client.js';

const aparar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

/**
 * Posição de quem está agindo, opcional. Serve só para calcular se a ação foi feita no local
 * (até 100 m): não é guardada nem devolvida. Mande as duas ou nenhuma.
 */
class ComPosicao {
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  /** Quando a ação foi feita no celular (pode ser bem antes do envio, se estava offline). */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  criadaNoCelularEm?: Date;
}

export class ReportarNecessidadeDto extends ComPosicao {
  /** Gerado no celular. Reenviar o mesmo id não duplica nada (idempotência). */
  @IsUUID('all')
  id: string;

  @IsUUID('all')
  casinhaId: string;

  @IsEnum(TipoNecessidade)
  tipo: TipoNecessidade;

  @IsEnum(Urgencia)
  urgencia: Urgencia;

  @IsOptional()
  @Transform(aparar)
  @IsString()
  @MaxLength(280)
  observacao?: string;
}

export class AcaoDto extends ComPosicao {
  /** Gerado no celular: id da atividade no histórico e chave de idempotência. */
  @IsUUID('all')
  atividadeId: string;
}

export class AtenderDto extends AcaoDto {
  @IsOptional()
  @Transform(aparar)
  @IsString()
  @MaxLength(280)
  observacao?: string;
}

export class ContestarDto {
  @IsUUID('all')
  atividadeId: string;

  /** O que não foi feito (ex.: "o pote continua vazio"). */
  @Transform(aparar)
  @IsString()
  @Length(3, 280)
  observacao: string;
}

export type Resultado = 'ok' | 'reconfirmada' | 'ja_reconfirmada' | 'ja_atendida';

export class ResultadoAcao {
  /**
   * - `ok`: feito.
   * - `reconfirmada`: o tipo já estava aberto; o reporte virou "ainda precisa" (e a urgência subiu, se for o caso).
   * - `ja_reconfirmada`: você já tinha confirmado nas últimas 12 h; nada mudou.
   * - `ja_atendida`: alguém resolveu antes; o seu atendimento ficou só no histórico. Mostre "Alguém já tinha atendido. Obrigado!".
   */
  resultado: Resultado;
  /** Necessidade afetada (no reporte que virou reconfirmação, a que já estava aberta). */
  necessidadeId: string | null;
  /** Status da casinha depois da ação. */
  status: StatusCasinha;
}
