// Monta os fluxos do n8n: pega n8n/templates/*.json e coloca o código de src/ nos nós "Code".
// Rodar depois de editar qualquer arquivo em src/:
//   node scripts/montar-workflows.js
//   (sem Node no PC:  docker run --rm -v "%cd%":/app -w /app node:20-alpine node scripts/montar-workflows.js)
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const pastaTemplates = path.join(raiz, 'n8n', 'templates');
const pastaSaida = path.join(raiz, 'n8n', 'workflows');
fs.mkdirSync(pastaSaida, { recursive: true });

for (const arquivo of fs.readdirSync(pastaTemplates).filter((f) => f.endsWith('.json'))) {
  const fluxo = JSON.parse(fs.readFileSync(path.join(pastaTemplates, arquivo), 'utf8'));

  for (const no of fluxo.nodes) {
    const marcador = /^__CODE:(.+)__$/.exec(no.parameters && no.parameters.jsCode);
    if (!marcador) continue;
    no.parameters.jsCode = marcador[1]
      .split(',')
      .map((f) => fs.readFileSync(path.join(raiz, 'src', f.trim()), 'utf8'))
      .join('\n');
  }

  fs.writeFileSync(path.join(pastaSaida, arquivo), JSON.stringify(fluxo, null, 2) + '\n');
  console.log('ok:', arquivo);
}
