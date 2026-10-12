-- Estrutura da agenda. Roda só na primeira vez que o Postgres sobe (volume vazio).

CREATE TABLE servicos (
  id          serial PRIMARY KEY,
  nome_pt     text NOT NULL,
  nome_es     text NOT NULL,
  nome_en     text NOT NULL,
  ativo       boolean NOT NULL DEFAULT true
);

-- Horários guardados no horário local de Boa Vista (sem fuso)
CREATE TABLE agendamentos (
  id                serial PRIMARY KEY,
  telefone          text NOT NULL,
  nome              text,
  servico_id        int REFERENCES servicos(id),
  inicio            timestamp NOT NULL,
  idioma            char(2) NOT NULL DEFAULT 'pt',
  status            text NOT NULL DEFAULT 'confirmado',   -- confirmado | cancelado
  lembrete_enviado  boolean NOT NULL DEFAULT false,
  criado_em         timestamptz NOT NULL DEFAULT now()
);

-- Um atendimento por horário (um profissional). Impede duas reservas no mesmo horário.
CREATE UNIQUE INDEX ux_agendamentos_horario ON agendamentos (inicio) WHERE status = 'confirmado';
CREATE INDEX ix_agendamentos_telefone ON agendamentos (telefone);

-- Estado da conversa de cada número (em que passo do menu a pessoa está)
CREATE TABLE conversas (
  telefone       text PRIMARY KEY,
  idioma         char(2),
  etapa          text,
  dados          jsonb NOT NULL DEFAULT '{}',
  atualizado_em  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO servicos (nome_pt, nome_es, nome_en) VALUES
  ('Consulta',          'Consulta',          'Consultation'),
  ('Retorno',           'Control',           'Follow-up'),
  ('Avaliação inicial', 'Evaluación inicial', 'First evaluation');
