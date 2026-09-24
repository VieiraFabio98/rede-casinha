-- CreateEnum
CREATE TYPE "nivel_acesso" AS ENUM ('colaborador', 'verificado', 'moderador', 'admin');

-- CreateEnum
CREATE TYPE "animais_atendidos" AS ENUM ('caes', 'gatos', 'ambos');

-- CreateEnum
CREATE TYPE "status_casinha" AS ENUM ('ok', 'atencao', 'urgente', 'sem_noticias');

-- CreateEnum
CREATE TYPE "situacao_casinha" AS ENUM ('ativa', 'em_revisao', 'inativa');

-- CreateEnum
CREATE TYPE "tipo_necessidade" AS ENUM ('racao', 'agua', 'reforma', 'cobertas', 'limpeza', 'remedio_veterinario', 'outro');

-- CreateEnum
CREATE TYPE "urgencia" AS ENUM ('normal', 'urgente');

-- CreateEnum
CREATE TYPE "status_necessidade" AS ENUM ('aberta', 'atendida', 'expirada', 'cancelada');

-- CreateEnum
CREATE TYPE "tipo_atividade" AS ENUM ('cadastro', 'reporte', 'reconfirmacao', 'atendimento', 'contestacao', 'check_in', 'edicao', 'adocao', 'fim_adocao', 'expiracao', 'desativacao_pedida', 'moderacao');

-- CreateEnum
CREATE TYPE "status_moderacao" AS ENUM ('visivel', 'oculto_auto', 'oculto_moderador');

-- CreateEnum
CREATE TYPE "alvo_denuncia" AS ENUM ('casinha', 'foto', 'necessidade', 'perfil');

-- CreateEnum
CREATE TYPE "motivo_denuncia" AS ENUM ('falsa', 'duplicada', 'ofensiva', 'expoe_pessoa', 'perigo_animais', 'outro');

-- CreateEnum
CREATE TYPE "status_denuncia" AS ENUM ('aberta', 'procedente', 'improcedente');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "google_sub" TEXT,
    "senha_hash" TEXT,
    "email_verificado_em" TIMESTAMPTZ,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessoes" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "refresh_hash" TEXT NOT NULL,
    "expira_em" TIMESTAMPTZ NOT NULL,
    "revogada_em" TIMESTAMPTZ,
    "substituida_por" UUID,
    "criada_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "codigos_email" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "codigo_hash" TEXT NOT NULL,
    "expira_em" TIMESTAMPTZ NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "usado_em" TIMESTAMPTZ,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "codigos_email_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perfis" (
    "id" UUID NOT NULL,
    "apelido" VARCHAR(30) NOT NULL,
    "apelido_normalizado" VARCHAR(30) NOT NULL,
    "nivel" "nivel_acesso" NOT NULL DEFAULT 'colaborador',
    "maior_de_idade_em" TIMESTAMPTZ NOT NULL,
    "termos_versao" VARCHAR(20) NOT NULL,
    "termos_aceitos_em" TIMESTAMPTZ NOT NULL,
    "bloqueado_ate" TIMESTAMPTZ,
    "verificado_por" UUID,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "perfis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "casinhas" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(60) NOT NULL,
    "descricao" VARCHAR(500),
    "animais" "animais_atendidos" NOT NULL,
    "lat_publica" DOUBLE PRECISION NOT NULL,
    "lng_publica" DOUBLE PRECISION NOT NULL,
    "uf" CHAR(2),
    "municipio_ibge" INTEGER,
    "status" "status_casinha" NOT NULL DEFAULT 'sem_noticias',
    "situacao" "situacao_casinha" NOT NULL DEFAULT 'ativa',
    "moderacao" "status_moderacao" NOT NULL DEFAULT 'visivel',
    "ultima_atividade_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criada_por" UUID,
    "mesclada_em" UUID,
    "criada_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizada_em" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "casinhas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "casinhas_localizacao" (
    "casinha_id" UUID NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "precisao_m" REAL NOT NULL,
    "atualizada_em" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "casinhas_localizacao_pkey" PRIMARY KEY ("casinha_id")
);

-- CreateTable
CREATE TABLE "adocoes" (
    "id" UUID NOT NULL,
    "casinha_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "iniciada_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "encerrada_em" TIMESTAMPTZ,

    CONSTRAINT "adocoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "necessidades" (
    "id" UUID NOT NULL,
    "casinha_id" UUID NOT NULL,
    "tipo" "tipo_necessidade" NOT NULL,
    "urgencia" "urgencia" NOT NULL DEFAULT 'normal',
    "observacao" VARCHAR(280),
    "status" "status_necessidade" NOT NULL DEFAULT 'aberta',
    "criada_por" UUID,
    "criada_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criada_no_celular_em" TIMESTAMPTZ NOT NULL,
    "expira_em" TIMESTAMPTZ NOT NULL,
    "atendida_por" UUID,
    "atendida_em" TIMESTAMPTZ,
    "validado_local" BOOLEAN,

    CONSTRAINT "necessidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atividades" (
    "id" UUID NOT NULL,
    "casinha_id" UUID NOT NULL,
    "necessidade_id" UUID,
    "tipo" "tipo_atividade" NOT NULL,
    "usuario_id" UUID,
    "observacao" VARCHAR(280),
    "criada_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criada_no_celular_em" TIMESTAMPTZ,
    "validado_local" BOOLEAN,

    CONSTRAINT "atividades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fotos" (
    "id" UUID NOT NULL,
    "casinha_id" UUID NOT NULL,
    "atividade_id" UUID,
    "chave" TEXT NOT NULL,
    "chave_miniatura" TEXT NOT NULL,
    "enviada_por" UUID,
    "criada_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_em" TIMESTAMPTZ,
    "moderacao" "status_moderacao" NOT NULL DEFAULT 'visivel',

    CONSTRAINT "fotos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "denuncias" (
    "id" UUID NOT NULL,
    "alvo_tipo" "alvo_denuncia" NOT NULL,
    "alvo_id" UUID NOT NULL,
    "motivo" "motivo_denuncia" NOT NULL,
    "descricao" VARCHAR(500),
    "denunciante_id" UUID,
    "status" "status_denuncia" NOT NULL DEFAULT 'aberta',
    "resolvida_por" UUID,
    "resolvida_em" TIMESTAMPTZ,
    "criada_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "denuncias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acoes_moderacao" (
    "id" UUID NOT NULL,
    "moderador_id" UUID,
    "acao" VARCHAR(40) NOT NULL,
    "alvo_tipo" VARCHAR(20) NOT NULL,
    "alvo_id" UUID NOT NULL,
    "motivo" VARCHAR(500),
    "criada_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "acoes_moderacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acessos_localizacao" (
    "usuario_id" UUID NOT NULL,
    "casinha_id" UUID NOT NULL,
    "dia" DATE NOT NULL,

    CONSTRAINT "acessos_localizacao_pkey" PRIMARY KEY ("usuario_id","casinha_id","dia")
);

-- CreateTable
CREATE TABLE "limites_uso" (
    "usuario_id" UUID NOT NULL,
    "acao" VARCHAR(40) NOT NULL,
    "dia" DATE NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "limites_uso_pkey" PRIMARY KEY ("usuario_id","acao","dia")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_google_sub_key" ON "usuarios"("google_sub");

-- CreateIndex
CREATE UNIQUE INDEX "sessoes_refresh_hash_key" ON "sessoes"("refresh_hash");

-- CreateIndex
CREATE INDEX "sessoes_usuario_id_idx" ON "sessoes"("usuario_id");

-- CreateIndex
CREATE INDEX "codigos_email_email_criado_em_idx" ON "codigos_email"("email", "criado_em" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "perfis_apelido_normalizado_key" ON "perfis"("apelido_normalizado");

-- CreateIndex
CREATE INDEX "casinhas_lat_publica_lng_publica_idx" ON "casinhas"("lat_publica", "lng_publica");

-- CreateIndex
CREATE INDEX "casinhas_criada_por_idx" ON "casinhas"("criada_por");

-- CreateIndex
CREATE INDEX "casinhas_localizacao_lat_lng_idx" ON "casinhas_localizacao"("lat", "lng");

-- CreateIndex
CREATE INDEX "adocoes_usuario_id_idx" ON "adocoes"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "adocoes_ativa_unica" ON "adocoes"("casinha_id", "usuario_id") WHERE (ativa);

-- CreateIndex
CREATE INDEX "necessidades_casinha_id_status_idx" ON "necessidades"("casinha_id", "status");

-- CreateIndex
CREATE INDEX "necessidades_status_expira_em_idx" ON "necessidades"("status", "expira_em");

-- CreateIndex
CREATE UNIQUE INDEX "necessidades_aberta_por_tipo" ON "necessidades"("casinha_id", "tipo") WHERE (status = 'aberta');

-- CreateIndex
CREATE INDEX "atividades_casinha_id_criada_em_idx" ON "atividades"("casinha_id", "criada_em" DESC);

-- CreateIndex
CREATE INDEX "atividades_usuario_id_idx" ON "atividades"("usuario_id");

-- CreateIndex
CREATE INDEX "fotos_casinha_id_idx" ON "fotos"("casinha_id");

-- CreateIndex
CREATE INDEX "fotos_expira_em_idx" ON "fotos"("expira_em");

-- CreateIndex
CREATE INDEX "denuncias_status_criada_em_idx" ON "denuncias"("status", "criada_em");

-- CreateIndex
CREATE UNIQUE INDEX "denuncias_alvo_id_denunciante_id_key" ON "denuncias"("alvo_id", "denunciante_id");

-- CreateIndex
CREATE INDEX "acoes_moderacao_alvo_id_idx" ON "acoes_moderacao"("alvo_id");

-- CreateIndex
CREATE INDEX "acoes_moderacao_moderador_id_criada_em_idx" ON "acoes_moderacao"("moderador_id", "criada_em");

-- CreateIndex
CREATE INDEX "acessos_localizacao_dia_idx" ON "acessos_localizacao"("dia");

-- CreateIndex
CREATE INDEX "limites_uso_dia_idx" ON "limites_uso"("dia");

-- AddForeignKey
ALTER TABLE "sessoes" ADD CONSTRAINT "sessoes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perfis" ADD CONSTRAINT "perfis_id_fkey" FOREIGN KEY ("id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perfis" ADD CONSTRAINT "perfis_verificado_por_fkey" FOREIGN KEY ("verificado_por") REFERENCES "perfis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casinhas" ADD CONSTRAINT "casinhas_criada_por_fkey" FOREIGN KEY ("criada_por") REFERENCES "perfis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casinhas" ADD CONSTRAINT "casinhas_mesclada_em_fkey" FOREIGN KEY ("mesclada_em") REFERENCES "casinhas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casinhas_localizacao" ADD CONSTRAINT "casinhas_localizacao_casinha_id_fkey" FOREIGN KEY ("casinha_id") REFERENCES "casinhas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adocoes" ADD CONSTRAINT "adocoes_casinha_id_fkey" FOREIGN KEY ("casinha_id") REFERENCES "casinhas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adocoes" ADD CONSTRAINT "adocoes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "perfis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "necessidades" ADD CONSTRAINT "necessidades_casinha_id_fkey" FOREIGN KEY ("casinha_id") REFERENCES "casinhas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "necessidades" ADD CONSTRAINT "necessidades_criada_por_fkey" FOREIGN KEY ("criada_por") REFERENCES "perfis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "necessidades" ADD CONSTRAINT "necessidades_atendida_por_fkey" FOREIGN KEY ("atendida_por") REFERENCES "perfis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atividades" ADD CONSTRAINT "atividades_casinha_id_fkey" FOREIGN KEY ("casinha_id") REFERENCES "casinhas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atividades" ADD CONSTRAINT "atividades_necessidade_id_fkey" FOREIGN KEY ("necessidade_id") REFERENCES "necessidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atividades" ADD CONSTRAINT "atividades_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "perfis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fotos" ADD CONSTRAINT "fotos_casinha_id_fkey" FOREIGN KEY ("casinha_id") REFERENCES "casinhas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fotos" ADD CONSTRAINT "fotos_atividade_id_fkey" FOREIGN KEY ("atividade_id") REFERENCES "atividades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fotos" ADD CONSTRAINT "fotos_enviada_por_fkey" FOREIGN KEY ("enviada_por") REFERENCES "perfis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "denuncias" ADD CONSTRAINT "denuncias_denunciante_id_fkey" FOREIGN KEY ("denunciante_id") REFERENCES "perfis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "denuncias" ADD CONSTRAINT "denuncias_resolvida_por_fkey" FOREIGN KEY ("resolvida_por") REFERENCES "perfis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acoes_moderacao" ADD CONSTRAINT "acoes_moderacao_moderador_id_fkey" FOREIGN KEY ("moderador_id") REFERENCES "perfis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acessos_localizacao" ADD CONSTRAINT "acessos_localizacao_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "perfis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acessos_localizacao" ADD CONSTRAINT "acessos_localizacao_casinha_id_fkey" FOREIGN KEY ("casinha_id") REFERENCES "casinhas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "limites_uso" ADD CONSTRAINT "limites_uso_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "perfis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Restrições CHECK (adicionadas à mão: o Prisma não as modela nem as remove) ───

ALTER TABLE "casinhas" ADD CONSTRAINT "casinhas_coordenadas_validas"
  CHECK ("lat_publica" BETWEEN -90 AND 90 AND "lng_publica" BETWEEN -180 AND 180);

ALTER TABLE "casinhas_localizacao" ADD CONSTRAINT "casinhas_localizacao_coordenadas_validas"
  CHECK ("lat" BETWEEN -90 AND 90 AND "lng" BETWEEN -180 AND 180 AND "precisao_m" >= 0);

ALTER TABLE "codigos_email" ADD CONSTRAINT "codigos_email_tentativas_validas"
  CHECK ("tentativas" >= 0);

ALTER TABLE "limites_uso" ADD CONSTRAINT "limites_uso_quantidade_valida"
  CHECK ("quantidade" >= 0);

-- Adoção encerrada precisa ter data de encerramento.
ALTER TABLE "adocoes" ADD CONSTRAINT "adocoes_encerramento_coerente"
  CHECK ("ativa" OR "encerrada_em" IS NOT NULL);
