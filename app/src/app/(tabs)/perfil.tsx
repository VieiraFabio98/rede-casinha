import { useRouter } from 'expo-router';

import { useSessao } from '@/auth/sessao';
import { Botao } from '@/components/botao';
import { TelaFormulario } from '@/components/tela-formulario';
import { ThemedText } from '@/components/themed-text';
import { textos } from '@/i18n/pt-BR';

const t = textos.perfil;

export default function PerfilScreen() {
  const { estado, me, sair } = useSessao();
  const router = useRouter();

  if (estado !== 'logado' || !me?.perfil) {
    return (
      <TelaFormulario>
        <ThemedText type="subtitle">{textos.abas.perfil}</ThemedText>
        <ThemedText themeColor="textSecondary">{t.visitante}</ThemedText>
        <Botao titulo={t.entrar} onPress={() => router.push('/login')} />
      </TelaFormulario>
    );
  }

  return (
    <TelaFormulario>
      <ThemedText type="subtitle">{me.perfil.apelido}</ThemedText>
      <ThemedText themeColor="textSecondary">{me.email}</ThemedText>
      <ThemedText>{t.nivel[me.perfil.nivel]}</ThemedText>
      <Botao titulo={t.sair} variante="secundario" onPress={sair} />
    </TelaFormulario>
  );
}
