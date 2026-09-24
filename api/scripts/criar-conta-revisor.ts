/**
 * Cria (ou atualiza a senha de) a conta de demonstração do revisor da Google Play (T1.15).
 * É a única conta com senha; as credenciais vão em "Acesso ao app" no Play Console.
 *
 *   REVISOR_EMAIL=revisor@exemplo.com REVISOR_SENHA='...' npm run conta:revisor
 */
import 'dotenv/config';

import { hash } from '@node-rs/argon2';
import { PrismaPg } from '@prisma/adapter-pg';

import { normalizarApelido } from '../src/comum/texto.js';
import { VERSAO_TERMOS } from '../src/config/termos.js';
import { PrismaClient } from '../src/generated/prisma/client.js';

const email = process.env.REVISOR_EMAIL?.trim().toLowerCase();
const senha = process.env.REVISOR_SENHA;
if (!email || !senha || senha.length < 12) {
  throw new Error('Defina REVISOR_EMAIL e REVISOR_SENHA (mínimo de 12 caracteres).');
}

const APELIDO = 'Revisor_Play';
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
try {
  const agora = new Date();
  const senhaHash = await hash(senha);
  const usuario = await prisma.usuario.upsert({
    where: { email },
    create: { email, senhaHash, emailVerificadoEm: agora },
    update: { senhaHash },
  });
  await prisma.perfil.upsert({
    where: { id: usuario.id },
    create: {
      id: usuario.id,
      apelido: APELIDO,
      apelidoNormalizado: normalizarApelido(APELIDO),
      maiorDeIdadeEm: agora,
      termosVersao: VERSAO_TERMOS,
      termosAceitosEm: agora,
    },
    update: {},
  });
  console.log(`Conta do revisor pronta: ${email}`);
} finally {
  await prisma.$disconnect();
}
