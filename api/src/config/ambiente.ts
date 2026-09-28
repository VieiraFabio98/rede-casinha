import { z } from 'zod';

const segredo = z.string().min(32, 'use pelo menos 32 caracteres aleatórios');
const booleano = z
  .enum(['true', 'false'])
  .default('false')
  .transform((valor) => valor === 'true');

/** Variáveis de ambiente da API. A aplicação não sobe se alguma estiver inválida. */
export const esquemaAmbiente = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    /** `true` atrás do Caddy em produção, para o rate limit enxergar o IP real. */
    CONFIAR_PROXY: booleano,

    /** Assina os JWT de acesso. */
    JWT_SEGREDO: segredo,
    /** HMAC dos códigos por e-mail e das URLs assinadas de fotos. */
    HMAC_SEGREDO: segredo,
    ACESSO_MINUTOS: z.coerce.number().int().positive().default(15),
    REFRESH_DIAS: z.coerce.number().int().positive().default(60),

    /** ID do cliente OAuth "Aplicativo da Web": audience do ID token do Google. */
    GOOGLE_WEB_CLIENT_ID: z.string().endsWith('.apps.googleusercontent.com'),

    /** `console` só mostra o e-mail no log; `memoria` é usado pelos testes; `resend` envia de verdade. */
    EMAIL_DRIVER: z.enum(['console', 'memoria', 'resend']).default('console'),
    EMAIL_REMETENTE: z.string().default('Rede Casinha <onboarding@resend.dev>'),
    RESEND_API_KEY: z.string().optional(),

    /** Onde ficam os arquivos das fotos: `disco` (pasta local), `s3` (AWS S3 ou compatível), `memoria` (testes). */
    ARMAZENAMENTO_DRIVER: z.enum(['disco', 's3', 'memoria']).default('disco'),
    /** Pasta do driver `disco`. */
    ARMAZENAMENTO_PASTA: z.string().default('./armazenamento'),
    S3_BUCKET: z.string().optional(),
    AWS_REGION: z.string().optional(),
    /** Só para serviços compatíveis com S3 (ex.: Cloudflare R2). Vazio = AWS. */
    S3_ENDPOINT: z.url().optional(),
    // Credenciais do S3: AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY, lidas direto pelo SDK.
  })
  .superRefine((ambiente, ctx) => {
    if (ambiente.EMAIL_DRIVER === 'resend' && !ambiente.RESEND_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['RESEND_API_KEY'],
        message: 'obrigatória com EMAIL_DRIVER=resend',
      });
    }
    if (ambiente.NODE_ENV === 'production' && ambiente.EMAIL_DRIVER !== 'resend') {
      ctx.addIssue({ code: 'custom', path: ['EMAIL_DRIVER'], message: 'em produção use resend' });
    }
    if (ambiente.ARMAZENAMENTO_DRIVER === 's3') {
      for (const chave of ['S3_BUCKET', 'AWS_REGION'] as const) {
        if (!ambiente[chave]) {
          ctx.addIssue({
            code: 'custom',
            path: [chave],
            message: 'obrigatória com ARMAZENAMENTO_DRIVER=s3',
          });
        }
      }
    }
    if (ambiente.NODE_ENV === 'production' && ambiente.ARMAZENAMENTO_DRIVER === 'memoria') {
      ctx.addIssue({
        code: 'custom',
        path: ['ARMAZENAMENTO_DRIVER'],
        message: 'em produção use disco ou s3',
      });
    }
  });

export type Ambiente = z.infer<typeof esquemaAmbiente>;
