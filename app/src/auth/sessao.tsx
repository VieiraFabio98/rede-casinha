import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { api, ErroApi, ligarSessao } from '@/api/cliente';
import { apagarCache } from '@/api/consultas';
import { apagarFilaDoUsuario } from '@/offline/outbox/fila';
import type { Me, Tokens } from '@/api/tipos';
import { VERSAO_TERMOS } from '@/domain/termos';
import { textos } from '@/i18n/pt-BR';
import { apagarSessao, lerSessao, salvarMe, salvarTokens } from './armazenamento';

GoogleSignin.configure({ webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID });

export type EstadoSessao = 'carregando' | 'visitante' | 'precisaCadastro' | 'logado';

interface ContextoSessao {
  estado: EstadoSessao;
  me: Me | null;
  /** Resolve `false` se o usuário cancelou a tela do Google. */
  entrarComGoogle: () => Promise<boolean>;
  pedirCodigo: (email: string) => Promise<void>;
  entrarComCodigo: (email: string, codigo: string) => Promise<void>;
  entrarComSenha: (email: string, senha: string) => Promise<void>;
  concluirCadastro: (apelido: string) => Promise<void>;
  sair: () => Promise<void>;
  /** Exclui a conta de vez (RN07) e limpa tudo do aparelho. Precisa de internet. */
  excluirConta: () => Promise<void>;
}

const Contexto = createContext<ContextoSessao | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoSessao>('carregando');
  const [me, setMe] = useState<Me | null>(null);
  const acesso = useRef<string | null>(null);
  const refresh = useRef<string | null>(null);
  /** Uma renovação por vez: o refresh é rotativo e usar o mesmo duas vezes derruba a sessão. */
  const renovando = useRef<Promise<string | null> | null>(null);

  const limpar = useCallback(async () => {
    acesso.current = null;
    refresh.current = null;
    setMe(null);
    setEstado('visitante');
    await Promise.all([apagarSessao(), apagarCache()]);
  }, []);

  const aplicarTokens = useCallback(async (tokens: Tokens) => {
    acesso.current = tokens.acesso;
    refresh.current = tokens.refresh;
    await salvarTokens(tokens.acesso, tokens.refresh);
  }, []);

  const carregarMe = useCallback(async () => {
    const dados = await api<Me>('/me');
    setMe(dados);
    setEstado(dados.perfil ? 'logado' : 'precisaCadastro');
    await salvarMe(dados);
  }, []);

  const renovar = useCallback((): Promise<string | null> => {
    if (!refresh.current) return Promise.resolve(null);
    renovando.current ??= (async () => {
      try {
        const tokens = await api<Tokens>('/auth/renovar', {
          metodo: 'POST',
          corpo: { refresh: refresh.current },
          autenticado: false,
        });
        await aplicarTokens(tokens);
        return tokens.acesso;
      } catch (erro) {
        // Sem internet: mantém a sessão para tentar de novo depois.
        if (erro instanceof ErroApi && erro.semConexao) return null;
        await limpar();
        return null;
      } finally {
        renovando.current = null;
      }
    })();
    return renovando.current;
  }, [aplicarTokens, limpar]);

  useEffect(() => {
    ligarSessao({ obterAcesso: () => acesso.current, renovar });
  }, [renovar]);

  // Ao abrir o app: restaura a sessão salva. Sem internet, usa o último `me` conhecido.
  useEffect(() => {
    (async () => {
      const salva = await lerSessao();
      if (!salva.refresh) {
        setEstado('visitante');
        return;
      }
      acesso.current = salva.acesso;
      refresh.current = salva.refresh;
      try {
        await carregarMe();
      } catch (erro) {
        if (erro instanceof ErroApi && erro.semConexao && salva.me) {
          setMe(salva.me);
          setEstado(salva.me.perfil ? 'logado' : 'precisaCadastro');
        } else {
          await limpar();
        }
      }
    })();
  }, [carregarMe, limpar]);

  const entrar = useCallback(
    async (caminho: string, corpo: object) => {
      const tokens = await api<Tokens>(caminho, { metodo: 'POST', corpo, autenticado: false });
      await aplicarTokens(tokens);
      await carregarMe();
    },
    [aplicarTokens, carregarMe],
  );

  const valor = useMemo<ContextoSessao>(
    () => ({
      estado,
      me,
      entrarComGoogle: async () => {
        try {
          await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
          const resposta = await GoogleSignin.signIn();
          if (!isSuccessResponse(resposta)) return false;
          if (!resposta.data.idToken) throw new Error('sem idToken');
          await entrar('/auth/google', { idToken: resposta.data.idToken });
          return true;
        } catch (erro) {
          if (erro instanceof ErroApi) throw erro;
          if (isErrorWithCode(erro) && erro.code === statusCodes.SIGN_IN_CANCELLED) return false;
          if (isErrorWithCode(erro) && erro.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
            throw new Error(textos.login.semPlayServices);
          }
          throw new Error(textos.login.erroGoogle);
        }
      },
      pedirCodigo: async (email) => {
        await api('/auth/codigo', { metodo: 'POST', corpo: { email }, autenticado: false });
      },
      entrarComCodigo: (email, codigo) => entrar('/auth/codigo/verificar', { email, codigo }),
      entrarComSenha: (email, senha) => entrar('/auth/senha', { email, senha }),
      concluirCadastro: async (apelido) => {
        await api('/me/cadastro', {
          metodo: 'POST',
          corpo: { apelido, maiorDeIdade: true, termosVersao: VERSAO_TERMOS },
        });
        await carregarMe();
      },
      sair: async () => {
        const refreshAtual = refresh.current;
        await limpar();
        // Melhor esforço: se falhar (sem internet), a sessão expira sozinha no servidor.
        if (refreshAtual) {
          api('/auth/sair', {
            metodo: 'POST',
            corpo: { refresh: refreshAtual },
            autenticado: false,
          }).catch(() => undefined);
        }
        GoogleSignin.signOut().catch(() => undefined);
      },
      excluirConta: async () => {
        await api('/me', { metodo: 'DELETE' });
        // A conta não existe mais: nada a revogar no servidor (as sessões já foram apagadas).
        const usuarioId = me?.id;
        await limpar();
        if (usuarioId) await apagarFilaDoUsuario(usuarioId);
        GoogleSignin.signOut().catch(() => undefined);
      },
    }),
    [estado, me, entrar, carregarMe, limpar],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSessao(): ContextoSessao {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useSessao precisa estar dentro de <AuthProvider>');
  return contexto;
}
