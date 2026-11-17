// Yarik server: статика + вход по коду (Telegram Gateway) + WebSocket-хранилище
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {WebSocketServer}=require('ws');
const PORT=process.env.PORT||3000,TOKEN=process.env.GATEWAY_TOKEN||'';
const DB=path.join(process.env.DATA_DIR||__dirname,'data.json'),PUB=path.join(__dirname,'public');
let D={docs:{},users:{},sess:{}};try{D=JSON.parse(fs.readFileSync(DB))}catch(e){}
let tm;const save=()=>{clearTimeout(tm);tm=setTimeout(()=>fs.writeFile(DB,JSON.stringify(D),()=>{}),300)};
const pend={},MIME={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css'};
const norm=p=>{let d=String(p||'').replace(/\D/g,'');if(d.length==11&&d[0]=='8')d='7'+d.slice(1);return d};
const out=(r,c,o)=>{r.writeHead(c,{'content-type':'application/json'});r.end(JSON.stringify(o))};
const body=q=>new Promise(r=>{let b='';q.on('data',d=>{b+=d;if(b.length>1e5)q.destroy()});q.on('end',()=>{try{r(JSON.parse(b))}catch(e){r({})}})});
const gw=async(m,p)=>(await fetch('https://gatewayapi.telegram.org/'+m,{method:'POST',headers:{Authorization:'Bearer '+TOKEN,'content-type':'application/json'},body:JSON.stringify(p)})).json();

const srv=http.createServer(async(q,r)=>{
 if(q.method=='POST'&&q.url=='/api/send'){
  const p=norm((await body(q)).phone);if(p.length<7)return out(r,400,{error:'Неверный номер'});
  if(pend[p]&&Date.now()-pend[p].at<30000)return out(r,429,{error:'Подождите 30 секунд'});
  if(!TOKEN){const code=String(crypto.randomInt(100000,999999));pend[p]={code,at:Date.now(),tries:0};console.log('[ТЕСТ] код для +'+p+': '+code);return out(r,200,{ok:1,dev:1})}
  try{const j=await gw('sendVerificationMessage',{phone_number:'+'+p,code_length:6,ttl:300});
   if(!j.ok)return out(r,400,{error:'Telegram: '+(j.error||'не удалось отправить код')});
   pend[p]={rid:j.result.request_id,at:Date.now(),tries:0};out(r,200,{ok:1})}catch(e){out(r,500,{error:'Ошибка Telegram Gateway'})}return}
 if(q.method=='POST'&&q.url=='/api/verify'){
  const b=await body(q),p=norm(b.phone),s=pend[p],code=String(b.code||'').trim();
  if(!s||++s.tries>5)return out(r,400,{error:'Запросите код заново'});
  let ok=false;
  if(s.code)ok=s.code===code;
  else try{const j=await gw('checkVerificationStatus',{request_id:s.rid,code});ok=!!(j.ok&&j.result.verification_status&&j.result.verification_status.status=='code_valid')}catch(e){}
  if(!ok)return out(r,400,{error:'Неверный код'});delete pend[p];
  const id='u'+crypto.createHash('sha1').update(p).digest('hex').slice(0,12),nm=String(b.name||'').trim().slice(0,32);
  const u=D.users[id]=D.users[id]||{id,phone:p,name:nm||'Друг'};if(nm)u.name=nm;
  D.docs['phones/'+id]={phone:p};const t=crypto.randomBytes(24).toString('hex');D.sess[t]=id;save();return out(r,200,{token:t,id})}
 let f=decodeURIComponent(q.url.split('?')[0]);if(f=='/')f='/index.html';
 const fp=path.join(PUB,f);if(!fp.startsWith(PUB)){r.writeHead(403);return r.end()}
 fs.readFile(fp,(e,d)=>{if(e){r.writeHead(404);return r.end('404')}r.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'});r.end(d)})});

const wss=new WebSocketServer({server:srv}),live=new Set(),par=p=>p.split('/').slice(0,-1).join('/'),okp=p=>/^[\w\-\/]+$/.test(p||'');
function query(m){
 const n=m.coll.split('/').length+1;
 let a=Object.keys(D.docs).filter(k=>k.startsWith(m.coll+'/')&&k.split('/').length==n).map(k=>({id:k.split('/').pop(),d:D.docs[k]}));
 for(const [f,op,v] of m.where||[])a=a.filter(x=>op=='array-contains'?(x.d[f]||[]).includes(v):x.d[f]===v);
 if(m.ord){const s=m.ord.dir=='desc'?-1:1,f=m.ord.f;a.sort((x,y)=>(x.d[f]>y.d[f]?1:x.d[f]<y.d[f]?-1:0)*s)}
 return m.lim?(m.ord&&m.ord.dir=='desc'?a.slice(0,m.lim):a.slice(-m.lim)):a}
function touch(k){save();for(const w of live)for(const s of Object.values(w.subs))if(s.coll==par(k)&&w.readyState==1)w.send(JSON.stringify({sid:s.sid,docs:query(s)}))}
wss.on('connection',ws=>{let uid=null;ws.subs={};live.add(ws);ws.on('close',()=>live.delete(ws));
 ws.on('message',raw=>{let m;try{m=JSON.parse(raw)}catch(e){return}
  const rep=(ok,data)=>ws.send(JSON.stringify({rid:m.rid,ok,data}));
  if(m.t=='auth'){uid=D.sess[m.token]||null;return ws.send(JSON.stringify({rid:m.rid,ok:!!uid,id:uid}))}
  if(!uid)return;
  if(m.t=='users'){const U=Object.values(D.users).map(u=>({id:u.id,name:u.name}));
   return rep(1,m.ids?U.filter(u=>m.ids.includes(u.id)):U.filter(u=>u.name.toLowerCase().includes(String(m.q||'').toLowerCase())).slice(0,20))}
  if(m.t=='unsub'){delete ws.subs[m.sid];return}
  if(m.t=='q'||m.t=='sub'){if(!okp(m.coll))return rep(0);
   if(m.t=='q')return rep(1,query(m));
   ws.subs[m.sid]=m;return ws.send(JSON.stringify({sid:m.sid,docs:query(m)}))}
  if(m.t=='doc'){const k=m.path;if(!okp(k))return rep(0);
   if(k.startsWith('phones/')&&k!='phones/'+uid&&m.op!='get')return rep(0);
   const cur=D.docs[k];
   if(m.op=='get')return rep(1,cur?{d:cur}:null);
   if(m.op=='add'){const id=crypto.randomBytes(8).toString('hex');D.docs[k+'/'+id]=m.data;touch(k+'/'+id);return rep(1,{id})}
   if(m.op=='set')D.docs[k]=m.data;
   else if(m.op=='update'){if(!cur)return rep(0);D.docs[k]={...cur,...m.data}}
   else if(m.op=='delete')delete D.docs[k];
   touch(k);rep(1,{})}})});
srv.listen(PORT,()=>console.log('Yarik запущен: http://localhost:'+PORT+(TOKEN?'':'  (ТЕСТОВЫЙ режим: коды печатаются здесь)')));
