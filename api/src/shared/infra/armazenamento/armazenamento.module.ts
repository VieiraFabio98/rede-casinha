import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Ambiente } from '../../../config/ambiente.js';
import { ArmazenamentoS3 } from './armazenamento-s3.js';
import { AssinaturaDeUrls } from './assinatura-de-urls.js';
import {
  Armazenamento,
  ArmazenamentoDisco,
  ArmazenamentoMemoria,
} from './armazenamento.service.js';

/** Arquivos privados (fotos) e as URLs assinadas que dão acesso a eles. */
@Global()
@Module({
  providers: [
    AssinaturaDeUrls,
    {
      provide: Armazenamento,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Ambiente, true>): Armazenamento => {
        switch (config.get('ARMAZENAMENTO_DRIVER', { infer: true })) {
          case 's3':
            return new ArmazenamentoS3(
              config.get('S3_BUCKET', { infer: true })!,
              config.get('AWS_REGION', { infer: true })!,
              config.get('S3_ENDPOINT', { infer: true }),
            );
          case 'memoria':
            return new ArmazenamentoMemoria();
          default:
            return new ArmazenamentoDisco(config.get('ARMAZENAMENTO_PASTA', { infer: true }));
        }
      },
    },
  ],
  exports: [Armazenamento, AssinaturaDeUrls],
})
export class ArmazenamentoModule {}
