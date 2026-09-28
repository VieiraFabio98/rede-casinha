import { IsNumber, IsOptional, Max, Min } from 'class-validator';

/**
 * Posição de quem quer adotar, no momento do pedido. Obrigatória para quem não criou a casinha:
 * é preciso estar a até 100 m dela. Usada e descartada (nunca guardada nem devolvida).
 */
export class AdotarDto {
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
}

export class ResultadoAdocao {
  /**
   * `nao_permitido` não diz o motivo (longe, sem posição, já tem 3 adotantes): a resposta
   * não pode servir para descobrir, por tentativa, onde fica a casinha.
   */
  resultado: 'ok' | 'nao_permitido';
}
