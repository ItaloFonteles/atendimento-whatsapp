
// --- Nó "Montar lembretes": um item por agendamento, no idioma do cliente ---
const modoTeste = String($env.MODO_TESTE).toLowerCase() === 'true';

return $input.all()
  .filter((i) => i.json.id)
  .map(({ json: a }) => {
    const servico = a[`nome_${a.idioma}`] || a.nome_pt;
    return {
      json: {
        telefone: a.telefone,
        resposta: textoLembrete(a.idioma, String(a.nome || '').split(' ')[0], servico, a.inicio),
        enviar: !modoTeste,
      },
    };
  });
