import { VerificarSaudeUseCase } from './verificar-saude.use-case.js';

describe('VerificarSaudeUseCase', () => {
  it('responde ok quando o banco responde', async () => {
    const useCase = new VerificarSaudeUseCase({ responde: async () => true });
    await expect(useCase.executar()).resolves.toEqual({ ok: true, banco: 'ok' });
  });

  it('responde erro quando o banco falha', async () => {
    const useCase = new VerificarSaudeUseCase({ responde: async () => false });
    await expect(useCase.executar()).resolves.toEqual({ ok: false, banco: 'erro' });
  });
});
