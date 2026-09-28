import {
  BadRequest,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  SendMailError,
  ServerError,
  UnauthorizedError,
  UnprocessableEntityError,
} from '../errors/http.js';

/**
 * Resposta de controller: o `HttpResponseInterceptor` aplica o `statusCode` e devolve só `data`.
 * No Swagger, declare o tipo de `data` com `@ApiOkResponse` / `@ApiNoContentResponse`.
 */
export type HttpResponse<T = unknown> = {
  statusCode: number;
  data: T;
};

export const ok = <T>(data: T): HttpResponse<T> => ({ statusCode: 200, data });

export const created = <T>(data: T): HttpResponse<T> => ({ statusCode: 201, data });

/** Aceito para processar; sem corpo. */
export const accepted = (): HttpResponse<undefined> => ({ statusCode: 202, data: undefined });

export const noContent = (): HttpResponse<null> => ({ statusCode: 204, data: null });

export const found = <T>(data: T): HttpResponse<T> => ({ statusCode: 200, data });

export const badRequest = (message?: string, codigo?: string) => ({
  statusCode: 400,
  data: new BadRequest(message, codigo).error,
});

export const unauthorized = (message?: string, codigo?: string) => ({
  statusCode: 401,
  data: new UnauthorizedError(message, codigo).error,
});

export const forbidden = (message?: string, codigo?: string) => ({
  statusCode: 403,
  data: new ForbiddenError(message, codigo).error,
});

export const notFound = (message?: string, codigo?: string) => ({
  statusCode: 404,
  data: new NotFoundError(message, codigo).error,
});

export const conflictError = (message?: string, codigo?: string) => ({
  statusCode: 409,
  data: new ConflictError(message, codigo).error,
});

/** Nunca devolve a causa nem o stack ao cliente. */
export const serverError = (causa?: Error) => ({
  statusCode: 500,
  data: new ServerError(causa).error,
});

export const sendMailFailure = () => ({
  statusCode: 502,
  data: new SendMailError().error,
});

export const unprocessableEntity = (message?: string, codigo?: string) => ({
  statusCode: 422,
  data: new UnprocessableEntityError(message, codigo).error,
});
