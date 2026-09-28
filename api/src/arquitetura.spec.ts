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
        // Também pega a relação `localizacao` num include/select do Prisma (`localizacao: true`).
        /\bcasinhaLocalizacao\b|\bcasinhas_localizacao\b|\blocalizacao\s*:\s*(true|\{)/.test(
          readFileSync(join(RAIZ_SRC, arquivo), 'utf8'),
        ),
      );

    expect(violacoes).toEqual([]);
  });

  /** Imports de um arquivo (o que vem depois de `from '...'`). */
  const importsDe = (arquivo: string) =>
    [...readFileSync(join(RAIZ_SRC, arquivo), 'utf8').matchAll(/from\s+'([^']+)'/g)].map(
      (m) => m[1],
    );

  /** Arquivos de uma camada (`domain`, `application`) nos módulos e em `shared`. */
  const daCamada = (camada: string) =>
    arquivosTs(RAIZ_SRC)
      .map((arquivo) => relative(RAIZ_SRC, arquivo))
      .filter((arquivo) => arquivo.split(/[\\/]/).includes(camada))
      .filter((arquivo) => arquivo.startsWith('modulos') || arquivo.startsWith('shared'));

  it('domain não depende de Nest, Prisma, application nem infra', () => {
    const violacoes = daCamada('domain').flatMap((arquivo) =>
      importsDe(arquivo)
        .filter((i) => /^@nestjs\/|generated\/prisma|\/(application|infra)\//.test(i))
        .map((i) => `${arquivo} → ${i}`),
    );
    expect(violacoes).toEqual([]);
  });

  it('application não depende de Prisma nem de infra', () => {
    const violacoes = daCamada('application').flatMap((arquivo) =>
      importsDe(arquivo)
        .filter((i) => /generated\/prisma|\/infra\//.test(i))
        .map((i) => `${arquivo} → ${i}`),
    );
    expect(violacoes).toEqual([]);
  });

  it('todo arquivo de módulo está em domain, application ou infra (fora o <modulo>.module.ts)', () => {
    const violacoes = arquivosTs(join(RAIZ_SRC, 'modulos'))
      .map((arquivo) => relative(join(RAIZ_SRC, 'modulos'), arquivo).split(/[\\/]/))
      .filter(([modulo, ...resto]) =>
        resto.length === 1
          ? resto[0] !== `${modulo}.module.ts`
          : !['domain', 'application', 'infra'].includes(resto[0]),
      )
      .map((partes) => partes.join('/'));
    expect(violacoes).toEqual([]);
  });
});
