import { useSessao } from '@/auth/sessao';
import { Botao } from '@/components/botao';
import { Logo } from '@/components/logo';
import { TelaFormulario } from '@/components/tela-formulario';
import { ThemedText } from '@/components/themed-text';
import { textos } from '@/i18n/pt-BR';

const t = textos.perfil;

export default function PerfilScreen() {
  const { me, sair } = useSessao();
  // As abas só abrem com a sessão completa (ver src/app/_layout.tsx).
  if (!me?.perfil) return null;

  return (
    <TelaFormulario>
      <Logo tamanho={140} />
      <ThemedText type="subtitle">{me.perfil.apelido}</ThemedText>
      <ThemedText themeColor="textSecondary">{me.email}</ThemedText>
      <ThemedText>{t.nivel[me.perfil.nivel]}</ThemedText>
      <Botao titulo={t.sair} variante="secundario" onPress={sair} />
    </TelaFormulario>
  );
}
