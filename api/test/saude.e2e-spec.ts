import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { configurarApp } from '../src/configurar-app.js';

describe('GET /saude (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modulo.createNestApplication();
    configurarApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('responde 200 com o banco de testes no ar', () => {
    return request(app.getHttpServer()).get('/saude').expect(200).expect({ ok: true, banco: 'ok' });
  });

  it('não expõe /saude sob o prefixo /v1', () => {
    return request(app.getHttpServer()).get('/v1/saude').expect(404);
  });
});
