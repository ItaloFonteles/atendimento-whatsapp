#!/bin/sh
# Importa a credencial do banco e os fluxos no n8n e deixa os fluxos ativos.
# Rodar com:  docker compose exec n8n sh /setup/importar.sh
#        e:  docker compose restart n8n
set -e

cat > /tmp/credenciais.json <<EOF
[{
  "id": "agendaPostgres01",
  "name": "Postgres agenda",
  "type": "postgres",
  "data": {
    "host": "postgres",
    "port": 5432,
    "database": "agenda",
    "user": "$AGENDA_DB_USER",
    "password": "$AGENDA_DB_PASSWORD",
    "ssl": "disable"
  }
}]
EOF

n8n import:credentials --input=/tmp/credenciais.json
rm -f /tmp/credenciais.json

n8n import:workflow --separate --input=/setup/workflows
n8n update:workflow --all --active=true

echo ""
echo "Pronto! Agora reinicie o n8n:  docker compose restart n8n"
