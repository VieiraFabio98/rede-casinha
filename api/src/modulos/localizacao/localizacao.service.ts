import { Injectable } from '@nestjs/common';

import { distanciaM, type Ponto } from '../../comum/geo.js';
import { diaAtual } from '../../comum/tempo.js';
import type { Perfil } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { acessoAExata, LIMITE_EXATAS_POR_DIA } from './acesso-exata.js';

/** Distância máxima para uma ação contar como feita no local (adoção, reporte, atendimento). */
export const RAIO_PROXIMIDADE_M = 100;

/** O mínimo da casinha para decidir o acesso à exata. */
export interface CasinhaRef {
  id: string;
  criadaPorId: string | null;
}

/**
 * Único ponto da API que lê `casinhas_localizacao` (regra coberta por src/arquitetura.spec.ts).
 * Nenhum método devolve distância entre o usuário e a casinha.
 */
@Injectable()
export class LocalizacaoService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Exatas que o perfil pode ver numa lista (mapa, "minhas casinhas"), por id de casinha.
   * Não gasta a cota do verificado: ele vê na lista só as que já abriu hoje no detalhe.
   * Assim, arrastar o mapa não revela exatas em massa.
   */
  async exatasParaLista(perfil: Perfil, casinhas: CasinhaRef[]): Promise<Map<string, Ponto>> {
    if (casinhas.length === 0) return new Map();
    const ids = casinhas.map((c) => c.id);

    const [adotadas, vistasHoje] = await Promise.all([
      this.prisma.adocao.findMany({
        where: { usuarioId: perfil.id, ativa: true, casinhaId: { in: ids } },
        select: { casinhaId: true },
      }),
      perfil.nivel === 'verificado'
        ? this.prisma.acessoLocalizacao.findMany({
            where: { usuarioId: perfil.id, dia: diaAtual(), casinhaId: { in: ids } },
            select: { casinhaId: true },
          })
        : [],
    ]);
    const adotadasIds = new Set(adotadas.map((a) => a.casinhaId));
    const vistasIds = new Set(vistasHoje.map((a) => a.casinhaId));

    const permitidas = casinhas
      .filter((c) => {
        const acesso = acessoAExata({
          nivel: perfil.nivel,
          souCriador: c.criadaPorId === perfil.id,
          souAdotante: adotadasIds.has(c.id),
        });
        return acesso === 'livre' || (acesso === 'cota_diaria' && vistasIds.has(c.id));
      })
      .map((c) => c.id);
    return this.lerExatas(permitidas);
  }

  /**
   * Exata para o detalhe de uma casinha, ou `null` se o perfil só pode ver a pública.
   * Para o verificado, gasta 1 da cota diária (casinhas distintas) e registra o acesso.
   */
  async exataParaDetalhe(perfil: Perfil, casinha: CasinhaRef): Promise<Ponto | null> {
    const souAdotante =
      (await this.prisma.adocao.count({
        where: { usuarioId: perfil.id, casinhaId: casinha.id, ativa: true },
      })) > 0;
    const acesso = acessoAExata({
      nivel: perfil.nivel,
      souCriador: casinha.criadaPorId === perfil.id,
      souAdotante,
    });
    if (acesso === 'negado') return null;
    if (acesso === 'cota_diaria' && !(await this.consumirCota(perfil.id, casinha.id))) return null;
    return (await this.lerExatas([casinha.id])).get(casinha.id) ?? null;
  }

  /**
   * A pessoa está a até `raioM` do local exato? Usado para `validado_local` (RN05).
   * A posição do usuário não é guardada, e só o booleano sai daqui (nunca a distância).
   * `null` se o app não mandou posição.
   */
  async estaPerto(casinhaId: string, posicao: Ponto | null, raioM = RAIO_PROXIMIDADE_M) {
    if (!posicao) return null;
    const exata = (await this.lerExatas([casinhaId])).get(casinhaId);
    return exata ? distanciaM(exata, posicao) <= raioM : null;
  }

  /** `true` se o acesso cabe na cota do dia (rever uma casinha já vista hoje não gasta cota). */
  private consumirCota(usuarioId: string, casinhaId: string): Promise<boolean> {
    const dia = diaAtual();
    return this.prisma.$transaction(async (tx) => {
      // Trava o perfil: sem isso, pedidos simultâneos passariam do limite.
      await tx.$queryRaw`SELECT 1 FROM perfis WHERE id = ${usuarioId}::uuid FOR UPDATE`;
      const jaViu = await tx.acessoLocalizacao.findUnique({
        where: { usuarioId_casinhaId_dia: { usuarioId, casinhaId, dia } },
      });
      if (jaViu) return true;
      if (
        (await tx.acessoLocalizacao.count({ where: { usuarioId, dia } })) >= LIMITE_EXATAS_POR_DIA
      ) {
        return false;
      }
      await tx.acessoLocalizacao.create({ data: { usuarioId, casinhaId, dia } });
      return true;
    });
  }

  private async lerExatas(casinhaIds: string[]): Promise<Map<string, Ponto>> {
    if (casinhaIds.length === 0) return new Map();
    const exatas = await this.prisma.casinhaLocalizacao.findMany({
      where: { casinhaId: { in: casinhaIds } },
      select: { casinhaId: true, lat: true, lng: true },
    });
    return new Map(exatas.map((e) => [e.casinhaId, { lat: e.lat, lng: e.lng }]));
  }
}
