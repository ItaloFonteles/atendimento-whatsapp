// Nó "Extrair mensagem": aceita o formato da Evolution API ou um teste manual {telefone, texto, nome}
const corpo = $input.first().json.body || {};
let telefone = '';
let texto = '';
let nome = '';
let ignorar = false;

if (corpo.event) {
  // Mensagem real vinda da Evolution API
  const d = corpo.data || {};
  const key = d.key || {};
  let jid = key.remoteJid || '';
  // Contas novas do WhatsApp podem vir com "@lid"; o número real vem em outro campo
  if (jid.endsWith('@lid')) jid = key.senderPn || key.remoteJidAlt || jid;
  const m = d.message || {};
  telefone = jid.split('@')[0];
  texto = m.conversation || (m.extendedTextMessage && m.extendedTextMessage.text) || '';
  nome = d.pushName || '';
  ignorar = corpo.event !== 'messages.upsert' || key.fromMe === true ||
    !jid.endsWith('@s.whatsapp.net') || !texto;
} else {
  // Teste manual (scripts/simular.ps1 ou curl)
  telefone = String(corpo.telefone || '').replace(/\D/g, '');
  texto = String(corpo.texto || '');
  nome = String(corpo.nome || '');
  ignorar = !telefone || !texto;
}

return [{ json: { telefone, texto, nome, ignorar } }];
