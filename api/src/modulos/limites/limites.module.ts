import { Module } from '@nestjs/common';

import { LimitesService } from './limites.service.js';

@Module({
  providers: [LimitesService],
  exports: [LimitesService],
})
export class LimitesModule {}
