const fs = require('fs');
const path = require('path');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

const replacements = [
  ['Ol�, {firstName}', 'Olá, {firstName}'],
  ['Notifica����es', 'Notificações'],
  ['Notifica��es', 'Notificações'],
  ['Comunica��ǜo e financeiro', 'Comunicação e financeiro'],
  ['Comunica��o e financeiro', 'Comunicação e financeiro'],
  ['cobran��as', 'cobranças'],
  ['cobran�as', 'cobranças'],
  ['nǜo lida(s)', 'não lida(s)'],
  ['Solicita����es', 'Solicitações'],
  ['Solicita��es', 'Solicitações'],
  ['A����es rǭpidas', 'Ações rápidas'],
  ['A��es rǭpidas', 'Ações rápidas'],
  ['Sess��es (7 dias)', 'Sessões (7 dias)'],
  ['Sess��es totais', 'Sessões totais'],
  ['Sess��es conclu��das nos ǧltimos 7 dias', 'Sessões concluídas nos últimos 7 dias'],
  ['Sess��es', 'Sessões'],
  ['SessǦes', 'Sessões'],
  ['Precisa de aten��ǜo', 'Precisa de atenção'],
  ['Sem treino nos ǧltimos 7 dias', 'Sem treino nos últimos 7 dias'],
  ['Todos os alunos treinaram nos ǧltimos 7 dias.', 'Todos os alunos treinaram nos últimos 7 dias.'],
  ['Central de a����es', 'Central de ações'],
  ['Acesso rǭpido ��s principais ferramentas', 'Acesso rápido às principais ferramentas'],
  ['�sltimos treinos', 'Últimos treinos'],
  ['conclu��rem treinos, eles aparecerǜo aqui.', 'concluírem treinos, eles aparecerão aqui.'],
  ['sess��es', 'sessões'],
  ['sǟ��ries', 'séries'],
  ['exerc��cios', 'exercícios'],
  ['exerc��cio(s)', 'exercício(s)'],
  ['divisǜo(��es)', 'divisões'],
  ['divis��es', 'divisões'],
  ['nos ǧltimos 7 dias', 'nos últimos 7 dias'],
  ['ǧltimos 7 dias', 'últimos 7 dias'],
  ['Seu personal ainda nǜo montou um treino para vocǦ. Fale com ele para come��ar.', 'Seu personal ainda não montou um treino para você. Fale com ele para começar.'],
  ['Sugestǜo', 'Sugestão'],
  ['poderǭ ver', 'poderá ver'],
  ['esta ǭrea', 'esta área'],
  ['Feedback, solicita����es e mensalidades', 'Feedback, solicitações e mensalidades'],
  ['SUA EVOLU��ǟO', 'SUA EVOLUÇÃO'],
  ['sequǦncia', 'sequência'],
  ['Este mǦs', 'Este mês'],
  ['conclu��dos nos ǧltimos 7 dias', 'concluídos nos últimos 7 dias'],
  ['Treino nǜo encontrado.', 'Treino não encontrado.'],
  ['Treino n�o encontrado.', 'Treino não encontrado.'],
  ['Treino conclu��do!', 'Treino concluído!'],
  ['Treino conclu�do!', 'Treino concluído!'],
  ['exerc��cios marcados', 'exercícios marcados'],
  ['exerc��cios conclu��dos', 'exercícios concluídos'],
  ['Sessǜo registrada', 'Sessão registrada'],
  ['jǭ pode', 'já pode'],
  ['hist��rico', 'histórico'],
  ['Hist��rico', 'Histórico'],
  ['orienta����es', 'orientações'],
  ['confirma��ǜo', 'confirmação'],
  ['defini��ǜo', 'definição'],
  ['avalia��ǜo', 'avaliação'],
  ['avalia��ǜo', 'avaliação'],
  ['jǭ estǭ', 'já está'],
  ['dispon��veis', 'disponíveis'],
  ['Permissǜo de notifica����es negada. Ative nas configura����es do sistema.', 'Permissão de notificações negada. Ative nas configurações do sistema.'],
  ['Lembrete diǭrio', 'Lembrete diário'],
  ['diǭrio', 'diário'],
  ['Horǭrio', 'Horário'],
  ['horǭrio', 'horário'],
  ['dǧvidas', 'dúvidas'],
  ['Ǹ criado', 'é criado'],
  ['Ǹ enviado', 'é enviado'],
  ['Pe��a', 'Peça'],
  ['nǜo conferem', 'não conferem'],
  ['notifica����es locais', 'notificações locais'],
  ['Nǜo foi poss��vel atualizar o horǭrio.', 'Não foi possível atualizar o horário.'],
  ['Cobran��a criada. O aluno verǭ o lembrete no app.', 'Cobrança criada. O aluno verá o lembrete no app.'],
  ['Nova cobran��a', 'Nova cobrança'],
  ['Cobran�as', 'Cobranças'],
  ['Nenhuma cobran�a', 'Nenhuma cobrança'],
  ['Nenhuma cobran��a', 'Nenhuma cobrança'],
  ['Crie cobran�as', 'Crie cobranças'],
  ['Crie cobran��as', 'Crie cobranças'],
  ['Descri��ǜo', 'Descrição'],
  ['aparecerǭ aqui', 'aparecerá aqui'],
  ['aparecerǜo aqui', 'aparecerão aqui'],
  ['conclu��rem', 'concluírem'],
  ['conclu��dos', 'concluídos'],
  ['conclu��das', 'concluídas'],
  ['come��ar', 'começar'],
  ['Acesso rǭpido', 'Acesso rápido'],
  ['In��cio', 'Início'],
  [' �?� ', ' • '],
];

const files = walk(path.join(__dirname, '..', 'src'));
let changed = 0;
for (const f of files) {
  let c = fs.readFileSync(f, 'utf8');
  const o = c;
  for (const [a, b] of replacements) c = c.split(a).join(b);
  if (c !== o) {
    fs.writeFileSync(f, c, 'utf8');
    changed++;
    console.log('fixed', path.relative(process.cwd(), f));
  }
}
console.log('changed', changed);
