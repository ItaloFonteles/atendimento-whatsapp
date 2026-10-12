// Nó "Montar resumo": agenda do dia para o dono, em português
const ags = $input.all().map((i) => i.json).filter((a) => a.id);
const hoje = $now.setZone('America/Boa_Vista').setLocale('pt-BR').toFormat('cccc, dd/MM');

const linhas = ags.map((a) => `• ${a.hora} · ${a.nome || '(sem nome)'} · ${a.servico} · ${String(a.idioma).toUpperCase()}`);
const resposta = ags.length
  ? `📋 *Agenda de hoje* (${hoje}): ${ags.length} atendimento(s)\n\n${linhas.join('\n')}`
  : `📋 *Agenda de hoje* (${hoje}): nenhum atendimento marcado.`;

const modoTeste = String($env.MODO_TESTE).toLowerCase() === 'true';
const telefone = String($env.DONO_TELEFONE || '').replace(/\D/g, '');
return [{ json: { telefone, resposta, enviar: !modoTeste && telefone.length >= 12 } }];
