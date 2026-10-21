// Testes do nó "Extrair mensagem" (src/n8n/extrair.js).
// O código roda dentro do n8n, então aqui simulamos o $input e o $env que o n8n fornece.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const codigo = fs.readFileSync(path.join(__dirname, '..', 'src', 'n8n', 'extrair.js'), 'utf8');
// eslint-disable-next-line no-new-func
const no = new Function('$input', '$env', codigo);

function extrair(body, modoTeste) {
  const $input = { first: () => ({ json: { body } }) };
  return no($input, { MODO_TESTE: String(modoTeste) })[0].json;
}

// Mensagem no formato que a Evolution API manda para o webhook
const evolution = (message, key = {}) => ({
  event: 'messages.upsert',
  data: {
    key: { remoteJid: '5595999990000@s.whatsapp.net', fromMe: false, ...key },
    pushName: 'Ana',
    message,
  },
});

test('formato de teste manual é aceito só em MODO_TESTE (segurança)', () => {
  const corpo = { telefone: '5595900000001', texto: 'oi' };
  assert.equal(extrair(corpo, true).ignorar, false);
  assert.equal(extrair(corpo, false).ignorar, true);   // ninguém de fora usa o robô para mandar spam
});

test('texto normal da Evolution é lido', () => {
  const r = extrair(evolution({ conversation: 'oi' }), false);
  assert.deepEqual(r, { telefone: '5595999990000', texto: 'oi', nome: 'Ana', midia: false, ignorar: false });
});

test('áudio, figurinha e localização viram "mídia" e recebem resposta', () => {
  for (const tipo of ['audioMessage', 'stickerMessage', 'locationMessage', 'imageMessage']) {
    const r = extrair(evolution({ [tipo]: {} }), false);
    assert.equal(r.midia, true, tipo);
    assert.equal(r.ignorar, false, tipo);
  }
});

test('foto com legenda: a legenda vale como texto', () => {
  const r = extrair(evolution({ imageMessage: { caption: 'quero agendar' } }), false);
  assert.equal(r.texto, 'quero agendar');
  assert.equal(r.midia, false);
});

test('reação, mensagem apagada, grupo e mensagens próprias são ignoradas', () => {
  assert.equal(extrair(evolution({ reactionMessage: { text: '👍' } }), false).ignorar, true);
  assert.equal(extrair(evolution({ protocolMessage: {} }), false).ignorar, true);
  assert.equal(extrair(evolution({ conversation: 'oi' }, { remoteJid: '123-456@g.us' }), false).ignorar, true);
  assert.equal(extrair(evolution({ conversation: 'oi' }, { fromMe: true }), false).ignorar, true);
});

test('conta nova (@lid) usa o número real do campo senderPn', () => {
  const r = extrair(evolution({ conversation: 'oi' },
    { remoteJid: '123456789@lid', senderPn: '5595988887777@s.whatsapp.net' }), false);
  assert.equal(r.telefone, '5595988887777');
  assert.equal(r.ignorar, false);
});
