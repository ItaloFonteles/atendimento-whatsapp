// Testes do motor de conversa. Rodar com:
//   docker run --rm -v "$PWD":/app -w /app node:20-alpine node --test tests/
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  processar, horariosLivres, diasComVaga, textoLembrete, horarioTexto, extrairNumero, nomeValido,
} = require('../src/motor.js');

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

// ---------------------------------------------------------------------
// Entender o que a pessoa digita de verdade
// ---------------------------------------------------------------------
const MENU_PT = { idioma: 'pt', etapa: 'menu', dados: {} };
const noMenu = (texto, extra = {}) => processar({
  telefone: '1', texto, nome: 'Ana', agora: AGORA, conversa: MENU_PT,
  minutosDesdeUltima: 1, servicos: SERVICOS, ocupados: [], meus: [], ...extra,
});

test('aceita o número copiado como emoji, com ponto ou escrito "opção 1"', () => {
  for (const t of ['1', '1️⃣', '1.', '1)', ' 1 ', 'opção 1', 'opcion 1', 'Option 1']) {
    assert.equal(noMenu(t).conversa.etapa, 'servico', `falhou com "${t}"`);
  }
  assert.equal(extrairNumero('10'), 10);
  assert.equal(extrairNumero('1 e 2'), null);
  assert.equal(extrairNumero('ana'), null);
});

test('palavras levam direto à opção do menu, nos três idiomas', () => {
  assert.equal(noMenu('quero agendar').conversa.etapa, 'servico');
  assert.equal(noMenu('quiero una cita').conversa.etapa, 'servico');
  assert.equal(noMenu('book an appointment').conversa.etapa, 'servico');
  assert.equal(noMenu('falar com atendente').conversa.etapa, 'humano');
  assert.match(noMenu('qual o endereço?').resposta, /Capitão Ene Garcez/);
});

test('"cancelar minha consulta" vai para Meus agendamentos, não para Agendar', () => {
  const meus = [{ id: 7, inicio: '2026-10-14T10:00', servico_id: 1 }];
  const r = noMenu('quero cancelar minha consulta', { meus });
  assert.equal(r.conversa.etapa, 'meus');
});

test('saudação e agradecimento no menu não respondem "Não entendi"', () => {
  for (const t of ['oi', 'Olá', 'bom dia', 'hola', 'good morning']) {
    const r = noMenu(t);
    assert.doesNotMatch(r.resposta, /Não entendi/, `falhou com "${t}"`);
    assert.match(r.resposta, /Como posso ajudar/);
  }
  assert.match(noMenu('obrigado!').resposta, /Por nada/);
  assert.match(noMenu('banana').resposta, /Não entendi/);   // o resto continua avisando
});

test('nome inválido pede de novo; nome de verdade segue para o resumo', () => {
  for (const n of ['kkk', 'hahaha', 'Sim', 'ok', '123', 'Ana 2', 'Jo']) assert.equal(nomeValido(n), false, n);
  for (const n of ['Maria', 'Ana Souza', 'José', "D'Ávila"]) assert.equal(nomeValido(n), true, n);

  const s = conversar(['oi', '1', '1', '1', '1', '1', 'kkk', 'Ana Souza']);
  assert.equal(s.at(-2).conversa.etapa, 'nome');
  assert.equal(s.at(-1).conversa.etapa, 'confirmar');
});

// ---------------------------------------------------------------------
// Feriados, serviços e horário de funcionamento
// ---------------------------------------------------------------------
test('dia bloqueado (feriado) não aparece e não tem horários', () => {
  const AGORA_SAB = '2026-10-31T19:00';
  assert.deepEqual(horariosLivres('2026-11-02', AGORA_SAB, [], ['2026-11-02']), []);
  const dias = diasComVaga(AGORA_SAB, [], ['2026-11-02']);
  assert.ok(!dias.includes('2026-11-02'));
  assert.equal(dias[0], '2026-11-03');

  const s = conversar(['oi', '1', '1', '1'], { agora: AGORA_SAB, bloqueios: ['2026-11-02'] });
  assert.doesNotMatch(s.at(-1).resposta, /02\/11/);
});

test('sem serviços cadastrados avisa e volta ao menu, sem travar', () => {
  const r = noMenu('1', { servicos: [] });
  assert.equal(r.conversa.etapa, 'menu');
  assert.match(r.resposta, /não há serviços/);
});

test('horário de funcionamento é gerado do expediente, nos três idiomas', () => {
  assert.equal(horarioTexto('pt'), 'Segunda a sexta: 8h–12h e 14h–18h\nSábado: 8h–12h');
  assert.equal(horarioTexto('es'), 'Lunes a viernes: 8h–12h y 14h–18h\nSábado: 8h–12h');
  assert.equal(horarioTexto('en'), 'Monday to Friday: 8am–12pm and 2pm–6pm\nSaturday: 8am–12pm');
  assert.match(noMenu('3').resposta, /Segunda a sexta: 8h–12h e 14h–18h/);
});

// ---------------------------------------------------------------------
// Áudio, foto, figurinha e LGPD
// ---------------------------------------------------------------------
test('áudio ou foto: avisa no idioma do cliente e não perde a etapa', () => {
  const conversa = { idioma: 'es', etapa: 'hora', dados: { dia: '2026-10-13' } };
  const r = processar({ telefone: '1', texto: '', midia: true, agora: AGORA, conversa,
    minutosDesdeUltima: 1, servicos: SERVICOS, ocupados: [], meus: [] });
  assert.match(r.resposta, /no puedo escuchar audios/);
  assert.equal(r.conversa.etapa, 'hora');
  assert.equal(r.acao, null);
});

test('áudio como primeira mensagem mostra as boas-vindas', () => {
  const r = processar({ telefone: '1', texto: '', midia: true, agora: AGORA, conversa: null,
    minutosDesdeUltima: 0, servicos: SERVICOS, ocupados: [], meus: [] });
  assert.match(r.resposta, /Escolha o idioma/);
});

test('áudio durante atendimento humano: o robô continua em silêncio', () => {
  const r = processar({ telefone: '1', texto: '', midia: true, agora: AGORA,
    conversa: { idioma: 'pt', etapa: 'humano', dados: {} }, minutosDesdeUltima: 5,
    servicos: SERVICOS, ocupados: [], meus: [] });
  assert.equal(r.resposta, '');
});

test('boas-vindas avisam como os dados são usados (LGPD)', () => {
  const [r] = conversar(['oi']);
  assert.match(r.resposta, /nome e telefone são usados só para o agendamento/);
});

