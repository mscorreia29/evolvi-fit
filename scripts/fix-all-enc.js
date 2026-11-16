const fs=require('fs'), path=require('path');

function walk(d, cb){
  if(!fs.existsSync(d)) return;
  for(const e of fs.readdirSync(d,{withFileTypes:true})){
    const p=path.join(d,e.name);
    if(e.isDirectory()) walk(p,cb); else cb(p);
  }
}

const map = {
  'Ã¡':'á','Ã ':'à','Ã¢':'â','Ã£':'ã','Ã¤':'ä',
  'Ã©':'é','Ã¨':'è','Ãª':'ê','Ã«':'ë',
  'Ã­':'í','Ã¬':'ì','Ã®':'î','Ã¯':'ï',
  'Ã³':'ó','Ã²':'ò','Ã´':'ô','Ãµ':'õ','Ã¶':'ö',
  'Ãº':'ú','Ã¹':'ù','Ã»':'û','Ã¼':'ü',
  'Ã§':'ç','Ã':'Á','Ã€':'À','Ã‰':'É','ÃŠ':'Ê','Ã':'Í','Ã“':'Ó','Ã”':'Ô','Ã•':'Õ','Ãš':'Ú','Ã‡':'Ç',
  'Âº':'º','Âª':'ª','Â·':'·','Â':''
};
const specific = [
  ['Comunica��o','Comunicação'],['ComunicaÃ§Ã£o','Comunicação'],['comunica��o','comunicação'],
  ['Notifica����es','Notificações'],['Notifica��es','Notificações'],['NotificaÃ§Ãµes','Notificações'],
  ['Central de a��es','Central de ações'],['A����es rǭpidas','Ações rápidas'],['Ações rǭpidas','Ações rápidas'],['A��es rǭpidas','Ações rápidas'],
  ['Acesso r�pido �s principais ferramentas','Acesso rápido às principais ferramentas'],['Acesso rǭpido','Acesso rápido'],['r�pido','rápido'],['r�pida','rápida'],['rǭpido','rápido'],
  ['cobran�as','cobranças'],['Cobran�as','Cobranças'],
  ['Sess�es','Sessões'],['sess�o','sessão'],['sessǜo','sessão'],['sessões','sessões'],
  ['Hist�rico','Histórico'],['hist�rico','histórico'],
  ['Informa��es','Informações'],['informa��es','informações'],['Informa����es','Informações'],
  ['Observa��es','Observações'],['observa��o','observação'],['observa��ǜo','observação'],['Observa����es','Observações'],
  ['Avalia��es','Avaliações'],['Avalia��o','Avaliação'],['avalia��o','avaliação'],['avalia��ǜo','avaliação'],['Avalia����es','Avaliações'],
  ['evolu��o','evolução'],['evolu��ǜo','evolução'],
  ['Anota��es','Anotações'],['Anota����es','Anotações'],['Anotações privadas','Anotações privadas'],
  ['Solicita��es','Solicitações'],['Solicita����es','Solicitações'],['solicita��ǜo','solicitação'],['solicita��o','solicitação'],
  ['sugest��es','sugestões'],['Sugest��o','Sugestão'],['Sugestǜo','Sugestão'],['Sugestão','Sugestão'],
  ['Dura��o','Duração'],['dura��o','duração'],
  ['�ltima','Última'],['�ltimos','últimos'],['�ltimo','Último'],['�sltima','Última'],['�ltimas','últimas'],['ǧltimos','últimos'],
  ['n�o','não'],['N�o','Não'],['nǜo','não'],['Nǜo','Não'],
  ['Reabilita��o','Reabilitação'],['Hipertens�o','Hipertensão'],['depress�o','depressão'],['Les�o','Lesão'],['les�o','lesão'],
  ['sa�de','saúde'],['Sa�de','Saúde'],
  ['confirma��o','confirmação'],['recupera��o','recuperação'],['redefini��o','redefinição'],
  ['op��o','opção'],['op��es','opções'],
  ['Voc�','Você'],['voc�','você'],['J�','Já'],['j�','já'],
  ['libera��o','liberação'],['m�dica','médica'],
  ['frequ�ncia','frequência'],['pr�pria','própria'],
  ['N�o foi poss�vel','Não foi possível'],['n�o foi poss�vel','não foi possível'],
  ['Convite n�o encontrado','Convite não encontrado'],
  ['est�','está'],['at�','até'],['f�cil','fácil'],['Pr�xim','Próxim'],['pr�xim','próxim'],['pr�ximo','próximo'],
  ['in�cio','início'],['In�cio','Início'],['In��cio','Início'],
  ['configura��es','configurações'],['Configura��es','Configurações'],
  ['usu�rio','usuário'],['relat�rio','relatório'],
  ['Hǭ','Há'],['H�','Há'],['nos �ltimos','nos últimos'],
  ['sessǜo','sessão'],['�?�','•'],['�?"','-'],
  ['exerc�cio','exercício'],['Exerc�cio','Exercício'],['exerc�cios','exercícios'],
  ['s�rie','série'],['s�ries','séries'],
  ['conclu�do','concluído'],['conclu�da','concluída'],['Conclu�do','Concluído'],
  ['parab�ns','parabéns'],['Parab�ns','Parabéns'],
  ['aten��o','atenção'],['aten��ǜo','atenção'],
  ['n�mero','número'],['N�mero','Número'],
  ['dispon�vel','disponível'],['indispon�vel','indisponível'],
  ['pr�tica','prática'],['necess�rio','necessário'],
  ['inv�lido','inválido'],['Inv�lido','Inválido'],
  ['per�odo','período'],['descri��o','descrição'],
  ['Alimenta��o','Alimentação'],['alimenta��o','alimentação'],
  ['v�nculo','vínculo'],['m�dia','média'],['M�dia','Média'],
  ['pr�prios','próprios'],['hist�ria','história'],
];

function fix(s){
  let o=s;
  for(const [k,v] of Object.entries(map)) s=s.split(k).join(v);
  for(const [a,b] of specific) s=s.split(a).join(b);
  // second pass for double-encoded leftovers
  s=s.replace(/Ã§/g,'ç').replace(/Ã£/g,'ã').replace(/Ã¡/g,'á').replace(/Ã©/g,'é').replace(/Ãª/g,'ê').replace(/Ã­/g,'í').replace(/Ã³/g,'ó').replace(/Ã´/g,'ô').replace(/Ãº/g,'ú').replace(/Ã‰/g,'É').replace(/Ã"/g,'Ó').replace(/Ã‡/g,'Ç').replace(/Â/g,'');
  return s;
}

let count=0;
walk('src', (p)=>{
  if(!/\.(ts|tsx|js)$/.test(p)) return;
  let s=fs.readFileSync(p,'utf8');
  let t=fix(s);
  if(t!==s){ fs.writeFileSync(p,t,'utf8'); console.log('fixed',p); count++; }
});
console.log('changed',count);
