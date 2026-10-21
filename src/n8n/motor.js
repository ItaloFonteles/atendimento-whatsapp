
// --- Nó "Motor de conversa": junta a mensagem com os dados do banco e chama processar() ---
const msg = $('Extrair mensagem').first().json;
const banco = $input.first().json;
const conversa = banco.conversa || null;
const minutosDesdeUltima = conversa
  ? (Date.now() - new Date(conversa.atualizado_em).getTime()) / 60000
  : 0;

const r = processar({
  telefone: msg.telefone,
  texto: msg.texto,
  nome: msg.nome,
  midia: msg.midia === true,
  agora: $now.setZone('America/Boa_Vista').toFormat("yyyy-MM-dd'T'HH:mm"),
  conversa,
  minutosDesdeUltima,
  servicos: banco.servicos || [],
  ocupados: banco.ocupados || [],
  bloqueios: banco.bloqueios || [],
  meus: banco.meus || [],
});

// Vai para o banco em base64 para não ter problema com vírgulas e aspas nos parâmetros
const payload = Buffer.from(JSON.stringify(r), 'utf8').toString('base64');
return [{ json: { ...r, payload } }];
