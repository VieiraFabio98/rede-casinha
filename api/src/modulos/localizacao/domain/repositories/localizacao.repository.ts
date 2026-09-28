import type { Ponto } from '../../../../shared/domain/geo.js';

/**
 * Acesso à localização EXATA (`casinhas_localizacao`) e à auditoria de quem a viu.
 * Só este módulo tem uma implementação disto (regra coberta por src/arquitetura.spec.ts).
 */
export interface LocalizacaoRepository {
  exatas(casinhaIds: string[]): Promise<Map<string, Ponto>>;
  /** Das casinhas dadas, as que o usuário adota hoje. */
  adotadasPor(usuarioId: string, casinhaIds: string[]): Promise<Set<string>>;
  /** Das casinhas dadas, as que o usuário (verificado) já viu com a exata neste dia. */
  vistasNoDia(usuarioId: string, dia: Date, casinhaIds: string[]): Promise<Set<string>>;
  /** Trava o usuário até o fim da transação: pedidos simultâneos não furam a cota. */
  travarUsuario(usuarioId: string): Promise<void>;
  contarVistasNoDia(usuarioId: string, dia: Date): Promise<number>;
  registrarVista(usuarioId: string, casinhaId: string, dia: Date): Promise<void>;
  /** Exatas das casinhas visíveis e não inativas dentro de ±`graus` do ponto (pré-filtro). */
  exatasNaCaixa(ponto: Ponto, graus: number): Promise<{ casinhaId: string; ponto: Ponto }[]>;
  criarExata(casinhaId: string, exata: Ponto, precisaoM: number): Promise<void>;
  /** Pares de exatas dentro de uma caixa de `graus` uma da outra (pré-filtro; confirmar distância). */
  candidatosProximos(
    graus: number,
    limite: number,
  ): Promise<{ a: string; b: string; pontoA: Ponto; pontoB: Ponto }[]>;
}

export const LOCALIZACAO_REPOSITORY = Symbol('LocalizacaoRepository');
