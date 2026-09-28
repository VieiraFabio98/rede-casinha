import type { Ponto } from '../../../../shared/domain/geo.js';
import type { UsuarioLogado } from '../../../../shared/domain/usuario-logado.js';

interface CasinhaRef {
  id: string;
  criadaPorId: string | null;
}

/** A localização exata, para quem pode vê-la (módulo `localizacao`, RN05). */
export interface LocalizacaoExata {
  paraLista(usuario: UsuarioLogado, casinhas: CasinhaRef[]): Promise<Map<string, Ponto>>;
  /** Para o verificado, gasta 1 da cota diária. */
  paraDetalhe(usuario: UsuarioLogado, casinha: CasinhaRef): Promise<Ponto | null>;
  /** Ids das casinhas visíveis a até 30 m do ponto, da mais perto para a mais longe (RN04). */
  proximas(ponto: Ponto): Promise<string[]>;
  /** Sorteia a localização pública de uma exata nova (RN05: uma vez só, no cadastro). */
  publicaPara(exata: Ponto): Ponto;
  registrar(casinhaId: string, exata: Ponto, precisaoM: number): Promise<void>;
}

export const LOCALIZACAO_EXATA = Symbol('LocalizacaoExata');
