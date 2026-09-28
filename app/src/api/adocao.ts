import { pedirPermissaoLocalizacao, posicaoAtual } from '@/map/localizacao';

import { api } from './cliente';
import { clienteConsultas } from './consultas';

type Resultado = 'ok' | 'nao_permitido';

/**
 * Adota a casinha (online: a resposta depende de onde a pessoa está AGORA, por isso não passa
 * pela fila offline). Pede a localização (com explicação) e manda a posição atual do GPS.
 * `sem_posicao`: sem permissão ou GPS desligado (o criador ainda consegue adotar sem ela).
 */
export async function adotar(casinhaId: string): Promise<Resultado | 'sem_posicao'> {
  let posicao: { lat: number; lng: number } | object = {};
  if (await pedirPermissaoLocalizacao()) {
    try {
      const [lng, lat] = await posicaoAtual();
      posicao = { lat, lng };
    } catch {
      // GPS desligado: tenta mesmo assim (o criador não precisa de posição).
    }
  }
  const { resultado } = await api<{ resultado: Resultado }>(`/casinhas/${casinhaId}/adocao`, {
    metodo: 'POST',
    corpo: posicao,
  });
  if (resultado === 'ok') await recarregar();
  return resultado === 'nao_permitido' && !('lat' in posicao) ? 'sem_posicao' : resultado;
}

export async function deixarDeAdotar(casinhaId: string) {
  await api(`/casinhas/${casinhaId}/adocao`, { metodo: 'DELETE' });
  await recarregar();
}

/** Adotar muda a exata, os botões e "Minhas casinhas": recarrega tudo de casinhas. */
const recarregar = () => clienteConsultas.invalidateQueries({ queryKey: ['casinhas'] });
