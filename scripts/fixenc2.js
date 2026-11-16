const fs=require('fs'), path=require('path');
function walk(d,cb){if(!fs.existsSync(d))return; for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name); if(e.isDirectory())walk(p,cb); else cb(p);}}
function fixStr(s){
  // fix broken template literals from bad replace
  s=s.replace(/router\.push\(\(\/personal\/aluno\/\\\) as never\)/g, "router.push({ pathname: '/personal/aluno/[id]', params: { id: session?.student_id ?? student?.id ?? '' } } as never)");
  const pairs=[
    [/Ã§/g,'ç'],[/Ã£/g,'ã'],[/Ã¡/g,'á'],[/Ã©/g,'é'],[/Ãª/g,'ê'],[/Ã­/g,'í'],[/Ã³/g,'ó'],[/Ã´/g,'ô'],[/Ãµ/g,'õ'],[/Ãº/g,'ú'],[/Ã/g,'Á'],[/Ã‰/g,'É'],[/Ã"/g,'Ó'],[/Ãš/g,'Ú'],[/Ã‡/g,'Ç'],[/Ã‡/g,'Ç'],[/Â /g,' '],[/Â/g,'']
  ];
  for(const [a,b] of pairs) s=s.replace(a,b);
  const rep=[
    ['Comunica��o','Comunicação'],['comunica��o','comunicação'],['Comunicaç��o','Comunicação'],
    ['cobran�as','cobranças'],['Cobran�as','Cobranças'],
    ['Notifica����es','Notificações'],['Notifica��es','Notificações'],['notifica��es','notificações'],
    ['Central de a��es','Central de ações'],['A����es rǭpidas','Ações rápidas'],['Ações rǭpidas','Ações rápidas'],['Ações rápidas','Ações rápidas'],
    ['Acesso r�pido �s principais ferramentas','Acesso rápido às principais ferramentas'],['Acesso rǭpido','Acesso rápido'],['r�pido','rápido'],['rǭpida','rápida'],
    ['Sess�es','Sessões'],['sess�o','sessão'],['sessǜo','sessão'],['sessǜo(ões)','sessão(ões)'],['sessǜo(es)','sessão(ões)'],
    ['Hist�rico','Histórico'],['hist�rico','histórico'],
    ['Informa��es','Informações'],['informa��es','informações'],
    ['Observa��es','Observações'],['observa��o','observação'],['observa��ǜo','observação'],
    ['Avalia��es','Avaliações'],['Avalia��o','Avaliação'],['avalia��o','avaliação'],['avalia��ǜo','avaliação'],
    ['evolu��o','evolução'],['evolu��ǜo','evolução'],
    ['Anota��es','Anotações'],['Anota����es','Anotações'],
    ['Solicita��es','Solicitações'],['Solicita����es','Solicitações'],['solicita��ǜo','solicitação'],['solicita��o','solicitação'],
    ['sugest��es','sugestões'],['Sugest��o','Sugestão'],['Sugestǜo','Sugestão'],
    ['Dura��o','Duração'],['dura��o','duração'],
    ['�ltima','Última'],['�ltimos','últimos'],['�ltimo','Último'],['�sltima','Última'],['ǧltimos','últimos'],
    ['n�o','não'],['N�o','Não'],['nǜo','não'],['Nǜo','Não'],
    ['Reabilita��o','Reabilitação'],['Hipertens�o','Hipertensão'],['depress�o','depressão'],['Les�o','Lesão'],['les�o','lesão'],
    ['sa�de','saúde'],['Sa�de','Saúde'],['libera��o','liberação'],['m�dica','médica'],
    ['confirma��o','confirmação'],['recupera��o','recuperação'],['redefini��o','redefinição'],
    ['op��o','opção'],['op��es','opções'],['aten��o','atenção'],['aten��ǜo','atenção'],
    ['Voc�','Você'],['voc�','você'],['J�','Já'],['j�','já'],['pr�pria','própria'],['pr�prio','próprio'],['pr�xim','próxim'],
    ['frequ�ncia','frequência'],['in�cio','início'],['In�cio','Início'],['In��cio','Início'],
    ['configura��es','configurações'],['Configura��es','Configurações'],['usu�rio','usuário'],
    ['Hǭ','Há'],['nos �ltimos','nos últimos'],['n�mero','número'],['v�nculo','vínculo'],['m�dia','média'],
    ['exerc�cio','exercício'],['Exerc�cio','Exercício'],['exerc�cios','exercícios'],['s�rie','série'],['s�ries','séries'],
    ['conclu�do','concluído'],['conclu�da','concluída'],['Conclu�do','Concluído'],
    ['parab�ns','parabéns'],['necess�rio','necessário'],['inv�lido','inválido'],['per�odo','período'],['descri��o','descrição'],
    ['Alimenta��o','Alimentação'],['alimenta��o','alimentação'],
    ['�?�','•'],['�?"','-'],['�ǜ','ã']
  ];
  for(const [a,b] of rep) s=s.split(a).join(b);
  return s;
}
let n=0;
walk('src',(p)=>{ if(!/\.(ts|tsx)$/.test(p)) return; const s=fs.readFileSync(p,'utf8'); const t=fixStr(s); if(t!==s){fs.writeFileSync(p,t,'utf8'); console.log('fixed',p); n++;}});
console.log('total',n);
