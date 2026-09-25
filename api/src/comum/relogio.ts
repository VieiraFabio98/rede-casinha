import { Global, Injectable, Module } from '@nestjs/common';

/**
 * Hora atual, injetável: os testes trocam o relógio para simular o tempo passando
 * (prazos de expiração, 24 h de contestação, 12 h entre reconfirmações).
 */
@Injectable()
export class Relogio {
  agora(): Date {
    return new Date();
  }
}

@Global()
@Module({ providers: [Relogio], exports: [Relogio] })
export class RelogioModule {}
