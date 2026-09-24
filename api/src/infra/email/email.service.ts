import { Injectable, Logger } from '@nestjs/common';

export interface Email {
  para: string;
  assunto: string;
  texto: string;
  html: string;
}

/** Porta de envio de e-mail. A implementação é escolhida por EMAIL_DRIVER (ver email.module.ts). */
export abstract class EmailService {
  abstract enviar(email: Email): Promise<void>;
}

/** Desenvolvimento: não envia nada, só mostra o conteúdo no log. */
@Injectable()
export class EmailConsole extends EmailService {
  private readonly logger = new Logger('Email');

  async enviar(email: Email): Promise<void> {
    this.logger.log(`Para ${email.para} — ${email.assunto}\n${email.texto}`);
  }
}

/** Testes: guarda os e-mails para o teste ler (ex.: o código de login). */
@Injectable()
export class EmailMemoria extends EmailService {
  readonly enviados: Email[] = [];

  async enviar(email: Email): Promise<void> {
    this.enviados.push(email);
  }

  ultimoPara(para: string): Email | undefined {
    return this.enviados.findLast((email) => email.para === para);
  }
}

/** Produção: API HTTP do Resend (https://resend.com/docs/api-reference/emails/send-email). */
export class EmailResend extends EmailService {
  constructor(
    private readonly apiKey: string,
    private readonly remetente: string,
  ) {
    super();
  }

  async enviar(email: Email): Promise<void> {
    const resposta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: this.remetente,
        to: [email.para],
        subject: email.assunto,
        text: email.texto,
        html: email.html,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!resposta.ok) {
      throw new Error(`Resend respondeu ${resposta.status}: ${await resposta.text()}`);
    }
  }
}
