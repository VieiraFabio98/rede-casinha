import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';

import {
  ALVOS_DENUNCIA,
  type AlvoDenuncia,
  MOTIVOS_DENUNCIA,
  type MotivoDenuncia,
} from '../../../moderacao/domain/entities/denuncia.js';

const aparar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

export class DenunciarDto {
  @IsIn(ALVOS_DENUNCIA)
  alvoTipo: AlvoDenuncia;

  @IsUUID('all')
  alvoId: string;

  @IsIn(MOTIVOS_DENUNCIA)
  motivo: MotivoDenuncia;

  @IsOptional()
  @Transform(aparar)
  @IsString()
  @MaxLength(500)
  descricao?: string;
}

export class PedirDesativacaoDto {
  /** Gerado no celular: id da atividade e chave de idempotência (vem pela fila offline). */
  @IsUUID('all')
  atividadeId: string;

  /** Ex.: "a casinha foi retirada da praça". */
  @Transform(aparar)
  @IsString()
  @Length(3, 280)
  motivo: string;
}

export class RecebidoResposta {
  /** Sempre `ok`: a denúncia não revela quantas o alvo já tem nem se ele foi ocultado. */
  resultado: 'ok';
}
