const fs=require('fs'),path=require('path');
function walk(d,cb){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name); if(e.isDirectory())walk(p,cb); else cb(p);}}
const reps = [
['Comunica��o','Comunicação'],['comunica��o','comunicação'],
['cobran�as','cobranças'],['Cobran�a','Cobrança'],['cobran�a','cobrança'],
['Notifica��es','Notificações'],['Notifica��o','Notificação'],['notifica��o','notificação'],['notifica��es','notificações'],
['Acesso r�pido �s principais ferramentas','Acesso rápido às principais ferramentas'],['Acesso r�pido','Acesso rápido'],['r�pido','rápido'],['r�pida','rápida'],
['Central de a��es','Central de ações'],['A��es r�pidas','Ações rápidas'],['A��es','Ações'],['a��es','ações'],['a��o','ação'],
['Solicita��es','Solicitações'],['solicita��es','solicitações'],['Solicita��o','Solicitação'],['solicita��o','solicitação'],
['Informa��es','Informações'],['informa��es','informações'],['Informa��o','Informação'],['informa��o','informação'],
['Observa��es','Observações'],['observa��es','observações'],['Observa��o','Observação'],['observa��o','observação'],
['Avalia��es','Avaliações'],['avalia��es','avaliações'],['Avalia��o','Avaliação'],['avalia��o','avaliação'],
['evolu��o','evolução'],['Evolu��o','Evolução'],
['Anota��es','Anotações'],['anota��es','anotações'],['Anota��o','Anotação'],['anota��o','anotação'],
['Sess�es','Sessões'],['sess�es','sessões'],['Sess�o','Sessão'],['sess�o','sessão'],
['Dura��o','Duração'],['dura��o','duração'],
['Hist�rico','Histórico'],['hist�rico','histórico'],
['�ltima','Última'],['�ltimo','Último'],['�ltimos','últimos'],['�ltimas','últimas'],
['In�cio','Início'],['in�cio','início'],
['n�o','não'],['N�o','Não'],
['Reabilita��o','Reabilitação'],['Hipertens�o','Hipertensão'],['depress�o','depressão'],['Les�o','Lesão'],['les�o','lesão'],
['sa�de','saúde'],['Sa�de','Saúde'],
['confirma��o','confirmação'],['recupera��o','recuperação'],['redefini��o','redefinição'],['libera��o','liberação'],
['op��o','opção'],['op��es','opções'],['condi��o','condição'],['condi��es','condições'],
['Voc�','Você'],['voc�','você'],['J�','Já'],['j�','já'],
['m�dica','médica'],['m�dico','médico'],['frequ�ncia','frequência'],['pr�pria','própria'],['pr�prio','próprio'],['pr�prios','próprios'],
['n�o foi poss�vel','não foi possível'],['N�o foi poss�vel','Não foi possível'],
['n�o encontrado','não encontrado'],['N�o encontrado','Não encontrado'],['n�o encontrada','não encontrada'],
['n�o configurado','não configurado'],['N�o configurado','Não configurado'],
['n�o conferem','não conferem'],['n�o informado','não informado'],['N�o informado','Não informado'],['n�o sei','não sei'],
['N�o bebo','Não bebo'],['N�o sigo','Não sigo'],
['v�nculo','vínculo'],['n�mero','número'],['per�odo','período'],['usu�rio','usuário'],
['configura��es','configurações'],['Configura��es','Configurações'],['relat�rio','relatório'],
['exerc�cio','exercício'],['Exerc�cio','Exercício'],['exerc�cios','exercícios'],
['s�rie','série'],['s�ries','séries'],
['conclu�do','concluído'],['Conclu�do','Concluído'],['conclu�da','concluída'],
['necess�rio','necessário'],['inv�lido','inválido'],['Inv�lido','Inválido'],
['m�dia','média'],['M�dia','Média'],['m�s','mês'],['M�s','Mês'],
['b�sico','básico'],['f�sica','física'],['f�sicas','físicas'],['f�sico','físico'],
['aten��o','atenção'],['descri��o','descrição'],['alimenta��o','alimentação'],['Alimenta��o','Alimentação'],
['Bra�o','Braço'],['bra�o','braço'],['pr�xima','próxima'],['pr�ximo','próximo'],
['Sugest�o','Sugestão'],['sugest�o','sugestão'],['sugest�es','sugestões'],
['aparecer�o','aparecerão'],['aparecer�','aparecerá'],['poder�','poderá'],['�rea','área'],
['cria a pr�pria senha','cria a própria senha'],['h� ','há '],['H� ','Há '],['est�','está'],
['�?�','•'],['�?"','-'],['�ǜ','ã'],['��es','ões'],['��o','ão'],['��','ç']
];
let n=0;
walk('src',(p)=>{
  if(!/\.(ts|tsx)$/.test(p)) return;
  let s=fs.readFileSync(p,'utf8'), o=s;
  for(const [a,b] of reps) s=s.split(a).join(b);
  if(s!==o){fs.writeFileSync(p,s,'utf8'); console.log('fixed',p); n++;}
});
console.log('total',n);
