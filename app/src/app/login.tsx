import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { Botao } from '@/components/botao';
import { CampoTexto } from '@/components/campo-texto';
import { MensagemErro } from '@/components/mensagem-erro';
import { TelaFormulario } from '@/components/tela-formulario';
import { ThemedText } from '@/components/themed-text';
import { useSessao } from '@/auth/sessao';
import { textos } from '@/i18n/pt-BR';

type Etapa = 'inicio' | 'email' | 'codigo' | 'senha';
const ESPERA_REENVIO_S = 60;
const t = textos.login;

export default function LoginScreen() {
  const sessao = useSessao();
  const router = useRouter();
  const [etapa, setEtapa] = useState<Etapa>('inicio');
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [reenvioEm, setReenvioEm] = useState(0);

  useEffect(() => {
    if (reenvioEm <= 0) return;
    const id = setTimeout(() => setReenvioEm((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [reenvioEm]);

  // Logado: fecha o login. Cadastro pendente: as rotas protegidas levam à tela de cadastro.
  useEffect(() => {
    if (sessao.estado === 'logado' && router.canGoBack()) router.back();
  }, [sessao.estado, router]);

  async function executar(acao: () => Promise<void>) {
    setErro(null);
    setCarregando(true);
    try {
      await acao();
    } catch (e) {
      setErro(e instanceof Error ? e.message : t.erroGoogle);
    } finally {
      setCarregando(false);
    }
  }

  const enviarCodigo = () =>
    executar(async () => {
      await sessao.pedirCodigo(email.trim());
      setCodigo('');
      setEtapa('codigo');
      setReenvioEm(ESPERA_REENVIO_S);
    });

  return (
    <TelaFormulario>
      <ThemedText type="subtitle">{t.titulo}</ThemedText>

      {etapa === 'inicio' && (
        <>
          <ThemedText themeColor="textSecondary">{t.subtitulo}</ThemedText>
          <Botao
            titulo={t.google}
            carregando={carregando}
            onPress={() => executar(async () => void (await sessao.entrarComGoogle()))}
          />
          <Botao titulo={t.email} variante="secundario" onPress={() => setEtapa('email')} />
          <Botao titulo={t.outrasFormas} variante="texto" onPress={() => setEtapa('senha')} />
        </>
      )}

      {etapa === 'email' && (
        <>
          <CampoTexto
            rotulo={t.campoEmail}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            onSubmitEditing={enviarCodigo}
          />
          <Botao
            titulo={t.enviarCodigo}
            carregando={carregando}
            disabled={!email.includes('@')}
            onPress={enviarCodigo}
          />
          <Botao titulo={t.voltar} variante="texto" onPress={() => setEtapa('inicio')} />
        </>
      )}

      {etapa === 'codigo' && (
        <>
          <ThemedText>{t.codigoEnviado(email.trim())}</ThemedText>
          <CampoTexto
            rotulo={t.campoCodigo}
            value={codigo}
            onChangeText={(texto) => setCodigo(texto.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
            autoFocus
          />
          <Botao
            titulo={t.confirmar}
            carregando={carregando}
            disabled={codigo.length !== 6}
            onPress={() => executar(() => sessao.entrarComCodigo(email.trim(), codigo))}
          />
          <Botao
            titulo={reenvioEm > 0 ? t.reenviarEm(reenvioEm) : t.reenviar}
            variante="secundario"
            disabled={reenvioEm > 0 || carregando}
            onPress={enviarCodigo}
          />
          <Botao titulo={t.trocarEmail} variante="texto" onPress={() => setEtapa('email')} />
        </>
      )}

      {etapa === 'senha' && (
        <>
          <CampoTexto
            rotulo={t.campoEmail}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <CampoTexto rotulo={t.campoSenha} value={senha} onChangeText={setSenha} secureTextEntry />
          <Botao
            titulo={t.entrarComSenha}
            carregando={carregando}
            disabled={!email || !senha}
            onPress={() => executar(() => sessao.entrarComSenha(email.trim(), senha))}
          />
          <Botao titulo={t.voltar} variante="texto" onPress={() => setEtapa('inicio')} />
        </>
      )}

      <MensagemErro texto={erro} />
    </TelaFormulario>
  );
}
