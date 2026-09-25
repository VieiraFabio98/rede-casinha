import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { clienteConsultas, opcoesPersistencia } from '@/api/consultas';
import { AuthProvider, useSessao } from '@/auth/sessao';
import { textos } from '@/i18n/pt-BR';
import { useSincronizacaoDaFila } from '@/offline/outbox/use-fila';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <PersistQueryClientProvider client={clienteConsultas} persistOptions={opcoesPersistencia}>
        <AuthProvider>
          <Navegacao />
        </AuthProvider>
      </PersistQueryClientProvider>
    </ThemeProvider>
  );
}

function Navegacao() {
  const { estado, me } = useSessao();
  useSincronizacaoDaFila(estado === 'logado' && me ? me.id : null);

  // A splash fica até a sessão salva ser restaurada.
  useEffect(() => {
    if (estado !== 'carregando') SplashScreen.hideAsync();
  }, [estado]);

  if (estado === 'carregando') return null;

  // Todo o app exige login, inclusive o mapa (decisão D01 em docs/01-visao-geral.md).
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={estado === 'logado'}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="casinha/[id]" options={{ headerShown: true, title: '' }} />
        <Stack.Screen
          name="reportar/[casinhaId]"
          options={{ headerShown: true, presentation: 'modal' }}
        />
        <Stack.Screen name="contestar/[necessidadeId]" options={{ headerShown: true }} />
        <Stack.Screen
          name="pendencias"
          options={{ headerShown: true, title: textos.pendencias.titulo }}
        />
      </Stack.Protected>
      <Stack.Protected guard={estado === 'visitante'}>
        <Stack.Screen name="login" />
      </Stack.Protected>
      {/* Enquanto o cadastro não for concluído, só a tela de cadastro fica acessível. */}
      <Stack.Protected guard={estado === 'precisaCadastro'}>
        <Stack.Screen name="cadastro" />
      </Stack.Protected>
    </Stack>
  );
}
