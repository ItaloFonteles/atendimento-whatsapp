# Atendimento e Agendamento Trilíngue no WhatsApp

[![testes](https://github.com/ItaloFonteles/atendimento-whatsapp/actions/workflows/testes.yml/badge.svg)](https://github.com/ItaloFonteles/atendimento-whatsapp/actions/workflows/testes.yml)

Robô de WhatsApp que **atende em português, espanhol e inglês**, mostra os horários livres, **agenda, lista e cancela** atendimentos, envia **lembretes** antes do horário e manda para o dono um **resumo diário** da agenda.

Feito para clínicas, salões, escritórios e comércios de **Boa Vista - RR** que atendem clientes brasileiros, venezuelanos e guianenses.

**Stack:** n8n · Evolution API (WhatsApp) · PostgreSQL · Redis · Docker Compose

---

## Como funciona

```
Cliente no WhatsApp
      │
      ▼
Evolution API ──(webhook)──▶ n8n: "Atendimento WhatsApp"
                               │  1. extrai número e texto
                               │  2. carrega conversa, serviços e horários (Postgres)
                               │  3. motor de conversa decide a resposta
                               │  4. grava conversa / agendamento / cancelamento
                               │  5. responde pelo WhatsApp
                               ▼
                           PostgreSQL (agenda)
                               ▲
n8n: "Lembretes" (a cada 15 min) ─┤  avisa quem tem horário nas próximas 24h
n8n: "Resumo diário" (7h)  ───────┘  manda a agenda do dia para o dono
```

**Conversa de exemplo**

```
Cliente: hola
Robô:    Olá! 👋 Bem-vindo(a)... Escolha o idioma · Elige el idioma · Choose your language
         1️⃣ Português  2️⃣ Español  3️⃣ English
Cliente: 2
Robô:    ¿Cómo puedo ayudarte? 1️⃣ Agendar una cita  2️⃣ Mis citas  3️⃣ Dirección...  4️⃣ Hablar con una persona
Cliente: 1  → servicio → día → horario → nombre → confirmar
Robô:    ✅ ¡Cita confirmada para el *Mar, 13/10 a las 09:00*!
```

## Funcionalidades

- Escolha de idioma (PT / ES / EN); todas as mensagens, dias da semana e lembretes no idioma do cliente.
- Entende o jeito que as pessoas escrevem: `1`, `1️⃣` (emoji copiado do menu), `1.`, `opção 1`, e palavras como *agendar*, *cancelar*, *endereço* ou *falar com atendente*.
- Responde a saudações e agradecimentos sem "Não entendi", e recusa respostas que não são nome (*kkk*, *sim*, *ok*).
- Áudio, foto ou figurinha recebem um aviso no idioma do cliente, em vez de silêncio.
- **Feriados e folgas** bloqueados na tabela `bloqueios`: o robô não oferece horário nesses dias.
- O horário de funcionamento informado ao cliente é gerado do expediente configurado (nunca fica desatualizado).
- Aviso de uso dos dados (LGPD) já na mensagem de boas-vindas.
- Agendamento passo a passo: serviço → dia → horário → nome → confirmação.
- Só mostra horários livres, respeitando expediente, antecedência mínima e dias sem atendimento.
- **Não permite duas reservas no mesmo horário**, nem se duas pessoas confirmarem ao mesmo tempo (índice único no banco).
- "Meus agendamentos" com cancelamento.
- "Falar com um atendente": o robô fica em silêncio por 2h para uma pessoa assumir a conversa.
- Conversa parada por 30 min volta ao menu; *menu* funciona a qualquer momento.
- Lembrete automático até 24h antes, no idioma do cliente.
- Resumo da agenda do dia para o dono, de segunda a sábado às 7h.
- **Modo de teste:** conversa com o robô pelo terminal, sem precisar de celular.

## Rodando

Requisitos: **Docker Desktop**.

```bash
# 1. Configuração
cp .env.example .env        # depois edite as senhas/chaves (use só letras e números)

# 2. Subir tudo
docker compose up -d

# 3. Importar os fluxos no n8n e ativar
docker compose exec n8n sh /setup/importar.sh
docker compose restart n8n
```

| Serviço | Endereço |
|---------|----------|
| n8n (fluxos) | http://localhost:5678 |
| Evolution API (painel) | http://localhost:8080/manager |
| PostgreSQL | `localhost:5433`, banco `agenda` |

> No primeiro acesso ao n8n ele pede para criar uma conta de dono. Os fluxos já ficam ativos mesmo antes disso.

### Testar sem WhatsApp (MODO_TESTE=true)

Com `MODO_TESTE=true` no `.env`, nada é enviado pelo WhatsApp e o webhook devolve a resposta do robô:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\simular.ps1
```

Ou com `curl`:

```bash
curl -X POST http://localhost:5678/webhook/whatsapp -H "Content-Type: application/json" -d '{"telefone":"5595900000001","nome":"Ana","texto":"oi"}'
```

### Ligar no WhatsApp de verdade

1. Abra http://localhost:8080/manager e entre com a `EVOLUTION_API_KEY` do `.env`.
2. Crie uma instância com o **mesmo nome** de `EVOLUTION_INSTANCIA` (ex.: `clinica`).
3. Clique em conectar e leia o **QR Code** com o WhatsApp do número que vai atender (em *Aparelhos conectados*).
4. No `.env`, troque para `MODO_TESTE=false` e coloque o seu número em `DONO_TELEFONE`.
5. Recrie o n8n para ler o `.env` novo: `docker compose up -d n8n`.

Pronto: mensagens que chegarem nesse número passam pelo robô.

## Personalizando para um cliente

| O quê | Onde |
|-------|------|
| Nome da empresa, endereço, mapa, expediente, duração dos horários | `CONFIG` no topo de `src/motor.js` |
| Textos das mensagens (PT / ES / EN) | objeto `T` em `src/motor.js` |
| Serviços oferecidos | tabela `servicos` no banco (ou `db/init/02-agenda.sql` antes de subir pela 1ª vez) |
| Feriados, folgas e férias | tabela `bloqueios` no banco (um dia por linha) |
| Horário do resumo diário | nó "Seg a sáb às 7h" em `n8n/templates/resumo.json` |

Depois de editar algo em `src/`, monte e importe os fluxos de novo:

```bash
docker run --rm -v "%cd%":/app -w /app node:20-alpine node scripts/montar-workflows.js
docker compose exec n8n sh /setup/importar.sh
docker compose restart n8n
```

### Bloquear um feriado ou folga

```bash
docker compose exec postgres psql -U agenda -d agenda -c "INSERT INTO bloqueios VALUES ('2026-12-24', 'Véspera de Natal');"
```

### Atualizando uma instalação antiga

O banco só é criado na primeira vez que o Postgres sobe. Se você já tinha o sistema rodando antes da tabela `bloqueios`, rode a migração uma vez:

```bash
docker compose exec -T postgres psql -U agenda -d agenda < db/migracoes/001-bloqueios.sql
```

## Testes

O motor de conversa é uma função pura (sem banco e sem rede), e o nó que lê as mensagens da Evolution também é testado. Os testes rodam a cada push pelo GitHub Actions:

```bash
node --test
```

Sem Node no PC:

```bash
docker run --rm -v "%cd%":/app -w /app node:20-alpine node --test
```

## Estrutura

```
atendimento-whatsapp/
├── docker-compose.yml        # Postgres, Redis, Evolution API e n8n
├── .env.example              # senhas, chaves e modo de teste
├── db/init/                  # criação dos bancos, tabelas, serviços e feriados de exemplo
├── db/migracoes/             # alterações para quem já tem o banco criado
├── src/
│   ├── motor.js              # lógica da conversa, textos nos 3 idiomas e agenda
│   └── n8n/                  # código de cada nó "Code" dos fluxos
├── n8n/
│   ├── templates/            # fluxos com marcadores para o código de src/
│   ├── workflows/            # fluxos prontos para importar (gerados)
│   └── importar.sh           # importa credencial + fluxos e ativa
├── scripts/
│   ├── montar-workflows.js   # junta templates + src → workflows
│   └── simular.ps1           # conversa com o robô pelo terminal
├── tests/
│   ├── motor.test.js         # conversa, agenda, feriados, idiomas
│   └── extrair.test.js       # leitura das mensagens da Evolution e segurança do webhook
└── .github/workflows/        # testes automáticos a cada push
```

## Cuidados antes de usar com clientes

- **A Evolution API não é a API oficial do WhatsApp.** Ela funciona como o WhatsApp Web, e o WhatsApp pode **bloquear números** que usam automação não oficial, principalmente com envio em massa. Use um **número dedicado** (nunca o pessoal) e só responda quem mandou mensagem. Para clientes maiores, considere a **API oficial (WhatsApp Business Platform / Cloud API da Meta)**, que é paga por conversa.
- **LGPD:** o sistema guarda nome e telefone. O cliente final deve ser informado (ex.: na primeira mensagem ou no site) e os dados não devem ser usados para outra finalidade.
- **Segurança do webhook:** as portas do n8n (5678), da Evolution (8080) e do Postgres (5433) ficam abertas só no próprio computador (`127.0.0.1`); a Evolution conversa com o n8n pela rede interna do Docker. O formato de teste manual (`{telefone, texto}`) só é aceito com `MODO_TESTE=true`, para ninguém usar o robô para mandar mensagens a outros números.
- **Produção:** em servidor (VPS), coloque HTTPS na frente do n8n e da Evolution (ex.: Nginx Proxy Manager ou Traefik) em vez de abrir as portas, e faça backup do volume `postgres_data`.

---

Feito por **Ítalo Fonteles** · [italofonteles.dev](https://italofonteles.dev) · [GitHub](https://github.com/ItaloFonteles)
