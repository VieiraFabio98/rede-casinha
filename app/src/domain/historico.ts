import type { CasinhaDetalhe } from '@/api/tipos';
import { textos } from '@/i18n/pt-BR';

type Atividade = CasinhaDetalhe['atividades'][number];

const h = textos.historico;
const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

const meiaNoite = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** "há 3 h", "ontem", "há 5 dias" ou a data, para quem lê de relance. */
export function tempoRelativo(iso: string, agora: Date = new Date()): string {
  const instante = new Date(iso);
  const passou = agora.getTime() - instante.getTime();
  if (passou < MINUTO) return textos.tempo.agora;
  if (passou < HORA) return textos.tempo.minutos(Math.floor(passou / MINUTO));
  if (passou < DIA) return textos.tempo.horas(Math.floor(passou / HORA));
  // Dias de calendário (meia-noite local), não blocos de 24 h: "ontem" é ontem mesmo.
  const dias = Math.round((meiaNoite(agora) - meiaNoite(instante)) / DIA);
  if (dias <= 1) return textos.tempo.ontem;
  if (dias < 30) return textos.tempo.dias(dias);
  return instante.toLocaleDateString('pt-BR');
}

/** Frase humana da atividade: "Marta abasteceu ração". Expiração e moderação não têm autor. */
export function textoAtividade(a: Atividade): string {
  const tipo = a.necessidade ? textos.mapa.necessidades[a.necessidade].toLowerCase() : h.algo;

  if (a.tipo === 'expiracao') return h.expiracao(tipo);
  if (a.tipo === 'moderacao') return h.moderacao;

  const acao = (() => {
    switch (a.tipo) {
      case 'reporte':
        return h.reporte(tipo);
      case 'reconfirmacao':
        return h.reconfirmacao(tipo);
      case 'atendimento':
        if (a.necessidade === 'racao') return h.abasteceuRacao;
        if (a.necessidade === 'agua') return h.colocouAgua;
        return h.atendimento(tipo);
      case 'contestacao':
        return h.contestacao(tipo);
      default:
        return h[a.tipo];
    }
  })();
  return `${a.apelido ?? textos.casinha.usuarioRemovido} ${acao}`;
}
