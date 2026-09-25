import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { contestar } from '@/api/acoes';
import { useCasinha } from '@/api/casinhas';
import { useSessao } from '@/auth/sessao';
import { Botao } from '@/components/botao';
import { CampoTexto } from '@/components/campo-texto';
import { TelaFormulario } from '@/components/tela-formulario';
import { ThemedText } from '@/components/themed-text';
import { textos } from '@/i18n/pt-BR';

const t = textos.contestar;

/** "Não foi resolvido" (RF03.5): reabre um atendimento de até 24 h atrás. */
export default function ContestarScreen() {
  const { necessidadeId, casinhaId } = useLocalSearchParams<{
    necessidadeId: string;
    casinhaId: string;
  }>();
  const router = useRouter();
  const { me } = useSessao();
  const { data: casinha } = useCasinha(casinhaId);
  const atendida = casinha?.atendidasRecentemente.find((n) => n.id === necessidadeId);

  const [observacao, setObservacao] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    if (!atendida) return;
    setEnviando(true);
    try {
      await contestar(casinhaId, atendida, observacao.trim(), me?.perfil?.apelido ?? '');
      router.back();
    } catch {
      Alert.alert(textos.reportar.erro);
    } finally {
      setEnviando(false);
    }
  }

  const tipo = atendida ? textos.mapa.necessidades[atendida.tipo].toLowerCase() : '';
  return (
    <TelaFormulario>
      <Stack.Screen options={{ title: t.titulo }} />
      <ThemedText>{t.explicacao(tipo)}</ThemedText>
      <CampoTexto
        rotulo={t.campo}
        placeholder={t.dica}
        value={observacao}
        onChangeText={setObservacao}
        maxLength={280}
        multiline
        autoFocus
      />
      <Botao
        titulo={t.enviar}
        disabled={!atendida || observacao.trim().length < 3}
        carregando={enviando}
        onPress={enviar}
      />
    </TelaFormulario>
  );
}
