import { createReadStream } from 'node:fs';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';

/**
 * Onde ficam os arquivos (hoje, só as fotos). A implementação é escolhida por
 * ARMAZENAMENTO_DRIVER (ver armazenamento.module.ts). As chaves são caminhos relativos,
 * ex.: `fotos/<casinha>/<foto>.jpg`.
 */
export abstract class Armazenamento {
  /** Grava (ou sobrescreve) o arquivo. */
  abstract gravar(chave: string, dados: Buffer, tipo: string): Promise<void>;
  /** Abre o arquivo para leitura. `null` se não existe. */
  abstract ler(chave: string): Promise<Readable | null>;
  /** Apaga os arquivos. Chave que não existe é ignorada. */
  abstract apagar(chaves: string[]): Promise<void>;
}

/** Desenvolvimento e VPS: uma pasta no disco. */
export class ArmazenamentoDisco extends Armazenamento {
  private readonly raiz: string;

  constructor(pasta: string) {
    super();
    this.raiz = resolve(pasta);
  }

  /** Caminho absoluto da chave, sem deixar sair da pasta (`../`). */
  private caminho(chave: string): string {
    const caminho = resolve(this.raiz, chave);
    if (!caminho.startsWith(this.raiz + sep)) throw new Error(`Chave inválida: ${chave}`);
    return caminho;
  }

  async gravar(chave: string, dados: Buffer): Promise<void> {
    const caminho = this.caminho(chave);
    await mkdir(dirname(caminho), { recursive: true });
    // Grava num temporário e renomeia: quem lê nunca vê um arquivo pela metade.
    const temporario = `${caminho}.${process.pid}.tmp`;
    await writeFile(temporario, dados);
    await rename(temporario, caminho);
  }

  async ler(chave: string): Promise<Readable | null> {
    const stream = createReadStream(this.caminho(chave));
    return new Promise((resolver, rejeitar) => {
      stream.once('open', () => resolver(stream));
      stream.once('error', (erro: NodeJS.ErrnoException) =>
        erro.code === 'ENOENT' ? resolver(null) : rejeitar(erro),
      );
    });
  }

  async apagar(chaves: string[]): Promise<void> {
    await Promise.all(chaves.map((chave) => rm(this.caminho(chave), { force: true })));
  }
}

/** Testes: guarda os arquivos num Map para o teste conferir. */
export class ArmazenamentoMemoria extends Armazenamento {
  readonly arquivos = new Map<string, Buffer>();

  async gravar(chave: string, dados: Buffer): Promise<void> {
    this.arquivos.set(chave, Buffer.from(dados));
  }

  async ler(chave: string): Promise<Readable | null> {
    const dados = this.arquivos.get(chave);
    return dados ? Readable.from([dados]) : null;
  }

  async apagar(chaves: string[]): Promise<void> {
    for (const chave of chaves) this.arquivos.delete(chave);
  }
}
