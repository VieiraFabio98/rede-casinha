import type { Email } from './email.service.js';

/** E-mail com o código de login (pt-BR, texto simples + HTML mínimo). */
export function emailCodigoLogin(para: string, codigo: string, validadeMinutos: number): Email {
  const texto =
    `Seu código para entrar na Rede Casinha é: ${codigo}\n\n` +
    `Ele vale por ${validadeMinutos} minutos. Se você não pediu este código, ignore este e-mail.`;
  const html = `
<div style="font-family: sans-serif; font-size: 16px; color: #222">
  <p>Seu código para entrar na <strong>Rede Casinha</strong> é:</p>
  <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px">${codigo}</p>
  <p>Ele vale por ${validadeMinutos} minutos. Se você não pediu este código, ignore este e-mail.</p>
</div>`;
  return { para, assunto: `${codigo} é seu código da Rede Casinha`, texto, html };
}
