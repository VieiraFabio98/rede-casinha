import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useTheme } from '@/hooks/use-theme';
import { textos } from '@/i18n/pt-BR';

export default function TabsLayout() {
  const colors = useTheme();

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{textos.abas.mapa}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="map" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="minhas">
        <NativeTabs.Trigger.Label>{textos.abas.minhas}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="pets" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="perfil">
        <NativeTabs.Trigger.Label>{textos.abas.perfil}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
