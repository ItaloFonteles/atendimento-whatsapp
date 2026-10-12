// =====================================================================
// Motor de conversa: recebe a mensagem + o estado salvo e devolve a
// resposta, o novo estado e (se houver) uma ação para gravar no banco.
// Função pura (sem banco, sem rede) para poder ser testada fora do n8n.
// =====================================================================

const CONFIG = {
  empresa: 'Clínica Exemplo',
  endereco: 'Av. Capitão Ene Garcez, 1000 - Centro, Boa Vista - RR',
  mapa: 'https://maps.google.com/?q=Boa+Vista+RR',
  // Dias da semana: 0 = domingo ... 6 = sábado. Cada dia tem uma lista de turnos [início, fim].
  expediente: {
    1: [['08:00', '12:00'], ['14:00', '18:00']],
    2: [['08:00', '12:00'], ['14:00', '18:00']],
    3: [['08:00', '12:00'], ['14:00', '18:00']],
    4: [['08:00', '12:00'], ['14:00', '18:00']],
    5: [['08:00', '12:00'], ['14:00', '18:00']],
    6: [['08:00', '12:00']],
  },
  duracaoSlotMin: 60,     // tamanho de cada horário
  diasExibidos: 6,        // quantos dias com vaga mostrar
  antecedenciaMin: 60,    // não deixa marcar para daqui a menos de 1h
  sessaoExpiraMin: 30,    // conversa parada há mais tempo volta ao menu
  humanoPausaMin: 120,    // depois de pedir atendente, o robô fica quieto por 2h
};

// ---------------------------------------------------------------------
// Textos nos três idiomas
// ---------------------------------------------------------------------
const DIAS = {
  pt: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
  es: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};

const T = {
  pt: {
    menu: (nome) =>
      `Como posso ajudar${nome ? ', ' + nome : ''}?\n\n` +
      '1️⃣ Agendar horário\n2️⃣ Meus agendamentos\n3️⃣ Endereço e horário de funcionamento\n4️⃣ Falar com um atendente\n\n' +
      '0️⃣ Trocar idioma\n_Digite *menu* a qualquer momento para voltar aqui._',
    naoEntendi: 'Não entendi 🤔. Responda com o *número* de uma das opções.',
    servicos: 'Qual serviço você deseja?',
    dias: 'Escolha o dia:',
    semDias: 'Não há horários livres nos próximos dias. 😕 Digite *4* no menu para falar com um atendente.',
    horas: (dia) => `Horários livres em *${dia}*:`,
    nome: 'Qual é o *nome completo* de quem será atendido?',
    resumo: (n, s, d) => `Confira seu agendamento:\n\n👤 ${n}\n📋 ${s}\n📅 ${d}\n\n1️⃣ Confirmar\n2️⃣ Cancelar`,
    confirmado: (d) => `✅ Agendamento confirmado para *${d}*!\nVocê vai receber um lembrete um dia antes.\n\nDigite *menu* para outras opções.`,
    desistiu: 'Tudo bem, o agendamento não foi feito.',
    ocupado: 'Esse horário acabou de ser reservado por outra pessoa. 😕 Escolha outro:',
    meus: 'Seus próximos agendamentos:',
    meusCancelar: 'Digite o número de um agendamento para *cancelar*, ou *0* para voltar.',
    semAgendamentos: 'Você não tem agendamentos marcados.',
    cancelarPergunta: (d) => `Cancelar o agendamento de *${d}*?\n\n1️⃣ Sim, cancelar\n2️⃣ Não`,
    cancelado: '❌ Agendamento cancelado.',
    info: (c) =>
      `📍 *${c.empresa}*\n${c.endereco}\n${c.mapa}\n\n🕗 Segunda a sexta: 8h–12h e 14h–18h\nSábado: 8h–12h`,
    humano: 'Certo! Um atendente vai responder você em breve. 🙂\n_Para voltar ao atendimento automático, digite *menu*._',
    voltar: '0️⃣ Voltar',
    as: 'às',
  },
  es: {
    menu: (nome) =>
      `¿Cómo puedo ayudarte${nome ? ', ' + nome : ''}?\n\n` +
      '1️⃣ Agendar una cita\n2️⃣ Mis citas\n3️⃣ Dirección y horario de atención\n4️⃣ Hablar con una persona\n\n' +
      '0️⃣ Cambiar idioma\n_Escribe *menu* en cualquier momento para volver aquí._',
    naoEntendi: 'No entendí 🤔. Responde con el *número* de una de las opciones.',
    servicos: '¿Qué servicio deseas?',
    dias: 'Elige el día:',
    semDias: 'No hay horarios libres en los próximos días. 😕 Escribe *4* en el menú para hablar con una persona.',
    horas: (dia) => `Horarios libres el *${dia}*:`,
    nome: '¿Cuál es el *nombre completo* de la persona que será atendida?',
    resumo: (n, s, d) => `Revisa tu cita:\n\n👤 ${n}\n📋 ${s}\n📅 ${d}\n\n1️⃣ Confirmar\n2️⃣ Cancelar`,
    confirmado: (d) => `✅ ¡Cita confirmada para el *${d}*!\nRecibirás un recordatorio un día antes.\n\nEscribe *menu* para otras opciones.`,
    desistiu: 'Está bien, la cita no fue agendada.',
    ocupado: 'Ese horario acaba de ser reservado por otra persona. 😕 Elige otro:',
    meus: 'Tus próximas citas:',
    meusCancelar: 'Escribe el número de una cita para *cancelarla*, o *0* para volver.',
    semAgendamentos: 'No tienes citas agendadas.',
    cancelarPergunta: (d) => `¿Cancelar la cita del *${d}*?\n\n1️⃣ Sí, cancelar\n2️⃣ No`,
    cancelado: '❌ Cita cancelada.',
    info: (c) =>
      `📍 *${c.empresa}*\n${c.endereco}\n${c.mapa}\n\n🕗 Lunes a viernes: 8h–12h y 14h–18h\nSábado: 8h–12h`,
    humano: '¡Listo! Una persona te responderá pronto. 🙂\n_Para volver a la atención automática, escribe *menu*._',
    voltar: '0️⃣ Volver',
    as: 'a las',
  },
  en: {
    menu: (nome) =>
      `How can I help you${nome ? ', ' + nome : ''}?\n\n` +
      '1️⃣ Book an appointment\n2️⃣ My appointments\n3️⃣ Address and opening hours\n4️⃣ Talk to a person\n\n' +
      '0️⃣ Change language\n_Type *menu* at any time to come back here._',
    naoEntendi: "Sorry, I didn't get that 🤔. Please reply with the *number* of an option.",
    servicos: 'Which service would you like?',
    dias: 'Choose the day:',
    semDias: 'There are no free times in the next few days. 😕 Type *4* in the menu to talk to a person.',
    horas: (dia) => `Free times on *${dia}*:`,
    nome: 'What is the *full name* of the person who will be seen?',
    resumo: (n, s, d) => `Please check your appointment:\n\n👤 ${n}\n📋 ${s}\n📅 ${d}\n\n1️⃣ Confirm\n2️⃣ Cancel`,
    confirmado: (d) => `✅ Appointment confirmed for *${d}*!\nYou will get a reminder one day before.\n\nType *menu* for other options.`,
    desistiu: 'No problem, the appointment was not booked.',
    ocupado: 'That time was just booked by someone else. 😕 Please choose another:',
    meus: 'Your upcoming appointments:',
    meusCancelar: 'Type the number of an appointment to *cancel* it, or *0* to go back.',
    semAgendamentos: "You don't have any appointments booked.",
    cancelarPergunta: (d) => `Cancel the appointment on *${d}*?\n\n1️⃣ Yes, cancel\n2️⃣ No`,
    cancelado: '❌ Appointment cancelled.',
    info: (c) =>
      `📍 *${c.empresa}*\n${c.endereco}\n${c.mapa}\n\n🕗 Monday to Friday: 8am–12pm and 2pm–6pm\nSaturday: 8am–12pm`,
    humano: 'Sure! A person will reply to you soon. 🙂\n_To go back to the automatic service, type *menu*._',
    voltar: '0️⃣ Back',
    as: 'at',
  },
};

const BOAS_VINDAS = () =>
  `Olá! 👋 Bem-vindo(a) à *${CONFIG.empresa}*.\n¡Hola! Bienvenido(a). · Hi! Welcome.\n\n` +
  'Escolha o idioma · Elige el idioma · Choose your language:\n\n1️⃣ Português\n2️⃣ Español\n3️⃣ English';

// ---------------------------------------------------------------------
// Datas: trabalhamos com o horário local como texto "AAAA-MM-DDTHH:MM"
// e fazemos as contas em UTC para não depender do fuso do servidor.
// ---------------------------------------------------------------------
const pad = (n) => String(n).padStart(2, '0');
const paraData = (iso) => new Date(iso.length === 10 ? iso + 'T00:00:00Z' : iso + ':00Z');
const paraIso = (d) =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
const somarMin = (iso, min) => paraIso(new Date(paraData(iso).getTime() + min * 60000));
const minutos = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

function rotuloDia(diaIso, idioma) {
  const d = paraData(diaIso.slice(0, 10));
  return `${DIAS[idioma][d.getUTCDay()]}, ${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}`;
}
const rotuloCompleto = (iso, idioma) => `${rotuloDia(iso, idioma)} ${T[idioma].as} ${iso.slice(11, 16)}`;

// Horários livres de um dia (AAAA-MM-DD)
function horariosLivres(dia, agora, ocupados) {
  const semana = paraData(dia).getUTCDay();
  const turnos = CONFIG.expediente[semana] || [];
  const limite = somarMin(agora, CONFIG.antecedenciaMin);
  const livres = [];
  for (const [ini, fim] of turnos) {
    for (let m = minutos(ini); m + CONFIG.duracaoSlotMin <= minutos(fim); m += CONFIG.duracaoSlotMin) {
      const iso = `${dia}T${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
      if (iso >= limite && !ocupados.includes(iso)) livres.push(iso);
    }
  }
  return livres;
}

// Próximos dias que ainda têm vaga
function diasComVaga(agora, ocupados) {
  const dias = [];
  for (let i = 0; i < 30 && dias.length < CONFIG.diasExibidos; i++) {
    const dia = somarMin(agora.slice(0, 10) + 'T00:00', i * 1440).slice(0, 10);
    if (horariosLivres(dia, agora, ocupados).length) dias.push(dia);
  }
  return dias;
}

const lista = (itens, idioma) =>
  itens.map((t, i) => `${i + 1}️⃣ ${t}`.replace(/^(\d{2,})️⃣/, '*$1.*')).join('\n') + `\n\n${T[idioma].voltar}`;

const normalizar = (s) =>
  String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const nomeServico = (s, idioma) => s[`nome_${idioma}`] || s.nome_pt;

// ---------------------------------------------------------------------
// Função principal
// ---------------------------------------------------------------------
function processar(e) {
  const texto = String(e.texto || '').trim();
  const cmd = normalizar(texto);
  const num = /^\d+$/.test(cmd) ? Number(cmd) : null;
  const ocupados = e.ocupados || [];
  const servicos = e.servicos || [];
  const meus = e.meus || [];

  const salvo = e.conversa || {};
  let idioma = salvo.idioma || null;
  let etapa = salvo.etapa || 'idioma';
  let dados = { ...(salvo.dados || {}) };
  let acao = null;
  const msgs = [];

  const t = () => T[idioma];
  const ir = (novaEtapa) => { etapa = novaEtapa; };
  const primeiroNome = () => String(dados.nome_cliente || e.nome || '').split(' ')[0];
  const mostrarMenu = () => { ir('menu'); msgs.push(t().menu(primeiroNome())); };
  const mostrarServicos = () => {
    ir('servico');
    msgs.push(`${t().servicos}\n\n${lista(servicos.map((s) => nomeServico(s, idioma)), idioma)}`);
  };
  const mostrarDias = () => {
    const dias = diasComVaga(e.agora, ocupados);
    if (!dias.length) { msgs.push(t().semDias); return mostrarMenu(); }
    dados.dias = dias;
    ir('dia');
    msgs.push(`${t().dias}\n\n${lista(dias.map((d) => rotuloDia(d, idioma)), idioma)}`);
  };
  const mostrarHoras = () => {
    const horas = horariosLivres(dados.dia, e.agora, ocupados);
    if (!horas.length) return mostrarDias();
    dados.horas = horas;
    ir('hora');
    msgs.push(`${t().horas(rotuloDia(dados.dia, idioma))}\n\n${lista(horas.map((h) => h.slice(11, 16)), idioma)}`);
  };
  const mostrarResumo = () => {
    const s = servicos.find((x) => x.id === dados.servico_id);
    ir('confirmar');
    msgs.push(t().resumo(dados.nome_cliente, s ? nomeServico(s, idioma) : '-', rotuloCompleto(dados.inicio, idioma)));
  };
  const mostrarMeus = () => {
    if (!meus.length) { msgs.push(t().semAgendamentos); return mostrarMenu(); }
    dados.meus = meus.map((a) => a.id);
    ir('meus');
    const linhas = meus.map((a, i) => {
      const s = servicos.find((x) => x.id === a.servico_id);
      return `${i + 1}️⃣ ${rotuloCompleto(a.inicio, idioma)}${s ? ' · ' + nomeServico(s, idioma) : ''}`;
    });
    msgs.push(`${t().meus}\n\n${linhas.join('\n')}\n\n${t().meusCancelar}`);
  };
  const invalido = (repetir) => { msgs.push(t().naoEntendi); repetir(); };
  const limparFluxo = () => {
    delete dados.dias; delete dados.horas; delete dados.dia; delete dados.inicio;
    delete dados.servico_id; delete dados.meus; delete dados.cancelar_id;
  };

  // --- Regras globais -------------------------------------------------
  const emHumano = etapa === 'humano' && (e.minutosDesdeUltima ?? 0) < CONFIG.humanoPausaMin;
  if (emHumano && cmd !== 'menu') {
    // Atendente humano está cuidando da conversa: o robô não responde.
    return { telefone: e.telefone, resposta: '', conversa: { idioma, etapa, dados }, acao };
  }
  if (['idioma', 'language', 'lenguaje'].includes(cmd) || !idioma) {
    ir('idioma');
  } else if (cmd === 'menu' || etapa === 'humano' ||
             (etapa !== 'menu' && (e.minutosDesdeUltima ?? 0) >= CONFIG.sessaoExpiraMin)) {
    // Comando "menu", fim da pausa do atendente ou conversa antiga: volta ao menu
    limparFluxo();
    mostrarMenu();
    return { telefone: e.telefone, resposta: msgs.join('\n\n'), conversa: { idioma, etapa, dados }, acao };
  }

  // --- Etapas ---------------------------------------------------------
  switch (etapa) {
    case 'idioma': {
      const escolha = { 1: 'pt', 2: 'es', 3: 'en' }[num] ||
        (/^(pt|portugues)/.test(cmd) ? 'pt' : /^(es|espanol)/.test(cmd) ? 'es' : /^(en|english|ingles)/.test(cmd) ? 'en' : null);
      // Primeira mensagem (ou pediu para trocar): mostra a escolha de idioma
      if (!escolha) { msgs.push(BOAS_VINDAS()); break; }
      idioma = escolha;
      limparFluxo();
      mostrarMenu();
      break;
    }

    case 'menu':
      if (num === 1) mostrarServicos();
      else if (num === 2) mostrarMeus();
      else if (num === 3) { msgs.push(t().info(CONFIG)); mostrarMenu(); }
      else if (num === 4) { ir('humano'); msgs.push(t().humano); }
      else if (num === 0) { ir('idioma'); msgs.push(BOAS_VINDAS()); }
      else invalido(mostrarMenu);
      break;

    case 'servico':
      if (num === 0) mostrarMenu();
      else if (num >= 1 && num <= servicos.length) { dados.servico_id = servicos[num - 1].id; mostrarDias(); }
      else invalido(mostrarServicos);
      break;

    case 'dia':
      if (num === 0) mostrarServicos();
      else if (num >= 1 && num <= (dados.dias || []).length) { dados.dia = dados.dias[num - 1]; mostrarHoras(); }
      else invalido(mostrarDias);
      break;

    case 'hora':
      if (num === 0) mostrarDias();
      else if (num >= 1 && num <= (dados.horas || []).length) {
        dados.inicio = dados.horas[num - 1];
        if (ocupados.includes(dados.inicio)) { msgs.push(t().ocupado); mostrarHoras(); }
        else if (dados.nome_cliente) mostrarResumo();
        else { ir('nome'); msgs.push(t().nome); }
      } else invalido(mostrarHoras);
      break;

    case 'nome':
      if (num === 0) mostrarHoras();
      else if (texto.length >= 3 && !/^\d+$/.test(texto)) { dados.nome_cliente = texto.slice(0, 80); mostrarResumo(); }
      else { msgs.push(t().nome); }
      break;

    case 'confirmar':
      if (num === 1) {
        if (ocupados.includes(dados.inicio)) { msgs.push(t().ocupado); mostrarHoras(); break; }
        acao = { tipo: 'agendar', servico_id: dados.servico_id, inicio: dados.inicio, nome: dados.nome_cliente };
        msgs.push(t().confirmado(rotuloCompleto(dados.inicio, idioma)));
        limparFluxo();
        ir('menu');
      } else if (num === 2) { msgs.push(t().desistiu); limparFluxo(); mostrarMenu(); }
      else invalido(mostrarResumo);
      break;

    case 'meus':
      if (num === 0) { limparFluxo(); mostrarMenu(); }
      else if (num >= 1 && num <= (dados.meus || []).length) {
        dados.cancelar_id = dados.meus[num - 1];
        const a = meus.find((x) => x.id === dados.cancelar_id);
        if (!a) { mostrarMeus(); break; }
        ir('cancelar');
        msgs.push(t().cancelarPergunta(rotuloCompleto(a.inicio, idioma)));
      } else invalido(mostrarMeus);
      break;

    case 'cancelar':
      if (num === 1) { acao = { tipo: 'cancelar', id: dados.cancelar_id }; msgs.push(t().cancelado); limparFluxo(); mostrarMenu(); }
      else if (num === 2) mostrarMeus();
      else invalido(mostrarMeus);
      break;

    default:
      limparFluxo();
      if (idioma) mostrarMenu(); else { ir('idioma'); msgs.push(BOAS_VINDAS()); }
  }

  return { telefone: e.telefone, resposta: msgs.join('\n\n'), conversa: { idioma, etapa, dados }, acao };
}

// Mensagens usadas pelos fluxos de lembrete
function textoLembrete(idioma, nome, servico, inicio) {
  const i = T[idioma] ? idioma : 'pt';
  const quando = rotuloCompleto(inicio, i);
  return {
    pt: `⏰ Lembrete: ${nome}, seu horário de *${servico}* na *${CONFIG.empresa}* está chegando: *${quando}*.\nSe não puder vir, responda *menu* e cancele em *Meus agendamentos*.`,
    es: `⏰ Recordatorio: ${nome}, tu cita de *${servico}* en *${CONFIG.empresa}* se acerca: *${quando}*.\nSi no puedes venir, responde *menu* y cancela en *Mis citas*.`,
    en: `⏰ Reminder: ${nome}, your *${servico}* appointment at *${CONFIG.empresa}* is coming up: *${quando}*.\nIf you can't make it, reply *menu* and cancel it in *My appointments*.`,
  }[i];
}

if (typeof module !== 'undefined') module.exports = { processar, textoLembrete, horariosLivres, diasComVaga, CONFIG };
