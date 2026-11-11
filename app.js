const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const escapeText=(s)=>String(s??'');
function toast(text){const el=$('#toast');if(!el)return;el.textContent=text;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),4000)}
$('.menu-toggle')?.addEventListener('click',()=>{const h=$('.site-header');const expanded=h.classList.toggle('open');$('.menu-toggle').setAttribute('aria-expanded',String(expanded));});

// Form Submissions
const staticSite=document.documentElement.hasAttribute('data-static');
$$('.ajax-form').forEach(form=>form.addEventListener('submit',async e=>{
 e.preventDefault();
 if(staticSite){	// GitHub Pages has no backend: hand the message to the visitor's email app instead
  const d=Object.fromEntries(new FormData(form).entries());const to=document.documentElement.dataset.contact;
  const subject=form.dataset.endpoint==='/api/subscribe'?'Notify me about Turaude games':`[${d.topic||'Website'}] Message from ${d.name||'the website'}`;
  const body=form.dataset.endpoint==='/api/subscribe'?`Please let me know when your games launch: ${d.email||''}`:`${d.message||''}\n\n${d.name||''} <${d.email||''}>`;
  location.href=`mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  $('.form-feedback',form).textContent='Opening your email app…';return;
 }
 const submit=$('button[type=submit]',form);const feedback=$('.form-feedback',form);submit.disabled=true;feedback.textContent='Sending…';
 const data=Object.fromEntries(new FormData(form).entries());data.consent=data.consent==='on';
 try{const res=await fetch(form.dataset.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const body=await res.json();feedback.textContent=body.message||body.error||'Unexpected response';if(res.ok){form.reset();toast(body.message||'Thanks!')} }
 catch{feedback.textContent='Could not connect. Try again.'}finally{submit.disabled=false}
}));

// Micro-interactions: Card Hover Tilt Effect for Desktop
if(window.matchMedia('(pointer: fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  $$('.game-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const rx = ((y - rect.height/2)/(rect.height/2)) * -5;
      const ry = ((x - rect.width/2)/(rect.width/2)) * 5;
      card.style.transform = `perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-8px)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });
}

// Hero: a little storm of debris that follows the pointer. Click to blow it apart.
function stormHero(){
 const canvas=$('.storm-canvas');if(!canvas)return;
 const ctx=canvas.getContext('2d');const stage=canvas.parentElement;
 const still=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 let w=0,h=0;
 const resize=()=>{const dpr=Math.min(window.devicePixelRatio||1,2);const r=canvas.getBoundingClientRect();w=r.width;h=r.height;canvas.width=w*dpr;canvas.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0)};
 const colors=['#ff7700','#ff7700','#ff7700','#ff9d00','#fbf8f0','#6d6a62'];
 const parts=Array.from({length:230},()=>({a:Math.random()*Math.PI*2,t:Math.random(),s:.6+Math.random()*1.3,spd:.5+Math.random(),c:colors[Math.random()*colors.length|0],tri:Math.random()<.4,rot:Math.random()*6}));
 let target=.5,base=.5,top=.5,burst=0,steering=false,visible=true;
 stage.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect();target=Math.min(.85,Math.max(.15,(e.clientX-r.left)/r.width));steering=true});
 stage.addEventListener('pointerleave',()=>{steering=false});
 stage.addEventListener('pointerdown',()=>{burst=1});
 function frame(time){
  const T=time/1000;
  if(!steering)target=.5+Math.sin(T*.45)*.2;
  base+=(target-base)*.05;top+=(base-top)*.02;burst*=.95;
  ctx.clearRect(0,0,w,h);
  const y0=h*.16,y1=h*.82,bx=base*w,tx=top*w;
  ctx.fillStyle='rgba(255,119,0,.14)';ctx.beginPath();ctx.ellipse(bx,y1+14,w*.13,12,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.12)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,y1+14);ctx.lineTo(w,y1+14);ctx.stroke();
  for(const front of [false,true])for(const p of parts){
   if(!still){p.a+=.018*p.spd*(1.8-p.t);p.t-=.0016*p.spd;p.rot+=.04*p.spd;if(p.t<0){p.t=1;p.a=Math.random()*Math.PI*2}}
   const depth=Math.sin(p.a);if(depth>0!==front)continue;
   const radius=(w*.035+Math.pow(1-p.t,1.5)*w*.3)*(1+burst*1.8);
   const axis=tx+(bx-tx)*p.t+Math.sin(T*2+p.t*6)*w*.015;
   const x=axis+Math.cos(p.a)*radius,y=y0+p.t*(y1-y0)+depth*radius*.16;
   const size=p.s*(3+depth*1.6)*(1+(1-p.t)*.5);
   ctx.globalAlpha=.5+depth*.45;ctx.fillStyle=p.c;
   ctx.save();ctx.translate(x,y);ctx.rotate(p.rot);ctx.beginPath();
   if(p.tri){ctx.moveTo(-size,-size);ctx.lineTo(size*1.2,0);ctx.lineTo(-size,size);ctx.closePath();ctx.fill()}else ctx.fillRect(-size/2,-size/2,size,size);
   ctx.restore();
  }
  ctx.globalAlpha=1;
  if(!still&&visible)requestAnimationFrame(frame);
 }
 resize();
 new ResizeObserver(()=>{resize();if(still)frame(0)}).observe(canvas);
 new IntersectionObserver(([entry])=>{const was=visible;visible=entry.isIntersecting;if(visible&&!was&&!still)requestAnimationFrame(frame)}).observe(canvas);
 requestAnimationFrame(frame);
}
// Preview (?preview=town): a mini Stormmorph town instead of the debris storm.
if ((new URLSearchParams(location.search).get('preview') === 'town' || document.documentElement.dataset.hero === 'town') && $('.storm-canvas')) {
 const poster = $('.hero-poster');
 poster.classList.add('town-mode');
 $('.poster-hint').textContent = 'MOVE TO STEER · EAT 💧🔥⚡ TO MORPH';
 import('/storm-town.js').then(m => m.default($('.storm-canvas')));
} else stormHero();

// Cheat code: up up down down left right left right B A
const cheat=['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];let cheatPos=0;
document.addEventListener('keydown',e=>{
 const key=e.key.length===1?e.key.toLowerCase():e.key;
 cheatPos=key===cheat[cheatPos]?cheatPos+1:(key===cheat[0]?1:0);
 if(cheatPos===cheat.length){cheatPos=0;const on=document.body.classList.toggle('chaos-mode');toast(on?'Cheat accepted: CHAOS MODE ON':'Chaos mode off. Phew.')}
});

const adminLogin=$('#admin-login-form');
async function api(url,options={}){const r=await fetch(url,{credentials:'same-origin',...options});let data;try{data=await r.json()}catch{data={error:'Unexpected response'}}if(!r.ok)throw new Error(data.error||'Request failed');return data;}
const setNodeText=(element,text)=>{const n=$(element);if(n)n.textContent=text};
const mk=(tag,attributes={},text)=>{const el=document.createElement(tag);Object.entries(attributes).forEach(([k,v])=>el.setAttribute(k,v));if(text!==undefined)el.textContent=String(text);return el};
function buildGames(games){
 const wrap=$('#admin-game-editors');wrap.replaceChildren();
 games.forEach(game=>{
  const card=mk('div',{class:'admin-game-panel'});card.append(mk('h4',{},game.title));const form=mk('form',{'class':'admin-grid'});
  const props=[['title','Title'],['eyebrow','Eyebrow'],['summary','Short description'],['description','Full description'],['status','Status'],['genre','Genre'],['platform','Platform'],['store_url','Store URL']];
  props.forEach(([field,label])=>{const l=mk('label',{class:field==='summary'||field==='description'?'wide':''},label.toUpperCase());const input=field==='summary'||field==='description'?mk('textarea',{name:field,rows:field==='description'?'4':'2',maxlength:field==='description'?'1200':'220'}):mk('input',{name:field,type:'text',maxlength:'250'});input.value=game[field]||'';l.append(input);form.append(l)});
  const b=mk('button',{'class':'button button-orange','type':'submit'},'SAVE CHANGES ↗');form.append(b);
  form.addEventListener('submit',async e=>{e.preventDefault();b.disabled=true;try{const body=Object.fromEntries(new FormData(form));await api('/api/admin/games/'+encodeURIComponent(game.slug),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});toast('Game updated.');}catch(err){toast(err.message)}finally{b.disabled=false}});
  card.append(form);wrap.append(card);
 });
}
function buildTable(target,items,cols){const wrap=$(target);wrap.replaceChildren();if(!items.length){wrap.append(mk('p',{},'Nothing here yet.'));return}const table=mk('table',{class:'admin-table'});const head=mk('tr');cols.forEach(([key,label])=>head.append(mk('th',{},label)));table.append(head);items.forEach(item=>{const tr=mk('tr');cols.forEach(([key])=>tr.append(mk('td',{},item[key]||'')));table.append(tr)});wrap.append(table)}
async function loadAdmin(){
 try{const [g,m,s]=await Promise.all([api('/api/admin/games'),api('/api/admin/messages'),api('/api/admin/subscribers')]);
  $('#admin-login').hidden=true;$('#admin-dashboard').hidden=false;buildGames(g.games);buildTable('#admin-messages',m.messages,[['created_at','Date'],['name','From'],['email','Email'],['topic','Topic'],['message','Message']]);buildTable('#admin-subscribers',s.subscribers,[['consent_at','Date'],['email','Email'],['status','Status']]);
 }catch{$('#admin-login').hidden=false;$('#admin-dashboard').hidden=true}
}
if(adminLogin){loadAdmin();adminLogin.addEventListener('submit',async e=>{e.preventDefault();setNodeText('#login-result','Checking…');try{await api('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:$('#admin-password').value})});$('#admin-password').value='';setNodeText('#login-result','');loadAdmin();}catch(err){setNodeText('#login-result',err.message)}});
 $('#logout-button')?.addEventListener('click',async()=>{await api('/api/admin/logout',{method:'POST'});location.reload()});
 $('#update-form')?.addEventListener('submit',async e=>{e.preventDefault();try{await api('/api/admin/updates',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))});e.currentTarget.reset();toast('Update published to homepage.')}catch(err){toast(err.message)}});
}
