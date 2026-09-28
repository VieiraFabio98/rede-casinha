import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { denunciar, type MotivoDenuncia } from '@/api/acoes';
import { useCasinha } from '@/api/casinhas';
import { Botao } from '@/components/botao';
import { CampoTexto } from '@/components/campo-texto';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { textos } from '@/i18n/pt-BR';

const t = textos.denunciar;
const MOTIVOS = Object.keys(t.motivos) as MotivoDenuncia[];

function Opcao({
  rotulo,
  marcada,
  aoTocar,
}: {
  rotulo: string;
  marcada: boolean;
  aoTocar: () => void;
}) {
  const cores = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: marcada }}
      onPress={aoTocar}
      style={({ pressed }) => [
        styles.opcao,
        {
          backgroundColor: cores.backgroundElement,
          borderColor: marcada ? cores.primary : 'transparent',
          opacity: pressed ? 0.8 : 1,
        },
      ]}>
      <View style={[styles.radio, { borderColor: marcada ? cores.primary : cores.textSecondary }]}>
        {marcada && <View style={[styles.radioMiolo, { backgroundColor: cores.primary }]} />}
      </View>
      <ThemedText style={styles.flex}>{rotulo}</ThemedText>
    </Pressable>
  );
}

/**
 * Denúncia (RF06.1): primeiro o alvo (a casinha ou um dos pedidos abertos dela), depois o motivo.
 * Foto entra com a T1.5; perfil, quando houver perfil público.
 */
export default function DenunciarScreen() {
  const { casinhaId } = useLocalSearchParams<{ casinhaId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: casinha } = useCasinha(casinhaId);

  const [alvoId, setAlvoId] = useState(casinhaId);
  const [motivo, setMotivo] = useState<MotivoDenuncia | null>(null);
  const [descricao, setDescricao] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    if (!motivo) return;
    setEnviando(true);
    try {
      await denunciar(
        { alvoTipo: alvoId === casinhaId ? 'casinha' : 'necessidade', alvoId },
        motivo,
        descricao.trim() || undefined,
      );
      router.back();
      Alert.alert(t.obrigado);
    } catch {
      Alert.alert(t.erro);
    } finally {
      setEnviando(false);
    }
  }

  const pedidos = casinha?.necessidadesAbertas ?? [];
  return (
    <ThemedView style={styles.tela}>
      <Stack.Screen options={{ title: t.titulo }} />
      <ScrollView contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
        {pedidos.length > 0 && (
          <View style={styles.grupo} accessibilityRole="radiogroup">
            <ThemedText type="smallBold">{t.oQue}</ThemedText>
            <Opcao
              rotulo={`${t.aCasinha}${casinha ? ` (${casinha.nome})` : ''}`}
              marcada={alvoId === casinhaId}
              aoTocar={() => setAlvoId(casinhaId)}
            />
            {pedidos.map((n) => (
              <Opcao
                key={n.id}
                rotulo={t.oPedido(textos.mapa.necessidades[n.tipo].toLowerCase())}
                marcada={alvoId === n.id}
                aoTocar={() => setAlvoId(n.id)}
              />
            ))}
          </View>
        )}

        <View style={styles.grupo} accessibilityRole="radiogroup">
          <ThemedText type="smallBold">{t.motivo}</ThemedText>
          {MOTIVOS.map((m) => (
            <Opcao
              key={m}
              rotulo={t.motivos[m]}
              marcada={motivo === m}
              aoTocar={() => setMotivo(m)}
            />
          ))}
        </View>

        <CampoTexto
          rotulo={t.descricao}
          dica={t.dicaDescricao}
          value={descricao}
          onChangeText={setDescricao}
          maxLength={500}
          multiline
        />
      </ScrollView>

      <ThemedView style={[styles.rodape, { paddingBottom: insets.bottom + Spacing.two }]}>
        <Botao titulo={t.enviar} disabled={!motivo} carregando={enviando} onPress={enviar} />
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  tela: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  conteudo: {
    padding: Spacing.three,
    gap: Spacing.four,
  },
  grupo: {
    gap: Spacing.two,
  },
  opcao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 52,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    borderWidth: 2,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioMiolo: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  rodape: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    elevation: 8,
  },
});
