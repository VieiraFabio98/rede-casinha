import type { INestApplication } from '@nestjs/common';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { ModulesContainer } from '@nestjs/core';

import { CHAVE_NIVEL, CHAVE_PUBLICO } from '../src/shared/infra/auth/decoradores.js';

export interface Rota {
  /** Ex.: `POST /casinhas/:id/adocao` (sem o prefixo /v1). */
  rota: string;
  publica: boolean;
  /** Nível exigido por `@Nivel()`; `null` = só o token. */
  nivel: string | null;
}

const juntar = (...partes: (string | undefined)[]) =>
  '/' +
  partes
    .flatMap((p) => (p ?? '').split('/'))
    .filter(Boolean)
    .join('/');

/** Todas as rotas da aplicação, lidas dos metadados dos controllers (como o guard global lê). */
export function listarRotas(app: INestApplication): Rota[] {
  const rotas: Rota[] = [];
  for (const modulo of app.get(ModulesContainer).values()) {
    for (const { metatype } of modulo.controllers.values()) {
      if (!metatype) continue;
      const base = Reflect.getMetadata(PATH_METADATA, metatype) as string | undefined;
      const prototipo = metatype.prototype as Record<string, unknown>;
      for (const nome of Object.getOwnPropertyNames(prototipo)) {
        const handler = prototipo[nome];
        if (typeof handler !== 'function') continue;
        const caminho = Reflect.getMetadata(PATH_METADATA, handler) as string | undefined;
        const metodo = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
        if (caminho === undefined || metodo === undefined) continue;
        const meta = <T>(chave: string) =>
          (Reflect.getMetadata(chave, handler) ?? Reflect.getMetadata(chave, metatype)) as T;
        rotas.push({
          rota: `${RequestMethod[metodo]} ${juntar(base, caminho)}`,
          publica: meta<boolean | undefined>(CHAVE_PUBLICO) === true,
          nivel: meta<string | undefined>(CHAVE_NIVEL) ?? null,
        });
      }
    }
  }
  return rotas.sort((a, b) => a.rota.localeCompare(b.rota));
}
