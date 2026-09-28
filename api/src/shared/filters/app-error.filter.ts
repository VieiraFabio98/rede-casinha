import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

import {
  AppError,
  BadRequest,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  SendMailError,
  TooManyRequestsError,
  UnauthorizedError,
  UnprocessableEntityError,
} from '../errors/index.js';

type ClasseDeErro = abstract new (...args: never[]) => Error & {
  error: { name: string; message: string; codigo?: string };
};

const STATUS_POR_ERRO = new Map<ClasseDeErro, number>([
  [BadRequest, 400],
  [UnauthorizedError, 401],
  [ForbiddenError, 403],
  [NotFoundError, 404],
  [ConflictError, 409],
  [UnprocessableEntityError, 422],
  [TooManyRequestsError, 429],
  [SendMailError, 502],
]);

/**
 * Traduz erros em respostas HTTP `{ name, message, codigo? }`. Exceções do Nest (validação,
 * throttling, guard) passam como estão. O resto vira 500 genérico, com a causa só no log.
 */
@Catch()
export class AppErrorFilter implements ExceptionFilter {
  private readonly log = new Logger('Erro');

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      return response.status(exception.getStatus()).json(exception.getResponse());
    }

    if (exception instanceof AppError) {
      return response.status(exception.statusCode).json({
        name: 'AppError',
        message: exception.message,
        ...(exception.codigo && { codigo: exception.codigo }),
      });
    }

    for (const [classe, status] of STATUS_POR_ERRO) {
      if (exception instanceof classe) {
        return response.status(status).json(exception.error);
      }
    }

    this.log.error(exception instanceof Error ? exception.stack : String(exception));
    return response.status(500).json({ name: 'ServerError', message: 'Erro interno do servidor' });
  }
}
