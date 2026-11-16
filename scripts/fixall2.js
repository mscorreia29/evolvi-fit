const fs=require('fs'), path=require('path');
function walk(d,cb){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name); if(e.isDirectory())walk(p,cb); else cb(p);}}
const reps=[
  ["router.navigate(`/personal/aluno/${student.id}` as never)","router.push({ pathname: '/personal/aluno/[id]', params: { id: student.id } } as never)"],
  ['label="Sess�es registradas"','label="Sessões registradas"'],['sess�es','sessões'],['sess�o','sessão'],
  ['cria a pr�pria senha','cria a própria senha'],['pr�pria','própria'],
  ['nos �ltimos 7 dias','nos últimos 7 dias'],['�ltimos','últimos'],
  ['sessǜo(ões)','sessão(ões)'],['sessão(ões)','sessões'],[' �?� ',' • ']
];
let n=0;
walk('src',(p)=>{
  if(!/\.(ts|tsx)$/.test(p)) return;
  let s=fs.readFileSync(p,'utf8'), o=s;
  // try to fix double-encoded UTF8 sequences like Ã§Ã£o -> ção
  try{
    if(/[ÃÂ]/.test(s)){
      const t=Buffer.from(s,'latin1').toString('utf8');
      if(!/\uFFFD/.test(t)) s=t;
    }
  }catch(e){}
  for(const [a,b] of reps) s=s.split(a).join(b);
  // fix U+FFFD replacement char common mojibake leftovers
  s=s.replace(/Comunica.{0,3}o e financeiro/g,'Comunicação e financeiro')
     .replace(/cobran.{0,3}as/g,'cobranças')
     .replace(/Notifica.{0,4}es/g,'Notificações')
     .replace(/notifica.{0,4}es/g,'notificações')
     .replace(/Central de a.{0,4}es/g,'Central de ações')
     .replace(/A.{0,4}es r.{0,3}pidas/g,'Ações rápidas')
     .replace(/Acesso r.{0,3}pido .{0,2}s principais ferramentas/g,'Acesso rápido às principais ferramentas')
     .replace(/Solicita.{0,4}es/g,'Solicitações')
     .replace(/solicita.{0,4}o/g,'solicitação')
     .replace(/Informa.{0,4}es/g,'Informações')
     .replace(/Observa.{0,4}es/g,'Observações')
     .replace(/observa.{0,4}o/g,'observação')
     .replace(/Avalia.{0,4}es/g,'Avaliações')
     .replace(/Avalia.{0,4}o/g,'Avaliação')
     .replace(/avalia.{0,4}o/g,'avaliação')
     .replace(/evolu.{0,4}o/g,'evolução')
     .replace(/Anota.{0,4}es/g,'Anotações')
     .replace(/Sess.{0,4}es/g,'Sessões')
     .replace(/sess.{0,4}o/g,'sessão')
     .replace(/Dura.{0,4}o/g,'Duração')
     .replace(/dura.{0,4}o/g,'duração')
     .replace(/Hist.{0,3}rico/g,'Histórico')
     .replace(/hist.{0,3}rico/g,'histórico')
     .replace(/.{0,1}ltima/g,(m)=>m.includes('Última')?m:'Última')
     .replace(/.{0,1}ltimos/g,(m)=>m.includes('últimos')?m:'últimos')
     .replace(/In.{0,3}cio/g,'Início')
     .replace(/Reabilita.{0,4}o/g,'Reabilitação')
     .replace(/Hipertens.{0,3}o/g,'Hipertensão')
     .replace(/depress.{0,3}o/g,'depressão')
     .replace(/Les.{0,3}o/g,'Lesão')
     .replace(/les.{0,3}o/g,'lesão')
     .replace(/sa.{0,2}de/g,'saúde')
     .replace(/confirma.{0,4}o/g,'confirmação')
     .replace(/recupera.{0,4}o/g,'recuperação')
     .replace(/redefini.{0,4}o/g,'redefinição')
     .replace(/op.{0,4}o de sa/g,'opção de sa')
     .replace(/op.{0,4}es/g,'opções')
     .replace(/Voc.{0,2} /g,'Você ')
     .replace(/voc.{0,2} /g,'você ')
     .replace(/condi.{0,4}o/g,'condição')
     .replace(/libera.{0,4}o m.{0,3}dica/g,'liberação médica')
     .replace(/alimenta.{0,4}o/g,'alimentação')
     .replace(/frequ.{0,4}ncia/g,'frequência')
     .replace(/pr.{0,3}pria/g,'própria')
     .replace(/N.{0,3}o foi poss.{0,3}vel/g,'Não foi possível')
     .replace(/n.{0,3}o foi poss.{0,3}vel/g,'não foi possível')
     .replace(/n.{0,3}o encontrado/g,'não encontrado')
     .replace(/N.{0,3}o encontrado/g,'Não encontrado')
     .replace(/n.{0,3}o configurado/g,'não configurado')
     .replace(/N.{0,3}o configurado/g,'Não configurado')
     .replace(/n.{0,3}o conferem/g,'não conferem')
     .replace(/N.{0,3}o informado/g,'Não informado')
     .replace(/n.{0,3}o informado/g,'não informado')
     .replace(/v.{0,2}nculo/g,'vínculo')
     .replace(/n.{0,2}mero/g,'número')
     .replace(/per.{0,3}odo/g,'período')
     .replace(/usu.{0,3}rio/g,'usuário')
     .replace(/configura.{0,4}es/g,'configurações')
     .replace(/exerc.{0,3}cio/g,'exercício')
     .replace(/exerc.{0,3}cios/g,'exercícios')
     .replace(/s.{0,2}rie/g,'série')
     .replace(/s.{0,2}ries/g,'séries')
     .replace(/conclu.{0,3}do/g,'concluído')
     .replace(/conclu.{0,3}da/g,'concluída')
     .replace(/necess.{0,3}rio/g,'necessário')
     .replace(/inv.{0,3}lido/g,'inválido')
     .replace(/m.{0,2}dia/g,'média')
     .replace(/m.{0,2}s\b/g,'mês')
     .replace(/b.{0,2}sico/g,'básico')
     .replace(/f.{0,2}sica/g,'física')
     .replace(/f.{0,2}sicas/g,'físicas')
     .replace(/aten.{0,4}o/g,'atenção')
     .replace(/descri.{0,4}o/g,'descrição')
     .replace(/Bra.{0,2}o \(cm\)/g,'Braço (cm)')
     .replace(/Sugest.{0,3}o/g,'Sugestão')
     .replace(/poder.{0,2} ver/g,'poderá ver')
     .replace(/aparecer.{0,3}o aqui/g,'aparecerão aqui')
     .replace(/esta .{0,2}rea/g,'esta área')
     .replace(/n.{0,3}o lida\(s\)/g,'não lida(s)')
     .replace(/H.{0,2} /g,(m)=>m.startsWith('Há')?m:m) // skip ambiguous
     .replace(/J.{0,1} quebrou/g,'Já quebrou')
     .replace(/N.{0,3}o bebo/g,'Não bebo')
     .replace(/N.{0,3}o sigo dieta/g,'Não sigo dieta')
     .replace(/cria a pr.{0,3}pria senha/g,'cria a própria senha');
  if(s!==o){fs.writeFileSync(p,s,'utf8'); console.log('fixed',p); n++;}
});
console.log('total',n);
