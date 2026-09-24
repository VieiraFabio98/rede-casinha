import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Switch, View } from 'react-native';

import { useSessao } from '@/auth/sessao';
import { Botao } from '@/components/botao';
import { CampoTexto } from '@/components/campo-texto';
import { MensagemErro } from '@/components/mensagem-erro';
import { TelaFormulario } from '@/components/tela-formulario';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { URL_PRIVACIDADE, URL_TERMOS } from '@/domain/termos';
import { textos } from '@/i18n/pt-BR';

const t = textos.cadastro;
/** Mesma regra da API (api/src/modulos/me/me.dto.ts). */
const APELIDO_VALIDO = /^(?!.*\d{8})[\p{L}\p{N} _.-]{3,30}$/u;

export default function CadastroScreen() {
  const sessao = useSessao();
  const [apelido, setApelido] = useState('');
  const [maiorDeIdade, setMaiorDeIdade] = useState(false);
  const [aceitaTermos, setAceitaTermos] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const apelidoOk = APELIDO_VALIDO.test(apelido.trim());

  async function concluir() {
    setErro(null);
    setCarregando(true);
    try {
      await sessao.concluirCadastro(apelido.trim());
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <TelaFormulario>
      <ThemedText type="subtitle">{t.titulo}</ThemedText>
      <ThemedText themeColor="textSecondary">{t.subtitulo}</ThemedText>

      <CampoTexto
        rotulo={t.campoApelido}
        dica={apelido && !apelidoOk ? t.apelidoInvalido : t.dicaApelido}
        value={apelido}
        onChangeText={setApelido}
        maxLength={30}
        autoCapitalize="words"
      />

      <Confirmacao texto={t.maiorDeIdade} valor={maiorDeIdade} aoMudar={setMaiorDeIdade} />
      <Confirmacao texto={t.aceitoTermos} valor={aceitaTermos} aoMudar={setAceitaTermos} />
      {URL_TERMOS && <LinkExterno titulo={t.verTermos} url={URL_TERMOS} />}
      {URL_PRIVACIDADE && <LinkExterno titulo={t.verPrivacidade} url={URL_PRIVACIDADE} />}

      <Botao
        titulo={t.concluir}
        carregando={carregando}
        disabled={!apelidoOk || !maiorDeIdade || !aceitaTermos}
        onPress={concluir}
      />
      <MensagemErro texto={erro} />
      <Botao titulo={t.sair} variante="texto" onPress={sessao.sair} />
    </TelaFormulario>
  );
}

function LinkExterno({ titulo, url }: { titulo: string; url: string }) {
  return <Botao titulo={titulo} variante="texto" onPress={() => Linking.openURL(url)} />;
}

function Confirmacao({
  texto,
  valor,
  aoMudar,
}: {
  texto: string;
  valor: boolean;
  aoMudar: (v: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: valor }}
      onPress={() => aoMudar(!valor)}
      style={styles.confirmacao}>
      <Switch value={valor} onValueChange={aoMudar} />
      <View style={styles.textoConfirmacao}>
        <ThemedText>{texto}</ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  confirmacao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 48,
  },
  textoConfirmacao: {
    flex: 1,
  },
});
