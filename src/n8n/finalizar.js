// Nó "Finalizar": ajusta a resposta se o horário foi ocupado no último segundo e decide se envia
const r = $('Motor de conversa').first().json;
const gravado = $input.first().json;
let resposta = r.resposta;

if (r.acao && r.acao.tipo === 'agendar' && !gravado.agendamento_id) {
  resposta = {
    pt: 'Esse horário acabou de ser reservado por outra pessoa. 😕\nDigite *1* para escolher outro.',
    es: 'Ese horario acaba de ser reservado por otra persona. 😕\nEscribe *1* para elegir otro.',
    en: 'That time was just booked by someone else. 😕\nType *1* to choose another one.',
  }[r.conversa.idioma || 'pt'];
}

const modoTeste = String($env.MODO_TESTE).toLowerCase() === 'true';
return [{ json: { telefone: r.telefone, resposta, enviar: !modoTeste && resposta !== '' } }];
