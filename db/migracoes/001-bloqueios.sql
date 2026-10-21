-- Migração para quem já tinha o sistema rodando antes da tabela de bloqueios.
-- (Instalações novas não precisam: db/init/02-agenda.sql já cria a tabela.)
-- Rodar com:
--   docker compose exec -T postgres psql -U agenda -d agenda < db/migracoes/001-bloqueios.sql

CREATE TABLE IF NOT EXISTS bloqueios (
  dia     date PRIMARY KEY,
  motivo  text
);

INSERT INTO bloqueios (dia, motivo) VALUES
  ('2026-11-02', 'Finados'),
  ('2026-11-15', 'Proclamação da República'),
  ('2026-11-20', 'Consciência Negra'),
  ('2026-12-25', 'Natal'),
  ('2027-01-01', 'Confraternização Universal')
ON CONFLICT (dia) DO NOTHING;
