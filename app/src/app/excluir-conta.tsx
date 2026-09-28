import { Stack } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { ErroApi } from '@/api/cliente';
import { useSessao } from '@/auth/sessao';
import { Botao } from '@/components/botao';
import { CampoTexto } from '@/components/campo-texto';
import { TelaFormulario } from '@/components/tela-formulario';
import { ThemedText } from '@/components/themed-text';
import { COR_STATUS } from '@/domain/status';
import { textos } from '@/i18n/pt-BR';

const t = textos.excluirConta;

/**
 * Exclusão de conta dentro do app (RF05.3, exigida pela Google Play). Explica o que é apagado e
 * o que fica anonimizado (RN07) e pede para digitar EXCLUIR, para ninguém apagar sem querer.
 */
export default function ExcluirContaScreen() {
  const { excluirConta } = useSessao();
  const [confirmacao, setConfirmacao] = useState('');
  const [excluindo, setExcluindo] = useState(false);

  async function excluir() {
    setExcluindo(true);
    try {
      await excluirConta();
      // A sessão acabou: a navegação leva para a tela de entrada sozinha.
      Alert.alert(t.excluida);
    } catch (erro) {
      Alert.alert(erro instanceof ErroApi && erro.semConexao ? t.semConexao : t.erro);
      setExcluindo(false);
    }
  }

  return (
    <TelaFormulario>
      <Stack.Screen options={{ title: t.titulo }} />
      <ThemedText>{t.oQueApaga}</ThemedText>
      <ThemedText>{t.oQueFica}</ThemedText>
      <ThemedText type="smallBold" style={{ color: COR_STATUS.urgente.cor }}>
        {t.irreversivel}
      </ThemedText>
      <CampoTexto
        rotulo={t.confirmar(t.palavra)}
        value={confirmacao}
        onChangeText={setConfirmacao}
        autoCapitalize="characters"
        autoCorrect={false}
      />
      <Botao
        titulo={t.excluir}
        disabled={confirmacao.trim().toUpperCase() !== t.palavra}
        carregando={excluindo}
        onPress={excluir}
        style={{ backgroundColor: COR_STATUS.urgente.cor }}
      />
    </TelaFormulario>
  );
}
