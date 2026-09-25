import type { ExpoConfig } from 'expo/config';

// APP_VARIANT=development gera um app separado (".dev"), que pode ser instalado
// ao lado da versão da loja no mesmo celular.
const IS_DEV = process.env.APP_VARIANT === 'development';

const config: ExpoConfig = {
  name: IS_DEV ? 'Rede Casinha (dev)' : 'Rede Casinha',
  slug: 'rede-casinha',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: IS_DEV ? 'redecasinha-dev' : 'redecasinha',
  userInterfaceStyle: 'automatic',
  android: {
    // Definitivo: não pode mudar depois do primeiro upload na Google Play.
    package: IS_DEV ? 'br.app.redecasinha.dev' : 'br.app.redecasinha',
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    '@maplibre/maplibre-react-native',
    // Só localização em primeiro plano (centralizar o mapa e, na T1.6, cadastrar casinha).
    'expo-location',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#208AEF',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
