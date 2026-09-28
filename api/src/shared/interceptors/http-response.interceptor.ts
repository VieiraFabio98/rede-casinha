import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { map, type Observable } from 'rxjs';

import type { HttpResponse } from '../helpers/http.js';

function ehHttpResponse(valor: unknown): valor is HttpResponse {
  return (
    typeof valor === 'object' &&
    valor !== null &&
    'statusCode' in valor &&
    'data' in valor &&
    typeof (valor as HttpResponse).statusCode === 'number'
  );
}

/** Controllers devolvem `ok(...)`, `noContent()` etc.: aplica o status e responde só com `data`. */
@Injectable()
export class HttpResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((valor) => {
        if (!ehHttpResponse(valor)) return valor;
        context.switchToHttp().getResponse<Response>().status(valor.statusCode);
        // 204 não tem corpo.
        return valor.statusCode === 204 ? undefined : valor.data;
      }),
    );
  }
}
