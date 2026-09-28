import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { urlDaFoto } from '@/api/cliente';
import type { FotoUrls } from '@/api/tipos';
import { Botao } from '@/components/botao';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { textos } from '@/i18n/pt-BR';

const t = textos.fotos;

/**
 * Fonte da imagem. A URL assinada muda a cada 30 min; a `cacheKey` (id da foto, que nunca muda
 * de conteúdo) deixa o cache em disco reaproveitar a imagem mesmo assim.
 */
const fonte = (foto: FotoUrls, variante: 'foto' | 'miniatura') => ({
  uri: urlDaFoto(variante === 'foto' ? foto.url : foto.urlMiniatura),
  cacheKey: variante === 'foto' ? foto.id : `${foto.id}_t`,
});

/** Foto em tela cheia, sobre fundo escuro. */
export function FotoAmpliada({ foto, aoFechar }: { foto: FotoUrls | null; aoFechar: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={!!foto} animationType="fade" onRequestClose={aoFechar} statusBarTranslucent>
      <View style={[styles.ampliada, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {foto && (
          <Image
            source={fonte(foto, 'foto')}
            placeholder={fonte(foto, 'miniatura')}
            contentFit="contain"
            style={styles.imagemAmpliada}
          />
        )}
        <Botao titulo={t.fechar} variante="secundario" onPress={aoFechar} style={styles.fechar} />
      </View>
    </Modal>
  );
}

/** Miniatura que amplia ao tocar. */
export function Miniatura({
  foto,
  tamanho = 96,
  rotulo,
  aoTocar,
}: {
  foto: FotoUrls;
  tamanho?: number;
  rotulo: string;
  aoTocar: () => void;
}) {
  const cores = useTheme();
  return (
    <Pressable accessibilityRole="imagebutton" accessibilityLabel={rotulo} onPress={aoTocar}>
      <Image
        source={fonte(foto, 'miniatura')}
        contentFit="cover"
        transition={150}
        style={[
          styles.miniatura,
          { width: tamanho, height: tamanho, backgroundColor: cores.backgroundElement },
        ]}
      />
    </Pressable>
  );
}

/**
 * Fotos em linha, com o botão de adicionar para quem pode. Com `aoRemover` (fotos ainda no
 * celular, no cadastro), cada foto ganha um botão de remover.
 */
export function Galeria({
  fotos,
  podeAdicionar,
  preparando,
  aoAdicionar,
  aoRemover,
}: {
  fotos: FotoUrls[];
  podeAdicionar: boolean;
  preparando: boolean;
  aoAdicionar: () => void;
  aoRemover?: (id: string) => void;
}) {
  const cores = useTheme();
  const [ampliada, setAmpliada] = useState<FotoUrls | null>(null);

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.linha}>
        {fotos.map((foto, i) => (
          <View key={foto.id}>
            <Miniatura
              foto={foto}
              rotulo={t.ampliar(i + 1, fotos.length)}
              aoTocar={() => setAmpliada(foto)}
            />
            {aoRemover && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t.remover(i + 1)}
                hitSlop={Spacing.two}
                onPress={() => aoRemover(foto.id)}
                style={[styles.remover, { backgroundColor: cores.background }]}>
                <ThemedText type="smallBold">✕</ThemedText>
              </Pressable>
            )}
          </View>
        ))}
        {podeAdicionar && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.adicionar}
            accessibilityState={{ busy: preparando, disabled: preparando }}
            disabled={preparando}
            onPress={aoAdicionar}
            style={[styles.adicionar, { borderColor: cores.primary }]}>
            {preparando ? (
              <ActivityIndicator color={cores.primary} />
            ) : (
              <ThemedText
                type="smallBold"
                style={[styles.textoAdicionar, { color: cores.primary }]}>
                {`+\n${t.adicionar}`}
              </ThemedText>
            )}
          </Pressable>
        )}
      </ScrollView>
      {fotos.length === 0 && !podeAdicionar && (
        <ThemedText themeColor="textSecondary">{t.semFotos}</ThemedText>
      )}
      <FotoAmpliada foto={ampliada} aoFechar={() => setAmpliada(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  linha: {
    gap: Spacing.two,
  },
  miniatura: {
    borderRadius: Spacing.two,
  },
  adicionar: {
    width: 96,
    height: 96,
    borderRadius: Spacing.two,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.one,
  },
  remover: {
    position: 'absolute',
    top: Spacing.one,
    right: Spacing.one,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  textoAdicionar: {
    textAlign: 'center',
  },
  ampliada: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
  },
  imagemAmpliada: {
    flex: 1,
  },
  fechar: {
    margin: Spacing.three,
  },
});
