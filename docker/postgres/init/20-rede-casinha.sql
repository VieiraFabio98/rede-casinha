-- Roda só na primeira inicialização do volume.
-- Para rodar de novo: docker compose down -v && docker compose up -d

-- Banco usado pelos testes de integração da API.
CREATE DATABASE rede_casinha_test;
