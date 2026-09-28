/**
 * Erros de aplicação, lançados pelos use-cases e traduzidos em HTTP pelo `AppErrorFilter`.
 * `codigo` é estável e o app decide por ele (ex.: `limite_diario` não é repetido pela fila);
 * `message` é o texto em pt-BR que o app pode mostrar.
 */
abstract class ErroHttp extends Error {
  readonly error: { name: string; message: string; codigo?: string };

  constructor(name: string, message: string, codigo?: string) {
    super(message);
    this.name = name;
    this.error = { name, message, ...(codigo && { codigo }) };
  }
}

export class ServerError extends ErroHttp {
  /** A causa fica no log do servidor; nunca vai na resposta (sem stack para o cliente). */
  readonly causa?: Error;

  constructor(causa?: Error) {
    super('ServerError', 'Erro interno do servidor');
    this.causa = causa;
  }
}

export class UnauthorizedError extends ErroHttp {
  constructor(message = 'Entre na sua conta para continuar', codigo?: string) {
    super('UnauthorizedError', message, codigo);
  }
}

export class ForbiddenError extends ErroHttp {
  constructor(message = 'Você não tem permissão para esta ação', codigo?: string) {
    super('ForbiddenError', message, codigo);
  }
}

export class NotFoundError extends ErroHttp {
  constructor(message = 'Não encontrado', codigo?: string) {
    super('NotFoundError', message, codigo);
  }
}

export class SendMailError extends ErroHttp {
  constructor() {
    super('SendMailError', 'Não foi possível enviar o e-mail');
  }
}

export class ConflictError extends ErroHttp {
  constructor(message = 'Conflito', codigo?: string) {
    super('ConflictError', message, codigo);
  }
}

export class BadRequest extends ErroHttp {
  constructor(message = 'Requisição inválida', codigo?: string) {
    super('BadRequest', message, codigo);
  }
}

export class UnprocessableEntityError extends ErroHttp {
  constructor(message = 'Não foi possível processar', codigo?: string) {
    super('UnprocessableEntityError', message, codigo);
  }
}

export class TooManyRequestsError extends ErroHttp {
  constructor(message = 'Muitas tentativas. Tente de novo mais tarde.', codigo?: string) {
    super('TooManyRequestsError', message, codigo);
  }
}
