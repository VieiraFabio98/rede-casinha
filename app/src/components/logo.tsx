import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

/** Logo do Rede Casinha, centralizado. O nome já faz parte da imagem. */
export function Logo({ tamanho = 180 }: { tamanho?: number }) {
  return (
    <Image
      source={require('@/assets/images/logo.png')}
      style={[styles.logo, { width: tamanho, height: tamanho }]}
      contentFit="contain"
      accessibilityLabel="Rede Casinha"
    />
  );
}

const styles = StyleSheet.create({
  logo: {
    alignSelf: 'center',
  },
});
