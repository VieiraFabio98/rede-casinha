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
    // Fotos pelo Photo Picker do sistema, sem permissão de galeria (RNF12): a Play pede
    // justificativa para estas e a chance de reprovação é alta.
    blockedPermissions: [
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_VIDEO',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ],
  },
  plugins: [
    'expo-router',
    '@maplibre/maplibre-react-native',
    // Só localização em primeiro plano (centralizar o mapa e, na T1.6, cadastrar casinha).
    'expo-location',
    // Câmera só no toque em "Tirar foto"; sem microfone (nada de vídeo).
    [
      'expo-image-picker',
      {
        cameraPermission: 'Para fotografar a casinha.',
        microphonePermission: false,
      },
    ],
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
