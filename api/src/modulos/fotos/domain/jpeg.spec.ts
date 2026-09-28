import { limparJpeg } from './jpeg.js';

/** Segmento JPEG: FF <marcador> <tamanho de 2 bytes, contando ele mesmo> <conteúdo>. */
const segmento = (marcador: number, conteudo: Buffer) => {
  const cabecalho = Buffer.from([0xff, marcador, 0, 0]);
  cabecalho.writeUInt16BE(conteudo.length + 2, 2);
  return Buffer.concat([cabecalho, conteudo]);
};

const SOI = Buffer.from([0xff, 0xd8]);
const EOI = Buffer.from([0xff, 0xd9]);
const JFIF = segmento(0xe0, Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0', 'latin1'));
const EXIF = segmento(0xe1, Buffer.from('Exif\0\0GPS -23.5505 -46.6333', 'latin1'));
const XMP = segmento(0xe1, Buffer.from('http://ns.adobe.com/xap/1.0/\0<gps/>', 'latin1'));
const ICC = segmento(0xe2, Buffer.from('ICC_PROFILE\0\x01\x01perfil', 'latin1'));
const MPF = segmento(0xe2, Buffer.from('MPF\0outra imagem', 'latin1'));
const COMENTARIO = segmento(0xfe, Buffer.from('tirada na rua tal', 'latin1'));
const DQT = segmento(0xdb, Buffer.alloc(65, 1));
const SOF = segmento(0xc0, Buffer.from([8, 0, 16, 0, 16, 1, 1, 0x11, 0]));
const SOS = segmento(0xda, Buffer.from([1, 1, 0, 0, 0x3f, 0]));
/** Dados da imagem, com um RST e um 0xFF 0x00 (byte "escapado") no meio. */
const IMAGEM = Buffer.from([0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56]);

const jpeg = (...partes: Buffer[]) => Buffer.concat([SOI, ...partes, SOS, IMAGEM, EOI]);

describe('limparJpeg', () => {
  it('tira EXIF, XMP, comentários e APP2 que não é perfil de cor', () => {
    const original = jpeg(JFIF, EXIF, XMP, ICC, MPF, COMENTARIO, DQT, SOF);

    const limpo = limparJpeg(original)!;

    expect(limpo).toEqual(jpeg(JFIF, ICC, DQT, SOF));
    expect(limpo.includes('GPS')).toBe(false);
    expect(limpo.includes('rua tal')).toBe(false);
  });

  it('JPEG sem metadados sai igual', () => {
    const original = jpeg(JFIF, DQT, SOF);
    expect(limparJpeg(original)).toEqual(original);
  });

  it('aceita bytes 0xFF de preenchimento antes de um marcador', () => {
    const comPreenchimento = Buffer.concat([SOI, Buffer.from([0xff]), EXIF, DQT, SOS, IMAGEM, EOI]);
    expect(limparJpeg(comPreenchimento)).toEqual(jpeg(DQT));
  });

  it.each([
    ['vazio', Buffer.alloc(0)],
    ['PNG', Buffer.from('\x89PNG\r\n\x1a\n0000', 'latin1')],
    ['só o início', Buffer.concat([SOI, JFIF])],
    ['segmento cortado', Buffer.concat([SOI, EXIF.subarray(0, 10)])],
    ['lixo entre segmentos', Buffer.concat([SOI, JFIF, Buffer.from([0x00]), SOS, IMAGEM, EOI])],
    ['fim antes da imagem', Buffer.concat([SOI, JFIF, EOI])],
  ])('recusa o que não é JPEG: %s', (_nome, dados) => {
    expect(limparJpeg(dados)).toBeNull();
  });
});
