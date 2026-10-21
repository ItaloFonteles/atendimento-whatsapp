// Nó "Extrair mensagem": aceita o formato da Evolution API ou um teste manual {telefone, texto, nome}
const corpo = $input.first().json.body || {};
const modoTeste = String($env.MODO_TESTE).toLowerCase() === 'true';
let telefone = '';
let texto = '';
let nome = '';
let midia = false;
let ignorar = false;

// Tipos de mensagem que a pessoa mandou de propósito, mas que o robô não sabe ler.
// Reações, edições e mensagens apagadas ficam de fora: não merecem resposta.
const TIPOS_MIDIA = [
  'audioMessage', 'imageMessage', 'videoMessage', 'stickerMessage',
  'documentMessage', 'documentWithCaptionMessage', 'locationMessage', 'contactMessage',
];

if (corpo.event) {
  // Mensagem real vinda da Evolution API
  const d = corpo.data || {};
  const key = d.key || {};
  let jid = key.remoteJid || '';
  // Contas novas do WhatsApp podem vir com "@lid"; o número real vem em outro campo
  if (jid.endsWith('@lid')) jid = key.senderPn || key.remoteJidAlt || jid;
  const m = d.message || {};
  telefone = jid.split('@')[0];
  texto = m.conversation ||
    (m.extendedTextMessage && m.extendedTextMessage.text) ||
    // Foto ou vídeo com legenda: a legenda vale como texto
    (m.imageMessage && m.imageMessage.caption) ||
    (m.videoMessage && m.videoMessage.caption) || '';
  midia = !texto && TIPOS_MIDIA.some((tipo) => m[tipo]);
  ignorar = corpo.event !== 'messages.upsert' || key.fromMe === true ||
    !jid.endsWith('@s.whatsapp.net') || (!texto && !midia);
  nome = d.pushName || '';
} else {
  // Teste manual (scripts/simular.ps1 ou curl).
  // Só vale em MODO_TESTE: fora dele, qualquer um que alcançasse o webhook
  // conseguiria fazer o robô mandar mensagem para qualquer número.
  telefone = String(corpo.telefone || '').replace(/\D/g, '');
  texto = String(corpo.texto || '');
  nome = String(corpo.nome || '');
  midia = corpo.midia === true;
  ignorar = !modoTeste || !telefone || (!texto && !midia);
}

return [{ json: { telefone, texto, nome, midia, ignorar } }];
