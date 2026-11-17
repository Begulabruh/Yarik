// Даёт странице те же db/user, что были в Claude, но поверх нашего сервера
(()=>{let ws,tok=null,pend={},subs={},rid=0,ME=null;try{tok=localStorage.getItem('yk')}catch(e){}
const call=m=>new Promise((res,rej)=>{m.rid=++rid;pend[m.rid]=[res,rej];ws.send(JSON.stringify(m))});
const snap=a=>({docs:a.map(x=>({id:x.id,data:()=>x.d}))});
function connect(){return new Promise((ok,no)=>{if(ws){ws.onclose=null;try{ws.close()}catch(e){}}
 ws=new WebSocket((location.protocol=='https:'?'wss://':'ws://')+location.host);
 ws.onopen=async()=>{try{const r=await call({t:'auth',token:tok});ME=r.id;ok()}catch(e){no()}};
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.sid){const s=subs[m.sid];s&&s.cb(snap(m.docs))}else if(pend[m.rid]){const [res,rej]=pend[m.rid];delete pend[m.rid];m.ok?res(m.data||m):rej(new Error('err'))}};
 ws.onclose=()=>setTimeout(()=>connect().then(()=>Object.values(subs).forEach(s=>ws.send(JSON.stringify(s.m)))).catch(()=>{}),2000)})}
class Q{constructor(c,o={}){this.c=c;this.o=o}
 orderBy(f,d='asc'){return new Q(this.c,{...this.o,ord:{f,dir:d}})}
 limit(n){return new Q(this.c,{...this.o,lim:n})}
 where(f,op,v){return new Q(this.c,{...this.o,where:[...(this.o.where||[]),[f,op,v]]})}
 async get(){return snap(await call({t:'q',coll:this.c,...this.o}))}
 add(d){return call({t:'doc',op:'add',path:this.c,data:d})}
 onSnapshot(cb){const sid='s'+(++rid);subs[sid]={cb,m:{t:'sub',sid,coll:this.c,...this.o}};ws.send(JSON.stringify(subs[sid].m));return()=>{delete subs[sid];ws.send(JSON.stringify({t:'unsub',sid}))}}}
const doc=p=>({get:async()=>{const r=await call({t:'doc',op:'get',path:p});return{exists:!!r.d,data:()=>r.d}},
 set:d=>call({t:'doc',op:'set',path:p,data:d}),update:d=>call({t:'doc',op:'update',path:p,data:d}),delete:()=>call({t:'doc',op:'delete',path:p})});
const user={id:async()=>ME,profiles:async ids=>{const o={};(await call({t:'users',ids})).forEach(u=>o[u.id]=u);return o},
 me:async()=>(await user.profiles([ME]))[ME],search:q=>call({t:'users',q})};
function login(){return new Promise(done=>{const o=document.createElement('div');o.className='modal';
 o.innerHTML='<div class="card"><h3>Вход в Yarik</h3><input id="lp" type="tel" placeholder="+7 900 123-45-67"><button class="go" id="l1">Получить код</button><div id="l2" style="display:none;flex-direction:column;gap:10px"><input id="lc" placeholder="Код из Telegram" inputmode="numeric"><input id="ln" placeholder="Ваше имя" maxlength="32"><button class="go" id="l3">Войти</button></div><div class="sm" id="le"></div></div>';
 document.body.appendChild(o);const $=s=>o.querySelector(s),
 post=async(u,b)=>(await fetch(u,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)})).json();
 $('#l1').onclick=async()=>{const j=await post('/api/send',{phone:$('#lp').value});$('#le').textContent=j.error||(j.dev?'Тестовый режим: код в консоли сервера':'Код отправлен вам в Telegram');if(j.ok)$('#l2').style.display='flex'};
 $('#l3').onclick=async()=>{const j=await post('/api/verify',{phone:$('#lp').value,code:$('#lc').value,name:$('#ln').value});
  if(j.token){tok=j.token;try{localStorage.setItem('yk',tok)}catch(e){}o.remove();done()}else $('#le').textContent=j.error}})}
const ready=(async()=>{if(tok){try{await connect();return}catch(e){}}await login();await connect()})();
window.claude={use:async n=>{await ready;return n=='db'?{collection:c=>new Q(c),doc}:user}};})();
