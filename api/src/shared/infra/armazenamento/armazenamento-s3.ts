import type { Readable } from 'node:stream';

import {
  DeleteObjectsCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

import { Armazenamento } from './armazenamento.service.js';

/**
 * AWS S3 (ou compatível, como o Cloudflare R2, via `endpoint`). O bucket fica privado:
 * o app nunca acessa o S3 direto, só pela API (`GET /fotos/:id` com URL assinada).
 * Credenciais: AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY, lidas pelo próprio SDK.
 */
export class ArmazenamentoS3 extends Armazenamento {
  private readonly s3: S3Client;

  constructor(
    private readonly bucket: string,
    regiao: string,
    endpoint?: string,
  ) {
    super();
    this.s3 = new S3Client({ region: regiao, ...(endpoint && { endpoint }) });
  }

  async gravar(chave: string, dados: Buffer, tipo: string): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: chave, Body: dados, ContentType: tipo }),
    );
  }

  async ler(chave: string): Promise<Readable | null> {
    try {
      const { Body } = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: chave }),
      );
      return (Body as Readable | undefined) ?? null;
    } catch (erro) {
      if (erro instanceof NoSuchKey) return null;
      throw erro;
    }
  }

  async apagar(chaves: string[]): Promise<void> {
    // O DeleteObjects aceita até 1.000 chaves por chamada.
    for (let i = 0; i < chaves.length; i += 1000) {
      await this.s3.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: chaves.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true },
        }),
      );
    }
  }
}
