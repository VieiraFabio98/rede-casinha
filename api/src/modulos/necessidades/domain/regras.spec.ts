import { atendimentoValeParaStatus, horaDoCelular, podeContestar } from './regras.js';

const agora = new Date('2026-09-28T12:00:00Z');
const horasAtras = (h: number) => new Date(agora.getTime() - h * 3_600_000);

describe('regras de necessidades', () => {
  it('hora do celular no futuro vira a hora do servidor', () => {
    expect(horaDoCelular(new Date(agora.getTime() + 60_000), agora)).toEqual(agora);
    expect(horaDoCelular(horasAtras(2), agora)).toEqual(horasAtras(2));
    expect(horaDoCelular(undefined, agora)).toEqual(agora);
  });

  it('só atendimento de necessidade aberta muda o status (RN03)', () => {
    expect(atendimentoValeParaStatus('aberta')).toBe(true);
    for (const s of ['atendida', 'expirada', 'cancelada'] as const) {
      expect(atendimentoValeParaStatus(s)).toBe(false);
    }
  });

  it('contesta até 24 h depois do atendimento, e só atendida', () => {
    expect(podeContestar({ status: 'atendida', atendidaEm: horasAtras(24) }, agora)).toBe(true);
    expect(podeContestar({ status: 'atendida', atendidaEm: horasAtras(25) }, agora)).toBe(false);
    expect(podeContestar({ status: 'aberta', atendidaEm: null }, agora)).toBe(false);
  });
});
