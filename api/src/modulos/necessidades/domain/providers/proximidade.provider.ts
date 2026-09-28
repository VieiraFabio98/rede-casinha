import type { Ponto } from '../../../../shared/domain/geo.js';

/**
 * A pessoa está a até 100 m do local exato? Só o booleano sai daqui (nunca a distância);
 * `null` se não há posição. Implementado pelo módulo `localizacao`.
 */
export interface VerificadorDeProximidade {
  estaPerto(casinhaId: string, posicao: Ponto | null): Promise<boolean | null>;
}

export const VERIFICADOR_DE_PROXIMIDADE = Symbol('VerificadorDeProximidade');
