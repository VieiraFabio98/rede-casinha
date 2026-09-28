import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

const aparar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class EntrarComGoogleDto {
  /** ID token devolvido pelo Google Sign-In no app. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  idToken: string;
}

export class PedirCodigoDto {
  @Transform(aparar)
  @IsEmail({}, { message: 'Informe um e-mail válido' })
  @MaxLength(254)
  email: string;
}

export class VerificarCodigoDto extends PedirCodigoDto {
  /** Código de 6 dígitos recebido por e-mail. */
  @Matches(/^\d{6}$/, { message: 'O código tem 6 números' })
  codigo: string;
}

export class EntrarComSenhaDto extends PedirCodigoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  senha: string;
}

export class RefreshDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  refresh: string;
}

export class TokensResposta {
  /** JWT de acesso: enviar em `Authorization: Bearer <acesso>`. */
  acesso: string;
  acessoExpiraEm: Date;
  /** Token para renovar a sessão em `POST /v1/auth/renovar`. Guardar em armazenamento seguro. */
  refresh: string;
  refreshExpiraEm: Date;
  /** `true` enquanto o usuário não concluir o cadastro (apelido, 18 anos, termos). */
  precisaCadastro: boolean;
}
