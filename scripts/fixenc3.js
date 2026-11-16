const fs=require('fs'), path=require('path');
function walk(d,cb){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name); if(e.isDirectory())walk(p,cb); else cb(p);}}
const rep=[
  ['Reabilita��o','Reabilitação'],['Hipertens�o','Hipertensão'],['Ansiedade ou depress�o','Ansiedade ou depressão'],['Les�o articular','Lesão articular'],
  ['Les�o','Lesão'],['les�o','lesão'],
  ["['N�o', 'Sim']","['Não', 'Sim']"],["['Sim', 'N�o', 'N�o sei']","['Sim', 'Não', 'Não sei']"],
  ["'N�o sigo dieta'","'Não sigo dieta'"],['Por conta pr�pria','Por conta própria'],["'N�o bebo'","'Não bebo'"],['Com frequ�ncia','Com frequência'],
  ['Convite n�o encontrado','Convite não encontrado'],['As senhas n�o conferem','As senhas não conferem'],['As senhas nǜo conferem','As senhas não conferem'],
  ['Selecione ao menos uma op��o de sa�de','Selecione ao menos uma opção de saúde'],['op��o','opção'],['op��es','opções'],['sa�de','saúde'],['Sa�de','Saúde'],
  ['N�o foi poss�vel','Não foi possível'],['n�o foi poss�vel','não foi possível'],
  ['confirma��o','confirmação'],['recupera��o','recuperação'],['redefini��o','redefinição'],
  ['alimenta��o','alimentação'],['Alimenta��o','Alimentação'],
  ['Voc� tem alguma condi��o de sa�de?','Você tem alguma condição de saúde?'],['Voc�','Você'],['voc�','você'],['condi��o','condição'],
  ['J� quebrou algum osso ou teve les�o grave?','Já quebrou algum osso ou teve lesão grave?'],['J�','Já'],['j�','já'],
  ['Tem libera��o m�dica para treinar?','Tem liberação médica para treinar?'],['libera��o','liberação'],['m�dica','médica'],
  ['hipertens�o controlada, labirintite, ansiedade','hipertensão controlada, labirintite, ansiedade'],
  ['Como voc� avalia sua alimenta��o?','Como você avalia sua alimentação?'],
  ['Supabase n�o configurado','Supabase não configurado'],
  ['N�o informado','Não informado'],['n�o informado','não informado'],
  ['Informa��es de cadastro e v�nculo','Informações de cadastro e vínculo'],['v�nculo','vínculo'],
  ['Sess�es','Sessões'],['Sessǜes','Sessões'],['sess�o','sessão'],['sessǜo','sessão'],
  ['Dura��o m�dia','Duração média'],['Dura��o','Duração'],['dura��o','duração'],
  ['�ltima atividade','Última atividade'],['�ltima','Última'],['�ltimos','últimos'],['�sltima','Última'],['ǧltimos','últimos'],
  ['Avalia��es f�sicas','Avaliações físicas'],['Avalia��o','Avaliação'],['avalia��o','avaliação'],['evolu��o corporal','evolução corporal'],['evolu��o','evolução'],
  ['Nova avalia��o','Nova avaliação'],['Salvar avalia��o','Salvar avaliação'],['Notas da avalia��o','Notas da avaliação'],
  ['Bra�o (cm)','Braço (cm)'],['Observa��es','Observações'],['Observa����es','Observações'],['observa��o','observação'],
  ['Hist�rico recente','Histórico recente'],['Hist�rico','Histórico'],['hist�rico','histórico'],
  ['Anota��es privadas sobre o aluno','Anotações privadas sobre o aluno'],['Anota����es privadas sobre o aluno','Anotações privadas sobre o aluno'],['Anota��es','Anotações'],
  ['Escreva uma observa��ǜo','Escreva uma observação'],['Escreva uma observa��o','Escreva uma observação'],
  ['Preencha ao menos um campo da avalia��o','Preencha ao menos um campo da avaliação'],
  ['Enviar feedback, solicita����es e mensalidades','Enviar feedback, solicitações e mensalidades'],['solicita����es','solicitações'],['Solicita����es','Solicitações'],['Solicita��es','Solicitações'],
  ['Solicita����es e sugest��es para seu personal','Solicitações e sugestões para seu personal'],['sugest��es','sugestões'],['Sugestǜo','Sugestão'],['Sugest�o','Sugestão'],
  ['Descreva seu feedback ou solicita��ǜo','Descreva seu feedback ou solicitação'],['solicita��ǜo','solicitação'],
  ['Nenhuma cobran��a registrada','Nenhuma cobrança registrada'],['cobran��a','cobrança'],
  ['Hist��rico de solicita����es enviadas','Histórico de solicitações enviadas'],
  ['Seus feedbacks enviados aparecerǜo aqui','Seus feedbacks enviados aparecerão aqui'],['aparecerǜo','aparecerão'],
  ['poderǭ ver','poderá ver'],['poder�','poderá'],['esta ǭrea','esta área'],['ǭrea','área'],
  ['Notifica����es','Notificações'],['Notifica��es','Notificações'],
  ['Comunica��o e financeiro','Comunicação e financeiro'],['cobran�as','cobranças'],
  ['Central de a��es','Central de ações'],['Acesso r�pido �s principais ferramentas','Acesso rápido às principais ferramentas'],['Acesso rǭpido','Acesso rápido'],
  ['Precisa de aten��o','Precisa de atenção'],['aten��o','atenção'],['aten��ǜo','atenção'],
  ['n�o lida(s)','não lida(s)'],['nǜo lida(s)','não lida(s)'],
  ['Hǭ','Há'],['�?�','•'],['�?"','-'],
  ['In��cio','Início'],['nos �ltimos 7 dias','nos últimos 7 dias'],
  ['cria a pr��pria senha','cria a própria senha'],['pr��pria','própria'],
  ['Aluno n�o encontrado','Aluno não encontrado'],
  ['n�o encontrada','não encontrada'],['N�o encontrada','Não encontrada'],
  ['exerc�cio','exercício'],['Exerc�cio','Exercício'],['exerc�cios','exercícios'],['s�rie','série'],['s�ries','séries'],
  ['conclu�do','concluído'],['conclu�da','concluída'],
  ['necess�rio','necessário'],['inv�lido','inválido'],['per�odo','período'],['descri��o','descrição'],
  ['m�s','mês'],['M�s','Mês'],['b�sico','básico'],['f�sica','física'],['f�sicas','físicas'],['m�dia','média'],['n�mero','número'],
  ['configura��es','configurações'],['Configura��es','Configurações'],['relat�rio','relatório'],['usu�rio','usuário'],
  ['sessão(ões)','sessões'],
];
let n=0;
walk('src',(p)=>{
  if(!/\.(ts|tsx)$/.test(p)) return;
  let s=fs.readFileSync(p,'utf8'); let o=s;
  for(const [a,b] of rep) s=s.split(a).join(b);
  s=s.replace(/Ã§/g,'ç').replace(/Ã£/g,'ã').replace(/Ã¡/g,'á').replace(/Ã©/g,'é').replace(/Ãª/g,'ê').replace(/Ã­/g,'í').replace(/Ã³/g,'ó').replace(/Ã´/g,'ô').replace(/Ãº/g,'ú').replace(/Ã‰/g,'É').replace(/Ã"/g,'Ó').replace(/Ã‡/g,'Ç').replace(/Â/g,'');
  if(s!==o){fs.writeFileSync(p,t='utf8'?s:s); fs.writeFileSync(p,s,'utf8'); console.log('fixed',p); n++;}
});
console.log('total',n);
