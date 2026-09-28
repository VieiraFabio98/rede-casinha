import { createHmac, timingSafeEqual } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Ambiente } from '../../../config/ambiente.js';

/**
 * HMAC-SHA256 (base64url, 43 caracteres) das URLs de arquivos privados: quem tem a URL vê o
 * arquivo até a expiração que ela carrega. O texto assinado é definido por quem usa (ex.:
 * `<foto>:<variante>:<exp>` em `modulos/fotos/domain/regras.ts`).
 */
@Injectable()
export class AssinaturaDeUrls {
  private readonly segredo: string;

  constructor(config: ConfigService<Ambiente, true>) {
    // Prefixo próprio: a mesma chave assina códigos de login, e um HMAC não pode servir pelo outro.
    this.segredo = `url:${config.get('HMAC_SEGREDO', { infer: true })}`;
  }

  assinar(texto: string): string {
    return createHmac('sha256', this.segredo).update(texto).digest('base64url');
  }

  /** Comparação em tempo constante. */
  confere(texto: string, assinatura: string): boolean {
    const esperada = Buffer.from(this.assinar(texto));
    const recebida = Buffer.from(assinatura);
    return esperada.length === recebida.length && timingSafeEqual(esperada, recebida);
  }
}
