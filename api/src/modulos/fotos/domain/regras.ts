/** Foto de 1024 px com qualidade 0,7 fica em ~120 KB (RNF04). */
export const TAMANHO_MAXIMO_FOTO = 1024 * 1024;
/** Miniatura de 320 px fica em ~25 KB. */
export const TAMANHO_MAXIMO_MINIATURA = 200 * 1024;

/** Fotos de perfil visíveis por casinha (RN06). */
export const MAXIMO_FOTOS_DA_CASINHA = 5;
/** Fotos de atendimento são apagadas depois de 90 dias (RN06). */
export const DIAS_FOTO_DE_ATIVIDADE = 90;

/** Validade mínima de uma URL assinada. */
export const VALIDADE_URL_MS = 60 * 60 * 1000;
/**
 * A expiração é arredondada para cima em blocos de 30 min: a mesma foto tem a mesma URL durante
 * cada bloco, e o cache de imagens do app reaproveita. A URL vale de 1 h a 1 h 30.
 */
const BLOCO_MS = 30 * 60 * 1000;

export type Variante = 'foto' | 'miniatura';

export const chavesDaFoto = (casinhaId: string, fotoId: string) => ({
  chave: `fotos/${casinhaId}/${fotoId}.jpg`,
  chaveMiniatura: `fotos/${casinhaId}/${fotoId}_t.jpg`,
});

export const expiraEmDaFoto = (atividadeId: string | null, agora: Date): Date | null =>
  atividadeId ? new Date(agora.getTime() + DIAS_FOTO_DE_ATIVIDADE * 24 * 60 * 60 * 1000) : null;

/** Expiração da URL assinada, em segundos (epoch). */
export function expiracaoDaUrl(agora: Date): number {
  const minimo = agora.getTime() + VALIDADE_URL_MS;
  return Math.ceil(minimo / BLOCO_MS) * (BLOCO_MS / 1000);
}

/** O que a assinatura cobre: a foto, a variante e a expiração. */
export const textoAssinado = (fotoId: string, variante: Variante, exp: number) =>
  `${fotoId}:${variante}:${exp}`;

/** Caminho relativo à base da API (ex.: `https://api…/v1`). */
function caminhoDaFoto(fotoId: string, variante: Variante, exp: number, assinatura: string) {
  const sufixo = variante === 'miniatura' ? '/miniatura' : '';
  return `/fotos/${fotoId}${sufixo}?exp=${exp}&assinatura=${assinatura}`;
}

/** URLs assinadas das duas versões de uma foto. `assinar` é o HMAC (fica na infra). */
export function urlsDaFoto(
  fotoId: string,
  agora: Date,
  assinar: (texto: string) => string,
): UrlsDaFoto {
  const exp = expiracaoDaUrl(agora);
  const url = (variante: Variante) =>
    caminhoDaFoto(fotoId, variante, exp, assinar(textoAssinado(fotoId, variante, exp)));
  return { id: fotoId, url: url('foto'), urlMiniatura: url('miniatura') };
}

export interface UrlsDaFoto {
  id: string;
  /** Relativas à base da API; valem por pelo menos 1 h. */
  url: string;
  urlMiniatura: string;
}
