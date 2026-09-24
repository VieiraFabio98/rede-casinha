# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
WORKDIR /app

# 1) Build: dependências completas + prisma generate (postinstall) + nest build
FROM base AS build
COPY package.json package-lock.json prisma7.config.ts ./
COPY prisma ./prisma
RUN npm ci
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

# 2) Só dependências de produção. Os scripts de instalação precisam rodar: eles baixam o
#    schema engine que o `prisma migrate deploy` usa (o usuário `node` não pode baixá-lo depois).
FROM base AS deps
COPY package.json package-lock.json prisma7.config.ts ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npm cache clean --force

# 3) Imagem final
FROM base AS producao
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json prisma7.config.ts ./
COPY prisma ./prisma
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -qO- http://localhost:3000/saude || exit 1
# Aplica as migrations pendentes antes de subir a API.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
