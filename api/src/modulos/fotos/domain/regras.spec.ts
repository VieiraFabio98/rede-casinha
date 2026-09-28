import { expiracaoDaUrl, expiraEmDaFoto, textoAssinado, urlsDaFoto } from './regras.js';

describe('regras de fotos', () => {
  it('a URL vale de 1 h a 1 h 30 e é a mesma dentro de cada bloco de 30 min', () => {
    const agora = new Date('2026-09-28T12:10:00Z');
    const exp = expiracaoDaUrl(agora);

    expect(new Date(exp * 1000).toISOString()).toBe('2026-09-28T13:30:00.000Z');
    expect(expiracaoDaUrl(new Date('2026-09-28T12:29:59Z'))).toBe(exp);
    expect(expiracaoDaUrl(new Date('2026-09-28T12:30:01Z'))).toBeGreaterThan(exp);
  });

  it('urls das duas versões, assinando foto, variante e expiração', () => {
    const agora = new Date('2026-09-28T12:00:00Z');
    const exp = expiracaoDaUrl(agora);
    const assinar = (texto: string) => `sig(${texto})`;

    expect(urlsDaFoto('f1', agora, assinar)).toEqual({
      id: 'f1',
      url: `/fotos/f1?exp=${exp}&assinatura=sig(${textoAssinado('f1', 'foto', exp)})`,
      urlMiniatura: `/fotos/f1/miniatura?exp=${exp}&assinatura=sig(f1:miniatura:${exp})`,
    });
  });

  it('só foto de atividade expira (90 dias)', () => {
    const agora = new Date('2026-09-28T12:00:00Z');
    expect(expiraEmDaFoto(null, agora)).toBeNull();
    expect(expiraEmDaFoto('a1', agora)?.toISOString()).toBe('2026-12-27T12:00:00.000Z');
  });
});
