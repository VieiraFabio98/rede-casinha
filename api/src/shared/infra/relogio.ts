import { Global, Injectable, Module } from '@nestjs/common';

import { RELOGIO, type Relogio as RelogioDoDominio } from '../domain/relogio.js';

/**
 * Hora atual, injetável: os testes trocam o relógio para simular o tempo passando
 * (prazos de expiração, 24 h de contestação, 12 h entre reconfirmações).
 * Use-cases pedem o token `RELOGIO`; os testes sobrescrevem esta classe.
 */
@Injectable()
export class Relogio implements RelogioDoDominio {
  agora(): Date {
    return new Date();
  }
}

@Global()
@Module({
  providers: [Relogio, { provide: RELOGIO, useExisting: Relogio }],
  exports: [Relogio, RELOGIO],
})
export class RelogioModule {}
