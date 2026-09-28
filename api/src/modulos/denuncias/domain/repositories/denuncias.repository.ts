import type { Alvo, MotivoDenuncia } from '../../../moderacao/domain/entities/denuncia.js';

export interface NovaDenuncia extends Alvo {
  motivo: MotivoDenuncia;
  descricao?: string;
  denuncianteId: string;
}

export interface DenunciasRepository {
  /** Casinha dona do alvo (a própria, a da foto, a da necessidade). `null` se não existe. */
  casinhaDoAlvo(alvo: Alvo): Promise<string | null>;
  perfilExiste(id: string): Promise<boolean>;
  jaDenunciou(alvoId: string, denuncianteId: string): Promise<boolean>;
  criar(nova: NovaDenuncia): Promise<void>;
  /** Denúncias abertas contra o alvo feitas por contas criadas até `contasCriadasAte`. */
  contarAbertasDeContasAntigas(alvoId: string, contasCriadasAte: Date): Promise<number>;
  atividadeExiste(id: string): Promise<boolean>;
  registrarPedidoDeDesativacao(dados: {
    atividadeId: string;
    casinhaId: string;
    usuarioId: string;
    motivo: string;
    em: Date;
  }): Promise<void>;
}

export const DENUNCIAS_REPOSITORY = Symbol('DenunciasRepository');
