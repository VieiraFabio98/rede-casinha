import { Pressable, StyleSheet, View } from 'react-native';

import type { CandidataDuplicata } from '@/api/tipos';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { Miniatura } from '@/fotos/galeria';
import { useTheme } from '@/hooks/use-theme';
import { textos } from '@/i18n/pt-BR';

const t = textos.novaCasinha;

/** "É uma destas?" (RN04): nome e foto das casinhas a até 30 m, sem coordenadas. */
export function Candidatas({
  candidatas,
  aoEscolher,
}: {
  candidatas: CandidataDuplicata[];
  aoEscolher: (candidata: CandidataDuplicata) => void;
}) {
  const cores = useTheme();
  return (
    <View style={styles.lista}>
      {candidatas.map((c) => (
        <Pressable
          key={c.id}
          accessibilityRole="button"
          accessibilityLabel={`${t.eEsta}: ${c.nome}`}
          onPress={() => aoEscolher(c)}
          style={({ pressed }) => [
            styles.candidata,
            { backgroundColor: cores.backgroundElement, opacity: pressed ? 0.8 : 1 },
          ]}>
          {c.miniatura ? (
            <Miniatura
              foto={c.miniatura}
              tamanho={64}
              rotulo={c.nome}
              aoTocar={() => aoEscolher(c)}
            />
          ) : (
            <View style={[styles.semFoto, { backgroundColor: cores.backgroundSelected }]}>
              <ThemedText type="small" themeColor="textSecondary">
                {t.semFoto}
              </ThemedText>
            </View>
          )}
          <ThemedText type="smallBold" style={styles.nome}>
            {c.nome}
          </ThemedText>
          <ThemedText type="smallBold" style={{ color: cores.primary }}>
            {t.eEsta}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  lista: {
    gap: Spacing.two,
  },
  candidata: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.two,
    borderRadius: Spacing.three,
  },
  semFoto: {
    width: 64,
    height: 64,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nome: {
    flex: 1,
  },
});
