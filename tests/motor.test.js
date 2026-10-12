// Testes do motor de conversa. Rodar com:
//   docker run --rm -v "$PWD":/app -w /app node:20-alpine node --test tests/
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { processar, horariosLivres, diasComVaga, textoLembrete } = require('../src/motor.js');

const SERVICOS = [
  { id: 1, nome_pt: 'Consulta', nome_es: 'Consulta', nome_en: 'Consultation' },
  { id: 2, nome_pt: 'Retorno', nome_es: 'Control', nome_en: 'Follow-up' },
];
// Segunda-feira, 12/10/2026, 14:30 (horário de Boa Vista)
const AGORA = '2026-10-12T14:30';

// Simula uma conversa: aplica cada mensagem guardando o estado como o banco faria
function conversar(mensagens, extra = {}) {
  let conversa = null;
  const saidas = [];
  for (const texto of mensagens) {
    const r = processar({
      telefone: '5595999990000', texto, nome: 'Ana', agora: AGORA,
      conversa, minutosDesdeUltima: 1, servicos: SERVICOS, ocupados: [], meus: [], ...extra,
    });
    conversa = r.conversa;
    saidas.push(r);
  }
  return saidas;
}

test('primeira mensagem pede o idioma nos três idiomas', () => {
  const [r] = conversar(['oi']);
  assert.match(r.resposta, /Português/);
  assert.match(r.resposta, /Español/);
  assert.match(r.resposta, /English/);
  assert.equal(r.conversa.etapa, 'idioma');
});

test('escolher espanhol mostra o menu em espanhol', () => {
  const r = conversar(['hola', '2']).at(-1);
  assert.equal(r.conversa.idioma, 'es');
  assert.match(r.resposta, /Agendar una cita/);
});

test('fluxo completo de agendamento gera a ação de agendar', () => {
  const s = conversar(['oi', '1', '1', '1', '1', '1', 'Ana Souza', '1']);
  const [, menu, servicos, dias, horas, nome, resumo, fim] = s;
  assert.match(menu.resposta, /Agendar horário/);
  assert.match(servicos.resposta, /Consulta/);
  assert.match(dias.resposta, /Seg, 12\/10/);          // hoje ainda tem vaga às 16h e 17h
  assert.match(horas.resposta, /16:00/);
  assert.doesNotMatch(horas.resposta, /15:00/);        // 15h é antes de 1h de antecedência
  assert.match(nome.resposta, /nome completo/);
  assert.match(resumo.resposta, /Ana Souza/);
  assert.deepEqual(fim.acao, { tipo: 'agendar', servico_id: 1, inicio: '2026-10-12T16:00', nome: 'Ana Souza' });
  assert.equal(fim.conversa.etapa, 'menu');
  assert.equal(fim.conversa.dados.nome_cliente, 'Ana Souza');   // fica salvo para a próxima vez
});

test('horário ocupado não aparece na lista', () => {
  const livres = horariosLivres('2026-10-13', AGORA, ['2026-10-13T09:00']);
  assert.ok(!livres.includes('2026-10-13T09:00'));
  assert.ok(livres.includes('2026-10-13T08:00'));
  assert.equal(livres.length, 7);                      // 8 horários - 1 ocupado
});

test('domingo não tem expediente', () => {
  assert.deepEqual(horariosLivres('2026-10-18', AGORA, []), []);
  const dias = diasComVaga(AGORA, []);
  assert.ok(!dias.includes('2026-10-18'));
  assert.equal(dias.length, 6);
});

test('opção inválida avisa e repete o menu', () => {
  const r = conversar(['oi', '1', '9']).at(-1);
  assert.match(r.resposta, /Não entendi/);
  assert.match(r.resposta, /Agendar horário/);
});

test('cancelar um agendamento existente', () => {
  const meus = [{ id: 42, inicio: '2026-10-14T10:00', servico_id: 2 }];
  const s = conversar(['oi', '3', '2', '1', '1'], { meus });
  assert.match(s[2].resposta, /Wed, 14\/10 at 10:00/);
  assert.match(s[2].resposta, /Follow-up/);
  assert.deepEqual(s.at(-1).acao, { tipo: 'cancelar', id: 42 });
});

test('pedir atendente deixa o robô em silêncio até digitar menu', () => {
  const s = conversar(['oi', '1', '4', 'preciso de ajuda', 'menu']);
  assert.match(s[2].resposta, /atendente/);
  assert.equal(s[3].resposta, '');
  assert.match(s[4].resposta, /Como posso ajudar/);
});

test('conversa parada há muito tempo volta para o menu', () => {
  const r = processar({
    telefone: '1', texto: '3', agora: AGORA, servicos: SERVICOS, ocupados: [], meus: [],
    conversa: { idioma: 'pt', etapa: 'hora', dados: { dia: '2026-10-13' } }, minutosDesdeUltima: 90,
  });
  assert.equal(r.conversa.etapa, 'menu');
  assert.equal(r.acao, null);
});

test('lembrete no idioma do cliente', () => {
  assert.match(textoLembrete('en', 'John', 'Consultation', '2026-10-13T09:00'), /Reminder: John.*Tue, 13\/10 at 09:00/s);
  assert.match(textoLembrete('es', 'Juan', 'Consulta', '2026-10-13T09:00'), /Recordatorio/);
});
