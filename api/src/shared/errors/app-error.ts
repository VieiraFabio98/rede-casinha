/** Erro genérico de regra, com o status HTTP escolhido por quem lança. */
export class AppError {
  constructor(
    public readonly message: string,
    public readonly statusCode = 400,
    public readonly codigo?: string,
  ) {}
}
