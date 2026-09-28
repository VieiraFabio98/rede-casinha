import { calcularStatus, prazoExpiracao } from './regras.js';

const agora = new Date('2026-09-25T12:00:00Z');
const horasAtras = (h: number) => new Date(agora.getTime() - h * 3_600_000);

describe('calcularStatus (RN01)', () => {
  it('necessidade urgente: urgente', () => {
    const abertas = [{ tipo: 'limpeza' as const, urgencia: 'urgente' as const, criadaEm: agora }];
    expect(calcularStatus(abertas, agora, agora)).toBe('urgente');
  });

  it.each(['agua', 'racao'] as const)('%s aberta há mais de 48 h: urgente', (tipo) => {
    const abertas = [{ tipo, urgencia: 'normal' as const, criadaEm: horasAtras(49) }];
    expect(calcularStatus(abertas, agora, agora)).toBe('urgente');
  });

  it('água aberta há 47 h: atenção', () => {
    const abertas = [
      { tipo: 'agua' as const, urgencia: 'normal' as const, criadaEm: horasAtras(47) },
    ];
    expect(calcularStatus(abertas, agora, agora)).toBe('atencao');
  });

  it('reforma aberta há 10 dias não vira urgente sozinha', () => {
    const abertas = [
      { tipo: 'reforma' as const, urgencia: 'normal' as const, criadaEm: horasAtras(240) },
    ];
    expect(calcularStatus(abertas, agora, agora)).toBe('atencao');
  });

  it('sem necessidades e atividade há até 7 dias: ok', () => {
    expect(calcularStatus([], horasAtras(7 * 24), agora)).toBe('ok');
  });

  it('sem necessidades e sem atividade há mais de 7 dias: sem notícias', () => {
    expect(calcularStatus([], horasAtras(7 * 24 + 1), agora)).toBe('sem_noticias');
  });
});

describe('prazoExpiracao (RN02)', () => {
  it.each([
    ['agua', 2],
    ['racao', 3],
    ['limpeza', 7],
    ['remedio_veterinario', 7],
    ['cobertas', 14],
    ['outro', 14],
    ['reforma', 30],
  ] as const)('%s expira em %i dias', (tipo, dias) => {
    expect(prazoExpiracao(tipo, agora).getTime() - agora.getTime()).toBe(dias * 86_400_000);
  });
});
