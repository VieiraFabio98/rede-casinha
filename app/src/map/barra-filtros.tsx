import { Pressable, ScrollView, StyleSheet } from 'react-native';

import type { TipoNecessidade } from '@/api/tipos';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { TIPOS_NECESSIDADE } from '@/domain/status';
import { useTheme } from '@/hooks/use-theme';
import { textos } from '@/i18n/pt-BR';

import type { Filtros } from './filtros';

const t = textos.mapa;

function Chip({
  rotulo,
  ativo,
  dica,
  aoTocar,
}: {
  rotulo: string;
  ativo: boolean;
  dica?: string;
  aoTocar: () => void;
}) {
  const cores = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: ativo }}
      accessibilityHint={dica}
      hitSlop={{ top: Spacing.one, bottom: Spacing.one }}
      onPress={aoTocar}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: ativo ? cores.primary : cores.background,
          borderColor: ativo ? cores.primary : cores.backgroundSelected,
          opacity: pressed ? 0.8 : 1,
        },
      ]}>
      <ThemedText type="smallBold" style={{ color: ativo ? cores.background : cores.text }}>
        {rotulo}
      </ThemedText>
    </Pressable>
  );
}

/** Legenda + filtros "Só urgentes" e "Por tipo" (RF01.5), roláveis na horizontal. */
export function BarraFiltros({
  filtros,
  aoMudar,
  legendaAberta,
  aoAlternarLegenda,
}: {
  filtros: Filtros;
  aoMudar: (filtros: Filtros) => void;
  legendaAberta: boolean;
  aoAlternarLegenda: () => void;
}) {
  const alternarTipo = (tipo: TipoNecessidade) =>
    aoMudar({
      ...filtros,
      tipos: filtros.tipos.includes(tipo)
        ? filtros.tipos.filter((x) => x !== tipo)
        : [...filtros.tipos, tipo],
    });

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.barra}>
      <Chip rotulo={t.legenda} ativo={legendaAberta} aoTocar={aoAlternarLegenda} />
      <Chip
        rotulo={t.soUrgentes}
        ativo={filtros.soUrgentes}
        aoTocar={() => aoMudar({ ...filtros, soUrgentes: !filtros.soUrgentes })}
      />
      {TIPOS_NECESSIDADE.map((tipo) => {
        const ativo = filtros.tipos.includes(tipo);
        const nome = t.necessidades[tipo];
        return (
          <Chip
            key={tipo}
            rotulo={nome}
            ativo={ativo}
            dica={t.filtroTipo(nome.toLowerCase(), ativo)}
            aoTocar={() => alternarTipo(tipo)}
          />
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  barra: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  chip: {
    minHeight: 40,
    paddingHorizontal: Spacing.three,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    elevation: 3,
  },
});
