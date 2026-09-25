import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { reportar } from '@/api/acoes';
import type { TipoNecessidade } from '@/api/tipos';
import { useSessao } from '@/auth/sessao';
import { Botao } from '@/components/botao';
import { CampoTexto } from '@/components/campo-texto';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { COR_STATUS, TIPOS_NECESSIDADE } from '@/domain/status';
import { useTheme } from '@/hooks/use-theme';
import { textos } from '@/i18n/pt-BR';

const t = textos.reportar;

/** Ícone Material (Android) de cada tipo, grande e fácil de achar. */
const ICONE: Record<TipoNecessidade, SymbolViewProps['name']> = {
  agua: { ios: 'drop', android: 'water_drop' },
  racao: { ios: 'fork.knife', android: 'restaurant' },
  cobertas: { ios: 'bed.double', android: 'bed' },
  limpeza: { ios: 'sparkles', android: 'cleaning_services' },
  remedio_veterinario: { ios: 'cross.case', android: 'medical_services' },
  reforma: { ios: 'hammer', android: 'construction' },
  outro: { ios: 'ellipsis', android: 'more_horiz' },
};

function Opcao({
  rotulo,
  marcado,
  aoTocar,
  children,
  cor,
}: {
  rotulo: string;
  marcado: boolean;
  aoTocar: () => void;
  children?: React.ReactNode;
  cor?: string;
}) {
  const cores = useTheme();
  const destaque = cor ?? cores.primary;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: marcado }}
      accessibilityLabel={rotulo}
      onPress={aoTocar}
      style={({ pressed }) => [
        styles.opcao,
        {
          backgroundColor: marcado ? destaque : cores.backgroundElement,
          opacity: pressed ? 0.8 : 1,
        },
      ]}>
      {children}
      <ThemedText
        type="smallBold"
        style={[styles.rotuloOpcao, { color: marcado ? cores.background : cores.text }]}>
        {rotulo}
      </ThemedText>
    </Pressable>
  );
}

/** "O que está faltando?" (RF03.1): um ou mais tipos, urgência e observação. */
export default function ReportarScreen() {
  const { casinhaId } = useLocalSearchParams<{ casinhaId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cores = useTheme();
  const { me } = useSessao();

  const [tipos, setTipos] = useState<TipoNecessidade[]>([]);
  const [urgente, setUrgente] = useState(false);
  const [observacao, setObservacao] = useState('');
  const [enviando, setEnviando] = useState(false);

  const alternar = (tipo: TipoNecessidade) =>
    setTipos((atual) =>
      atual.includes(tipo) ? atual.filter((x) => x !== tipo) : [...atual, tipo],
    );

  async function avisar() {
    setEnviando(true);
    try {
      // Um pedido por tipo, na ordem em que foram marcados. A fila envia quando der.
      for (const tipo of tipos) {
        await reportar(
          casinhaId,
          {
            tipo,
            urgencia: urgente ? 'urgente' : 'normal',
            observacao: observacao.trim() || undefined,
          },
          me?.perfil?.apelido ?? '',
        );
      }
      router.back();
      Alert.alert(t.obrigado);
    } catch {
      Alert.alert(t.erro);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <ThemedView style={styles.tela}>
      <Stack.Screen options={{ title: t.titulo }} />
      <ScrollView contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
        <ThemedText themeColor="textSecondary">{t.escolha}</ThemedText>
        <View style={styles.grade}>
          {TIPOS_NECESSIDADE.map((tipo) => {
            const marcado = tipos.includes(tipo);
            return (
              <Opcao
                key={tipo}
                rotulo={textos.mapa.necessidades[tipo]}
                marcado={marcado}
                aoTocar={() => alternar(tipo)}>
                <SymbolView
                  name={ICONE[tipo]}
                  size={40}
                  tintColor={marcado ? cores.background : cores.primary}
                />
              </Opcao>
            );
          })}
        </View>

        <ThemedText type="smallBold">{t.urgencia}</ThemedText>
        <View style={styles.urgencia}>
          <Opcao rotulo={t.normal} marcado={!urgente} aoTocar={() => setUrgente(false)} />
          <Opcao
            rotulo={t.urgente}
            marcado={urgente}
            cor={COR_STATUS.urgente.cor}
            aoTocar={() => setUrgente(true)}
          />
        </View>

        <CampoTexto
          rotulo={t.observacao}
          placeholder={t.dicaObservacao}
          value={observacao}
          onChangeText={setObservacao}
          maxLength={280}
          multiline
        />
      </ScrollView>

      <ThemedView style={[styles.rodape, { paddingBottom: insets.bottom + Spacing.two }]}>
        <Botao
          titulo={t.enviar(tipos.length)}
          disabled={tipos.length === 0}
          carregando={enviando}
          onPress={avisar}
        />
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  tela: {
    flex: 1,
  },
  conteudo: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  grade: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  opcao: {
    flexGrow: 1,
    flexBasis: '30%',
    minHeight: 64,
    padding: Spacing.two,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  rotuloOpcao: {
    textAlign: 'center',
  },
  urgencia: {
    gap: Spacing.two,
  },
  rodape: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    elevation: 8,
  },
});
