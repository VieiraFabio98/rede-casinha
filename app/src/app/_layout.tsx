import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AuthProvider, useSessao } from '@/auth/sessao';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <Navegacao />
      </AuthProvider>
    </ThemeProvider>
  );
}

function Navegacao() {
  const { estado } = useSessao();

  // A splash fica até a sessão salva ser restaurada.
  useEffect(() => {
    if (estado !== 'carregando') SplashScreen.hideAsync();
  }, [estado]);

  if (estado === 'carregando') return null;

  const precisaCadastro = estado === 'precisaCadastro';
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Enquanto o cadastro não for concluído, só a tela de cadastro fica acessível. */}
      <Stack.Protected guard={!precisaCadastro}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" options={{ presentation: 'modal' }} />
      </Stack.Protected>
      <Stack.Protected guard={precisaCadastro}>
        <Stack.Screen name="cadastro" />
      </Stack.Protected>
    </Stack>
  );
}
