import { Transform } from 'class-transformer';
import { Equals, IsString, Matches } from 'class-validator';

import type { NivelAcesso } from '../../../../shared/domain/usuario-logado.js';

export class ConcluirCadastroDto {
  /**
   * Nome público, de 3 a 30 caracteres: letras, números, espaço, `_`, `.` e `-`.
   * Não pode parecer e-mail nem telefone (8 ou mais dígitos seguidos).
   */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(/^(?!.*\d{8})[\p{L}\p{N} _.-]{3,30}$/u, {
    message: 'Use de 3 a 30 letras, números, espaço, _ . ou - (sem e-mail ou telefone)',
  })
  apelido: string;

  /** Declaração de que o usuário tem 18 anos ou mais. */
  @Equals(true, { message: 'É preciso ter 18 anos ou mais para usar a Rede Casinha' })
  maiorDeIdade: boolean;

  /** Versão dos termos que o usuário aceitou (tem que ser a vigente). */
  @IsString()
  termosVersao: string;
}

export class PerfilResposta {
  apelido: string;
  nivel: NivelAcesso;
  bloqueadoAte: Date | null;
}

export class MeResposta {
  id: string;
  email: string;
  /** `null` enquanto o cadastro não for concluído. */
  perfil: PerfilResposta | null;
}

export class ContagensResposta {
  /** Reportes, reconfirmações, atendimentos e check-ins. */
  contribuicoes: number;
  atendimentos: number;
  /** Casinhas que adota hoje. */
  casinhasAdotadas: number;
}
