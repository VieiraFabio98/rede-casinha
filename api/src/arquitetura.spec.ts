import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const RAIZ_SRC = import.meta.dirname;

function arquivosTs(pasta: string): string[] {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((item) => {
    const caminho = join(pasta, item.name);
    if (item.isDirectory()) return item.name === 'generated' ? [] : arquivosTs(caminho);
    return item.name.endsWith('.ts') && !item.name.endsWith('.spec.ts') ? [caminho] : [];
  });
}

describe('regras de arquitetura', () => {
  it('só o módulo localizacao acessa a localização exata (casinhaLocalizacao)', () => {
    const violacoes = arquivosTs(RAIZ_SRC)
      .map((arquivo) => relative(RAIZ_SRC, arquivo))
      .filter((arquivo) => !arquivo.startsWith(join('modulos', 'localizacao')))
      .filter((arquivo) =>
        /\bcasinhaLocalizacao\b|\bcasinhas_localizacao\b/.test(
          readFileSync(join(RAIZ_SRC, arquivo), 'utf8'),
        ),
      );

    expect(violacoes).toEqual([]);
  });
});
