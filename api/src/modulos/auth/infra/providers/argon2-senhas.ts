import { Injectable, type OnModuleInit } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

import type { Senhas } from '../../domain/providers/senhas.provider.js';

@Injectable()
export class Argon2Senhas implements Senhas, OnModuleInit {
  /** Hash de uma senha qualquer: verificado quando não há hash, para igualar o tempo de resposta. */
  private hashFicticio: string;

  async onModuleInit() {
    this.hashFicticio = await hash('senha-ficticia-para-igualar-o-tempo');
  }

  async confere(hashDaSenha: string | null, senha: string) {
    const confere = await verify(hashDaSenha ?? this.hashFicticio, senha);
    return hashDaSenha !== null && confere;
  }
}
