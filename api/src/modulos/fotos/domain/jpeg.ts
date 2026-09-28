const SOI = 0xd8;
const EOI = 0xd9;
const SOS = 0xda;
const APP0 = 0xe0;
const APP2 = 0xe2;
const APP14 = 0xee;

const ICC = Buffer.from('ICC_PROFILE\0', 'latin1');

/** Marcadores sem tamanho (não têm segmento depois): RSTn, TEM. */
const semTamanho = (marcador: number) =>
  (marcador >= 0xd0 && marcador <= 0xd7) || marcador === 0x01;

/**
 * Segmentos que ficam: APP0 (JFIF), APP2 só com perfil de cor ICC, APP14 (Adobe, necessário para
 * decodificar alguns JPEG) e os que não são APPn/COM (tabelas, SOF…). Saem APP1 (EXIF e XMP,
 * onde fica o GPS), os outros APPn e comentários.
 */
function mantem(marcador: number, conteudo: Buffer): boolean {
  if (marcador === APP0 || marcador === APP14) return true;
  if (marcador === APP2) return conteudo.subarray(0, ICC.length).equals(ICC);
  const ehApp = marcador >= 0xe0 && marcador <= 0xef;
  return !ehApp && marcador !== 0xfe;
}

/**
 * Confere se os bytes são um JPEG e devolve uma cópia sem metadados (EXIF, XMP, comentários).
 * O app já reencoda a foto (o que tira o EXIF); esta é a segunda barreira, no servidor, para
 * nunca guardar o GPS embutido numa foto. `null` = não é um JPEG válido.
 */
export function limparJpeg(dados: Buffer): Buffer | null {
  if (dados.length < 4 || dados[0] !== 0xff || dados[1] !== SOI) return null;

  const partes: Buffer[] = [dados.subarray(0, 2)];
  let i = 2;
  while (i < dados.length) {
    if (dados[i] !== 0xff) return null;
    // Bytes 0xFF extras antes de um marcador são preenchimento.
    while (i < dados.length && dados[i] === 0xff) i++;
    if (i >= dados.length) return null;
    const marcador = dados[i];
    const inicio = i - 1;
    i++;

    if (marcador === EOI) return null; // acabou antes da imagem
    if (semTamanho(marcador)) {
      partes.push(dados.subarray(inicio, i));
      continue;
    }

    if (i + 2 > dados.length) return null;
    const tamanho = dados.readUInt16BE(i);
    if (tamanho < 2 || i + tamanho > dados.length) return null;
    const fim = i + tamanho;

    if (marcador === SOS) {
      // Depois do cabeçalho do SOS vêm os dados da imagem até o fim: copia como está.
      partes.push(dados.subarray(inicio));
      return Buffer.concat(partes);
    }
    if (mantem(marcador, dados.subarray(i + 2, fim))) partes.push(dados.subarray(inicio, fim));
    i = fim;
  }
  return null;
}
