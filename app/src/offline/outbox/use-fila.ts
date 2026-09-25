import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import { Alert, AppState } from 'react-native';

import { textos } from '@/i18n/pt-BR';

import {
  assinarFila,
  assinarRespostas,
  definirUsuarioDaFila,
  listarFila,
  sincronizar,
  tentarAgora,
} from './fila';
import type { ItemOutbox } from './tipos';

/** Com o app aberto, tenta de novo a cada 2 min (além dos outros gatilhos). */
const INTERVALO_MS = 2 * 60_000;

/**
 * Liga a fila à sessão e aos gatilhos de envio: login, rede que volta (NetInfo),
 * app que volta ao primeiro plano e o intervalo de 2 min. Rede e primeiro plano ignoram
 * a espera do backoff; o intervalo a respeita. Usar uma vez, no layout raiz.
 */
export function useSincronizacaoDaFila(usuarioId: string | null) {
  useEffect(() => {
    void definirUsuarioDaFila(usuarioId);
  }, [usuarioId]);

  useEffect(() => {
    if (!usuarioId) return;
    let conectado: boolean | null = null;
    const semRede = NetInfo.addEventListener((estado) => {
      const agora = !!estado.isConnected;
      // A rede voltou: a espera do backoff (pensada para "sem rede") não vale mais.
      if (agora && conectado === false) void tentarAgora();
      conectado = agora;
    });
    const primeiroPlano = AppState.addEventListener('change', (estado) => {
      // Voltou ao app (talvez em outro lugar, com outra rede): tenta já, sem esperar o backoff.
      if (estado === 'active') void tentarAgora();
    });
    const intervalo = setInterval(sincronizar, INTERVALO_MS);
    // RN03: atendimento que chegou depois de outro (inclusive o feito offline) ganha um aviso gentil.
    const respostas = assinarRespostas((_item, resposta) => {
      const resultado = (resposta as { resultado?: string } | undefined)?.resultado;
      if (resultado === 'ja_atendida') Alert.alert(textos.casinha.jaAtendida);
      if (resultado === 'ja_reconfirmada') Alert.alert(textos.casinha.jaReconfirmada);
    });
    return () => {
      respostas();
      semRede();
      primeiroPlano.remove();
      clearInterval(intervalo);
    };
  }, [usuarioId]);
}

/** Itens da fila do usuário logado, atualizados a cada mudança. */
export function useFila(): ItemOutbox[] {
  const [itens, setItens] = useState<ItemOutbox[]>([]);
  useEffect(() => {
    let ativo = true;
    const carregar = () =>
      listarFila()
        .then((lista) => ativo && setItens(lista))
        .catch(() => {});
    carregar();
    const cancelar = assinarFila(carregar);
    return () => {
      ativo = false;
      cancelar();
    };
  }, []);
  return itens;
}
