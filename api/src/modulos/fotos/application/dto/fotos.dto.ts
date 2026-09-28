import { type ApiBodyOptions, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Matches, Min } from 'class-validator';

/**
 * Campos de texto do `PUT /fotos/:id` (multipart). Os arquivos vão em `foto` (1024 px, até 1 MB)
 * e `miniatura` (320 px, até 200 KB), os dois `image/jpeg`.
 */
export class EnviarFotoDto {
  @IsUUID()
  casinhaId: string;

  /**
   * Atividade do próprio usuário (ex.: atendimento) a que a foto é anexada.
   * Sem ela, é foto de perfil da casinha.
   */
  @IsOptional()
  @IsUUID()
  atividadeId?: string;
}

/** Descrição do corpo multipart, só para o OpenAPI. */
export const CORPO_ENVIAR_FOTO: ApiBodyOptions = {
  schema: {
    type: 'object',
    required: ['casinhaId', 'foto', 'miniatura'],
    properties: {
      casinhaId: { type: 'string', format: 'uuid' },
      atividadeId: { type: 'string', format: 'uuid' },
      foto: { type: 'string', format: 'binary' },
      miniatura: { type: 'string', format: 'binary' },
    },
  },
};

export class FotoUrls {
  id: string;
  /**
   * Relativa à base da API (junte com `EXPO_PUBLIC_API_URL`). Assinada: vale por pelo menos
   * 1 h e não precisa de token. Expirou? Busque o detalhe de novo.
   */
  url: string;
  urlMiniatura: string;
}

export class AbrirFotoQuery {
  /** Expiração da URL, em segundos (epoch). */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  exp: number;

  @ApiProperty({ pattern: '^[A-Za-z0-9_-]{43}$' })
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  assinatura: string;
}
