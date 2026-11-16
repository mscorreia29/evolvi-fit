const fs=require('fs'), path=require('path');
function walk(d,cb){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name); if(e.isDirectory())walk(p,cb); else cb(p);}}
function fixContent(s){
  // common UTF-8 bytes interpreted as latin1/cp1252 sequences
  const m = [
    [/Ã¡/g,'á'],[/Ã¢/g,'â'],[/Ã£/g,'ã'],[/Ã©/g,'é'],[/Ãª/g,'ê'],[/Ã­/g,'í'],[/Ã³/g,'ó'],[/Ã´/g,'ô'],[/Ãµ/g,'õ'],[/Ãº/g,'ú'],[/Ã§/g,'ç'],
    [/Ã/g,'Á'],[/Ã‰/g,'É'],[/ÃŠ/g,'Ê'],[/Ã“/g,'Ó'],[/Ãš/g,'Ú'],[/Ã‡/g,'Ç'],[/Ã"/g,'Ó'],[/Ã€/g,'À'],
    [/Âº/g,'º'],[/Âª/g,'ª'],[/Â /g,' '],[/Â/g,'']
  ];
  for(const [a,b] of m) s=s.replace(a,b);
  return s;
}
let n=0;
walk('src',(p)=>{ if(!/\.(ts|tsx)$/.test(p)) return; let s=fs.readFileSync(p,'utf8'); let t=fixContent(s); if(t!==s){fs.writeFileSync(p,t,'utf8'); console.log('fixed',p); n++;}});
console.log('total',n);
