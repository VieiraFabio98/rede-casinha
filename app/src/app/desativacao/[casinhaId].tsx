import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { pedirDesativacao } from '@/api/acoes';
import { useSessao } from '@/auth/sessao';
import { Botao } from '@/components/botao';
import { CampoTexto } from '@/components/campo-texto';
import { TelaFormulario } from '@/components/tela-formulario';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { textos } from '@/i18n/pt-BR';

const t = textos.desativacao;

/** "A casinha não existe mais" (RF02.7): vai para a moderação, que confere antes de desativar. */
export default function DesativacaoScreen() {
  const { casinhaId } = useLocalSearchParams<{ casinhaId: string }>();
  const router = useRouter();
  const { me } = useSessao();
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setEnviando(true);
    try {
      await pedirDesativacao(casinhaId, motivo.trim(), me?.perfil?.apelido ?? '');
      router.back();
      Alert.alert(t.obrigado);
    } catch {
      Alert.alert(textos.denunciar.erro);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <TelaFormulario>
      <Stack.Screen options={{ title: t.titulo }} />
      <ThemedText>{t.explicacao}</ThemedText>
      <View style={styles.rapidos}>
        {t.rapidos.map((texto) => (
          <Botao
            key={texto}
            titulo={texto}
            variante="secundario"
            onPress={() => setMotivo(texto)}
          />
        ))}
      </View>
      <CampoTexto
        rotulo={t.campo}
        value={motivo}
        onChangeText={setMotivo}
        maxLength={280}
        multiline
      />
      <Botao
        titulo={t.enviar}
        disabled={motivo.trim().length < 3}
        carregando={enviando}
        onPress={enviar}
      />
    </TelaFormulario>
  );
}

const styles = StyleSheet.create({
  rapidos: {
    gap: Spacing.two,
  },
});
