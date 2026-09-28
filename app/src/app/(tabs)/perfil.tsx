import { useRouter } from 'expo-router';
import { Alert, Linking, StyleSheet, View } from 'react-native';

import { useContagens } from '@/api/casinhas';
import { useSessao } from '@/auth/sessao';
import { Botao } from '@/components/botao';
import { Logo } from '@/components/logo';
import { TelaFormulario } from '@/components/tela-formulario';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { EMAIL_CONTATO, URL_PRIVACIDADE, URL_TERMOS } from '@/domain/termos';
import { textos } from '@/i18n/pt-BR';

const t = textos.perfil;

/** Aparecem quando o site legal existir (T0.8, `EXPO_PUBLIC_SITE_URL`). */
const LINKS = [
  { titulo: t.privacidade, url: URL_PRIVACIDADE },
  { titulo: t.termos, url: URL_TERMOS },
].flatMap(({ titulo, url }) => (url ? [{ titulo, url }] : []));

/** LGPD, direito de acesso (RF05.4): no MVP, pedido por e-mail atendido manualmente em até 15 dias. */
async function pedirMeusDados(apelido: string, email: string) {
  const url =
    `mailto:${EMAIL_CONTATO}?subject=${encodeURIComponent(t.assuntoDados)}` +
    `&body=${encodeURIComponent(t.corpoDados(apelido, email))}`;
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(t.semEmail);
  }
}

export default function PerfilScreen() {
  const { me, sair } = useSessao();
  const router = useRouter();
  const { data: contagens } = useContagens();
  // As abas só abrem com a sessão completa (ver src/app/_layout.tsx).
  if (!me?.perfil) return null;
  const { apelido, nivel } = me.perfil;
  const { email } = me;

  return (
    <TelaFormulario>
      <Logo tamanho={120} />
      <View style={styles.cabecalho}>
        <ThemedText type="subtitle">{apelido}</ThemedText>
        <ThemedText themeColor="textSecondary">{email}</ThemedText>
        <ThemedText>{t.nivel[nivel]}</ThemedText>
        {contagens && (
          <ThemedText type="small" themeColor="textSecondary">
            {t.contagens(
              contagens.contribuicoes,
              contagens.atendimentos,
              contagens.casinhasAdotadas,
            )}
          </ThemedText>
        )}
      </View>

      <View style={styles.links}>
        {LINKS.map(({ titulo, url }) => (
          <Botao key={url} titulo={titulo} variante="texto" onPress={() => Linking.openURL(url)} />
        ))}
        {EMAIL_CONTATO && (
          <Botao
            titulo={t.meusDados}
            variante="texto"
            onPress={() => pedirMeusDados(apelido, email)}
          />
        )}
      </View>

      <Botao titulo={t.sair} variante="secundario" onPress={sair} />
      <Botao titulo={t.excluir} variante="texto" onPress={() => router.push('/excluir-conta')} />
    </TelaFormulario>
  );
}

const styles = StyleSheet.create({
  cabecalho: {
    gap: Spacing.one,
  },
  links: {
    alignItems: 'flex-start',
  },
});
