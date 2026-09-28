import { Injectable } from '@nestjs/common';

import type { Ponto } from '../../../../shared/domain/geo.js';
import { PrismaTransacional } from '../../../../shared/infra/prisma/prisma-transacional.js';
import type { LocalizacaoRepository } from '../../domain/repositories/localizacao.repository.js';

@Injectable()
export class PrismaLocalizacaoRepository implements LocalizacaoRepository {
  constructor(private readonly db: PrismaTransacional) {}

  async exatas(casinhaIds: string[]) {
    if (casinhaIds.length === 0) return new Map<string, Ponto>();
    const linhas = await this.db.cliente().casinhaLocalizacao.findMany({
      where: { casinhaId: { in: casinhaIds } },
      select: { casinhaId: true, lat: true, lng: true },
    });
    return new Map(linhas.map((l) => [l.casinhaId, { lat: l.lat, lng: l.lng }]));
  }

  async adotadasPor(usuarioId: string, casinhaIds: string[]) {
    const linhas = await this.db.cliente().adocao.findMany({
      where: { usuarioId, ativa: true, casinhaId: { in: casinhaIds } },
      select: { casinhaId: true },
    });
    return new Set(linhas.map((l) => l.casinhaId));
  }

  async vistasNoDia(usuarioId: string, dia: Date, casinhaIds: string[]) {
    const linhas = await this.db.cliente().acessoLocalizacao.findMany({
      where: { usuarioId, dia, casinhaId: { in: casinhaIds } },
      select: { casinhaId: true },
    });
    return new Set(linhas.map((l) => l.casinhaId));
  }

  async travarUsuario(usuarioId: string) {
    await this.db.cliente()
      .$queryRaw`SELECT 1 FROM perfis WHERE id = ${usuarioId}::uuid FOR UPDATE`;
  }

  contarVistasNoDia(usuarioId: string, dia: Date) {
    return this.db.cliente().acessoLocalizacao.count({ where: { usuarioId, dia } });
  }

  async registrarVista(usuarioId: string, casinhaId: string, dia: Date) {
    await this.db.cliente().acessoLocalizacao.create({ data: { usuarioId, casinhaId, dia } });
  }

  async exatasNaCaixa(ponto: Ponto, graus: number) {
    const linhas = await this.db.cliente().casinhaLocalizacao.findMany({
      where: {
        lat: { gte: ponto.lat - graus, lte: ponto.lat + graus },
        lng: { gte: ponto.lng - graus, lte: ponto.lng + graus },
        casinha: { situacao: { not: 'inativa' }, moderacao: 'visivel' },
      },
      select: { casinhaId: true, lat: true, lng: true },
      take: 50,
    });
    return linhas.map((l) => ({ casinhaId: l.casinhaId, ponto: { lat: l.lat, lng: l.lng } }));
  }

  async criarExata(casinhaId: string, exata: Ponto, precisaoM: number) {
    await this.db.cliente().casinhaLocalizacao.create({
      data: { casinhaId, lat: exata.lat, lng: exata.lng, precisaoM },
    });
  }

  async candidatosProximos(graus: number, limite: number) {
    // Na longitude o grau encolhe com a latitude: folga de 1,5× (vale até ~45°, o Brasil todo).
    const linhas = await this.db.cliente().$queryRaw<
      { a: string; b: string; alat: number; alng: number; blat: number; blng: number }[]
    >`
      SELECT a.casinha_id AS a, b.casinha_id AS b, a.lat AS alat, a.lng AS alng, b.lat AS blat, b.lng AS blng
      FROM casinhas_localizacao a
      JOIN casinhas_localizacao b
        ON a.casinha_id < b.casinha_id
       AND b.lat BETWEEN a.lat - ${graus} AND a.lat + ${graus}
       AND b.lng BETWEEN a.lng - ${graus * 1.5} AND a.lng + ${graus * 1.5}
      JOIN casinhas ca ON ca.id = a.casinha_id AND ca.situacao <> 'inativa'
      JOIN casinhas cb ON cb.id = b.casinha_id AND cb.situacao <> 'inativa'
      LIMIT ${limite}`;
    return linhas.map((l) => ({
      a: l.a,
      b: l.b,
      pontoA: { lat: l.alat, lng: l.alng },
      pontoB: { lat: l.blat, lng: l.blng },
    }));
  }
}
