import * as THREE from 'three';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
let token=localStorage.sv_t,me,ws,selfId,pick=0,cur='public',myRooms=[],friends={friends:[],incoming:[]},pendingInvite=null,reg=null;
const api=async(p,b)=>{let r;try{r=await fetch('/api/'+p,{method:b?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:b&&JSON.stringify(b)})}catch{throw Error('تعذر الاتصال بالخادم، تحقق من الإنترنت')}const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||'الخادم لا يردّ كما يجب (رمز '+r.status+'). الموقع لازم يكون منشورًا على خدمة Node وليس استضافة ثابتة');return j};
const toast=t=>{const e=$('#toast');e.textContent=t;e.classList.add('on');clearTimeout(toast.h);toast.h=setTimeout(()=>e.classList.remove('on'),3200)};
const show=id=>$$('main.screen').forEach(s=>s.hidden=s.id!==id);
const send=o=>ws?.readyState===1&&ws.send(JSON.stringify(o));
const btn=(l,f)=>{const b=document.createElement('button');b.textContent=l;b.onclick=f;return b};

/* ---------- الشخصيات: 40 شخصية (20 بنت + 20 ولد) تُبنى برمجيًا ---------- */
const SKIN=[0xffdcb8,0xf3c28b,0xdea36b,0xb87a4b,0x8a5a3c,0xffe3d3],HAIR=[0x2b1b17,0x6a3d24,0xb5651d,0xf2c14e,0xff4f9a,0x6a4cff,0x00b5a5,0xeeeeee];
const M=c=>new THREE.MeshStandardMaterial({color:c,roughness:.7});
const mesh=(g,c,x=0,y=0,z=0)=>{const m=new THREE.Mesh(g,M(c));m.position.set(x,y,z);m.castShadow=true;return m};
function buildAvatar(i){
 const girl=i<20,k=i%20,G=new THREE.Group(),
 top=new THREE.Color().setHSL((k*.618+(girl?0:.31))%1,.8,.58).getHex(),bot=new THREE.Color().setHSL((k*.618+.5)%1,.55,girl?.7:.38).getHex(),
 skin=SKIN[(k*5+i)%6],hair=HAIR[(k*3+(girl?0:1))%8],style=(k+(girl?0:3))%7,acc=(k>>1)%4;
 const legs=[-1,1].map(s=>{const p=new THREE.Group();p.position.set(s*.11,.5,0);p.add(mesh(new THREE.CylinderGeometry(.09,.08,.5),bot,0,-.25,0),mesh(new THREE.SphereGeometry(.1),0xffffff,0,-.5,.04));G.add(p);return p});
 const arms=[-1,1].map(s=>{const p=new THREE.Group();p.position.set(s*.3,1.05,0);p.add(mesh(new THREE.CylinderGeometry(.07,.065,.45),top,0,-.2,0),mesh(new THREE.SphereGeometry(.07),skin,0,-.45,0));G.add(p);return p});
 const body=new THREE.Group();G.add(body);
 body.add(mesh(new THREE.CapsuleGeometry(.23,.3,4,12),top,0,.85,0));
 if(girl&&k%3==0)body.add(mesh(new THREE.ConeGeometry(.42,.45,16),top,0,.62,0));
 const head=mesh(new THREE.SphereGeometry(.32,24,18),skin,0,1.4,0);head.scale.set(1,.95,.95);body.add(head);
 [-1,1].forEach(s=>{body.add(mesh(new THREE.SphereGeometry(.045),0x1b1530,s*.12,1.42,.29));if(girl)body.add(mesh(new THREE.SphereGeometry(.05),0xff9db8,s*.2,1.33,.25))});
 const mo=mesh(new THREE.SphereGeometry(.04),0xc4375f,0,1.3,.31);mo.scale.set(1.6,.6,.5);body.add(mo);
 body.add(mesh(new THREE.SphereGeometry(.335,24,16,0,6.283,0,1.35),hair,0,1.41,-.01));
 const H=(g,x,y,z)=>body.add(mesh(g,hair,x,y,z));
 if(style==1)H(new THREE.CapsuleGeometry(.3,.45,4,10),0,1.15,-.14);
 if(style==2)H(new THREE.SphereGeometry(.14),0,1.8,0);
 if(style==3)H(new THREE.CapsuleGeometry(.07,.4,4,8),0,1.3,-.36);
 if(style==4)[-1,1].forEach(s=>H(new THREE.SphereGeometry(.12),s*.34,1.3,0));
 if(style==5)for(let j=0;j<9;j++){const a=j*.7;H(new THREE.SphereGeometry(.12),Math.sin(a)*.27,1.55+Math.cos(j)*.12,Math.cos(a)*.2-.05)}
 if(style==6)for(let j=0;j<5;j++)H(new THREE.ConeGeometry(.07,.25,6),(j-2)*.12,1.76,0);
 if(acc==1)[-1,1].forEach(s=>body.add(mesh(new THREE.TorusGeometry(.07,.012,6,16),0x222222,s*.12,1.43,.3)));
 if(acc==2){const t=mesh(new THREE.TorusGeometry(.33,.03,6,24),0xffffff,0,1.55,0);t.rotation.x=1.45;body.add(t)}
 if(acc==3)body.add(mesh(new THREE.BoxGeometry(.32,.4,.14),bot^0x555555,0,.85,-.28));
 G.userData={legs,arms,body};return G}
const portraits=[];
function makePortraits(){const r=new THREE.WebGLRenderer({alpha:true,antialias:true});r.setSize(150,190);const s=new THREE.Scene();
 s.add(new THREE.HemisphereLight(0xffffff,0x887799,1.6));const d=new THREE.DirectionalLight(0xffffff,1.5);d.position.set(2,3,4);s.add(d);
 const c=new THREE.PerspectiveCamera(30,150/190,.1,20);c.position.set(0,1,4.6);c.lookAt(0,.85,0);
 for(let i=0;i<40;i++){const a=buildAvatar(i);s.add(a);r.render(s,c);portraits.push(r.domElement.toDataURL());s.remove(a)}r.dispose()}
function grid(el,sel,cb){el.innerHTML='';[['بنات',0],['أولاد',20]].forEach(([t,o])=>{el.append(Object.assign(document.createElement('b'),{textContent:t}));const g=document.createElement('div');g.className='gr';
 for(let i=o;i<o+20;i++){const b=document.createElement('button');b.className='ch'+(i==sel?' on':'');b.setAttribute('aria-label','شخصية '+(i+1));const im=new Image();im.src=portraits[i];b.append(im);
  b.onclick=()=>{el.querySelectorAll('.ch').forEach(x=>x.classList.remove('on'));b.classList.add('on');cb(i)};g.append(b)}el.append(g)})}

/* ---------- الدخول والتسجيل ---------- */
$$('[data-go]').forEach(b=>b.onclick=()=>show(b.dataset.go));
$('#fLogin').onsubmit=async e=>{e.preventDefault();try{const j=await api('login',{name:$('#ln').value.trim(),password:$('#lp').value});start(j)}catch(x){$('#le').textContent=x.message}};
$('#fSign').onsubmit=e=>{e.preventDefault();const n=$('#sn').value.trim(),p=$('#sp').value;
 if(!/^[\w\u0600-\u06FF]{3,20}$/.test(n))return $('#se').textContent='الاسم: 3–20 حرفًا بدون مسافات أو رموز';if(p.length<6)return $('#se').textContent='كلمة المرور 6 أحرف على الأقل';
 reg={name:n,password:p};grid($('#cgrid'),pick,i=>pick=i);show('choose')};
$('#go').onclick=async()=>{try{start(await api('register',{...reg,avatar:pick}))}catch(x){$('#ce').textContent=x.message;if(/مستخدم/.test(x.message))show('signup')}};
function start(j){token=j.token||token;localStorage.sv_t=token;me=j.me;pick=me.avatar;enter()}
$('#out').onclick=()=>{localStorage.removeItem('sv_t');location.reload()};

/* ---------- العالم ثلاثي الأبعاد ---------- */
let R,scene,cam,clock,players=new Map(),seats=[],boxes=[],keys={},joy={x:0,y:0},cy=0,cp=.5,dist=6,lastSent=0,quality=+localStorage.sv_q||(matchMedia('(pointer:coarse)').matches?1:2),showNames=true;
const PAL=[0xff4f9a,0x6a4cff,0x00c9a7,0xffc933,0xff7a45,0x3da5ff];
const box=(w,h,d,c,x,y,z,col=true)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),M(c));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;scene.add(m);if(col)boxes.push([x-w/2-.3,z-d/2-.3,x+w/2+.3,z+d/2+.3]);return m};
const cyl=(r,h,c,x,y,z)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,24),M(c));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;scene.add(m);return m};
const rug=(x,z,w,d,c)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),M(c));m.rotation.x=-Math.PI/2;m.position.set(x,.01,z);m.receiveShadow=true;scene.add(m)};
function chair(x,z,tx,tz,c){const ry=Math.atan2(tx-x,tz-z),g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=ry;
 const s=new THREE.Mesh(new THREE.BoxGeometry(.5,.08,.5),M(c));s.position.y=.45;const b=new THREE.Mesh(new THREE.BoxGeometry(.5,.5,.07),M(c));b.position.set(0,.72,-.22);
 const p=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,.45),M(0x555566));p.position.y=.22;g.add(s,b,p);g.traverse(o=>o.castShadow=true);scene.add(g);seats.push({x,z,ry})}
function booksTex(){const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');x.fillStyle='#8a5a3c';x.fillRect(0,0,256,256);
 for(let r=0;r<4;r++){let px=6;while(px<246){const w=8+Math.random()*12,h=38+Math.random()*18;x.fillStyle=`hsl(${Math.random()*360},75%,60%)`;x.fillRect(px,r*64+60-h,w,h);px+=w+2}x.fillStyle='#6b4226';x.fillRect(0,r*64+60,256,5)}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}
function label(t,x,z,c){const cv=document.createElement('canvas');cv.width=512;cv.height=128;const g=cv.getContext('2d');g.fillStyle=c;g.beginPath();g.roundRect(0,10,512,108,50);g.fill();
 g.fillStyle='#fff';g.font='700 54px Cairo,sans-serif';g.textAlign='center';g.direction='rtl';g.fillText(t,256,86);
 const tx=new THREE.CanvasTexture(cv);tx.colorSpace=THREE.SRGBColorSpace;const s=new THREE.Sprite(new THREE.SpriteMaterial({map:tx,transparent:true}));s.scale.set(5.5,1.4,1);s.position.set(x,4.6,z);scene.add(s)}
function buildWorld(){
 const fl=new THREE.Mesh(new THREE.PlaneGeometry(40,30),M(0xf0c892));fl.rotation.x=-Math.PI/2;fl.receiveShadow=true;scene.add(fl);
 rug(-10,0,14,23,0x8fd3ff);rug(11,0,18,27,0xffb3d1);
 box(40,6,.4,0xfff0f6,0,3,-15.2,false);box(40,6,.4,0xfff0f6,0,3,15.2,false);box(.4,6,30,0xfff0f6,-20.2,3,0,false);box(.4,6,30,0xfff0f6,20.2,3,0,false);
 const glass=new THREE.MeshBasicMaterial({color:0xaee6ff});
 for(let x=-16;x<=16;x+=8){const w=new THREE.Mesh(new THREE.BoxGeometry(3,2.2,.06),glass);w.position.set(x,4,-14.97);scene.add(w);box(3.3,2.5,.04,0xffffff,x,4,-14.99,false)}
 for(const sx of[-1,1])for(let z=-8;z<=8;z+=8){const w=new THREE.Mesh(new THREE.BoxGeometry(.06,2.4,3),glass);w.position.set(sx*19.97,3.2,z);scene.add(w)}
 const bt=booksTex();for(const x of[-17,-13,-9,-5]){box(3.4,2.8,.6,0x8a5a3c,x,1.4,-14.6);const p=new THREE.Mesh(new THREE.PlaneGeometry(3.2,2.6),new THREE.MeshBasicMaterial({map:bt}));p.position.set(x,1.4,-14.29);scene.add(p)}
 for(const cx of[6,11,16])for(const cz of[-9,-3,3,9]){const c=PAL[(cx+cz+20)%6];cyl(.85,.08,0xffffff,cx,.75,cz);cyl(.08,.75,0x555566,cx,.37,cz);boxes.push([cx-1.15,cz-1.15,cx+1.15,cz+1.15]);
  for(let a=0;a<4;a++)chair(cx+Math.sin(a*1.5708)*1.25,cz+Math.cos(a*1.5708)*1.25,cx,cz,PAL[(a+cx)%6]);
  const l=new THREE.Mesh(new THREE.SphereGeometry(.25),new THREE.MeshBasicMaterial({color:0xfff1b8}));l.position.set(cx,3.6,cz);scene.add(l);cyl(.01,2,0x333333,cx,4.6,cz)}
 for(const dz of[-9,-3,3,9]){box(4.4,.08,1.1,0xffe0b3,-10,.75,dz);box(.08,.75,1,0x8a5a3c,-12.1,.37,dz,false);box(.08,.75,1,0x8a5a3c,-7.9,.37,dz,false);
  for(const x of[-11.4,-10,-8.6]){chair(x,dz-1.1,x,dz,PAL[2]);chair(x,dz+1.1,x,dz,PAL[5])}}
 [[-18,-13],[18,-13],[-18,13],[18,13],[-1,-13],[1,13],[-19,0],[19,0],[2,0]].forEach(([x,z])=>{cyl(.3,.4,0xd9734e,x,.2,z);[0,1,2].forEach(i=>{const s=mesh(new THREE.SphereGeometry(.3-i*.05),0x2fbf6b,x+(i-1)*.12,.7+i*.25,z);scene.add(s)})});
 label('منطقة الدراسة الهادئة',-10,-12.8,'#2d7de0');label('منطقة الدردشة',11,-12.8,'#ff4f9a')}
function collide(p){for(const b of boxes)if(p.x>b[0]&&p.x<b[2]&&p.z>b[1]&&p.z<b[3]){const d=[p.x-b[0],b[2]-p.x,p.z-b[1],b[3]-p.z],m=Math.min(...d),i=d.indexOf(m);if(i==0)p.x=b[0];else if(i==1)p.x=b[2];else if(i==2)p.z=b[1];else p.z=b[3]}}
function initWorld(){if(R)return;
 R=new THREE.WebGLRenderer({canvas:$('#cv'),antialias:true});R.shadowMap.enabled=true;clock=new THREE.Clock();
 scene=new THREE.Scene();scene.background=new THREE.Color(0xbfe8ff);scene.fog=new THREE.Fog(0xbfe8ff,35,80);cam=new THREE.PerspectiveCamera(60,1,.1,100);
 scene.add(new THREE.HemisphereLight(0xffffff,0xffd9b0,1.5));const sun=new THREE.DirectionalLight(0xfff2d6,2);sun.position.set(10,20,8);sun.castShadow=true;
 Object.assign(sun.shadow.camera,{left:-25,right:25,top:20,bottom:-20});sun.shadow.mapSize.set(1024,1024);scene.add(sun);
 buildWorld();addEventListener('resize',resize);resize();R.setAnimationLoop(frame)}
function resize(){R.setPixelRatio(Math.min(devicePixelRatio,quality));R.setSize(innerWidth,innerHeight);cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix()}
function addPlayer(p){if(players.has(p.id))return;const g=buildAvatar(p.avatar);scene.add(g);const tag=document.createElement('div');tag.className='tag';$('#tags').append(tag);
 const o={...p,tx:p.x,tz:p.z,try:p.ry,g,tag,ph:0,mv:false,speak:false};players.set(p.id,o);tagText(o)}
const tagText=o=>o.tag.textContent=(o.mic?'🎤 ':'🔇 ')+o.name;
function removePlayer(id){const o=players.get(id);if(!o)return;scene.remove(o.g);o.tag.remove();players.delete(id)}
const angd=a=>Math.atan2(Math.sin(a),Math.cos(a));
function trySit(){const m=players.get(selfId);if(!m)return;if(m.sit)return stand(m);let b=null,bd=1.8;
 for(const s of seats){const d=Math.hypot(s.x-m.x,s.z-m.z);if(d<bd&&![...players.values()].some(p=>p!==m&&p.sit&&Math.hypot(p.x-s.x,p.z-s.z)<.4)){bd=d;b=s}}
 if(b){Object.assign(m,{x:b.x,z:b.z,ry:b.ry,sit:1,seat:b})}else toast('اقترب من كرسي فارغ ثم اضغط E')}
function stand(m){m.sit=0;const s=m.seat;if(s){m.x=s.x-Math.sin(s.ry)*.8;m.z=s.z-Math.cos(s.ry)*.8}}
const v3=new THREE.Vector3();
function frame(){const dt=Math.min(clock.getDelta(),.05),m=players.get(selfId);
 if(m){const ix=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0)+joy.x,iz=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0)-joy.y,l=Math.hypot(ix,iz);m.mv=false;
  if(l>.15){if(m.sit)stand(m);const nx=ix/l,nz=iz/l,fx=Math.sin(cy),fz=Math.cos(cy),mx=fx*nz-fz*nx,mz=fz*nz+fx*nx,st=4.2*dt*Math.min(l,1);
   m.x+=mx*st;m.z+=mz*st;collide(m);m.x=clamp(m.x,-19,19);m.z=clamp(m.z,-13.5,14);m.ry=Math.atan2(mx,mz);m.mv=true}
  m.tx=m.x;m.tz=m.z;m.try=m.ry;
  const now=performance.now();if(now-lastSent>100){lastSent=now;send({t:'move',x:m.x,z:m.z,ry:m.ry,sit:m.sit})}
  let bs=null,bd=1.8;if(!m.sit)for(const s of seats){const d=Math.hypot(s.x-m.x,s.z-m.z);if(d<bd){bd=d;bs=s}}
  $('#sitBtn').hidden=!(m.sit||bs);$('#sitBtn').textContent=m.sit?'🧍 قف':'🪑 اجلس'}
 for(const o of players.values()){const me=o.id===selfId;
  if(!me){const k=Math.min(1,dt*10);const px=o.x,pz=o.z;o.x+=(o.tx-o.x)*k;o.z+=(o.tz-o.z)*k;o.ry+=angd(o.try-o.ry)*k;o.mv=Math.hypot(o.x-px,o.z-pz)>.005}
  const g=o.g,u=g.userData;g.position.set(o.x,o.sit?-.05:0,o.z);g.rotation.y+=angd(o.ry-g.rotation.y)*Math.min(1,dt*14);
  if(o.sit){u.legs.forEach(l=>l.rotation.x=-1.5);u.arms.forEach(a=>a.rotation.x=-.5)}
  else if(o.mv){o.ph+=dt*9;const s=Math.sin(o.ph);u.legs[0].rotation.x=s*.7;u.legs[1].rotation.x=-s*.7;u.arms[0].rotation.x=-s*.6;u.arms[1].rotation.x=s*.6;g.position.y=Math.abs(s)*.04}
  else{u.legs.forEach(l=>l.rotation.x=0);u.arms.forEach(a=>a.rotation.x=0)}
  v3.set(o.x,2.15,o.z).project(cam);o.tag.style.display=showNames&&v3.z<1?'block':'none';
  o.tag.style.transform=`translate(${(v3.x*.5+.5)*innerWidth}px,${(-v3.y*.5+.5)*innerHeight}px) translate(-50%,-100%)`;o.tag.classList.toggle('speak',o.speak)}
 if(m){const f=Math.cos(cp);cam.position.set(clamp(m.x-Math.sin(cy)*f*dist,-19.5,19.5),Math.max(.6,1.2+Math.sin(cp)*dist),clamp(m.z-Math.cos(cy)*f*dist,-14.5,14.8));cam.lookAt(m.x,1.1,m.z)}
 updGains();R.render(scene,cam)}
addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;keys[e.code]=1;if(e.code=='KeyE')trySit()});addEventListener('keyup',e=>keys[e.code]=0);
$('#sitBtn').onclick=trySit;
{let drag=null;const cv=$('#cv');cv.onpointerdown=e=>{drag=[e.clientX,e.clientY];cv.setPointerCapture(e.pointerId)};cv.onpointerup=()=>drag=null;
 cv.onpointermove=e=>{if(!drag)return;cy-=(e.clientX-drag[0])*.006;cp=clamp(cp+(e.clientY-drag[1])*.005,.1,1.3);drag=[e.clientX,e.clientY]};
 cv.onwheel=e=>dist=clamp(dist+e.deltaY*.005,2.5,10);
 const j=$('#joy'),kn=$('#knob');let on=false;const mv=e=>{const r=j.getBoundingClientRect();let dx=e.clientX-r.left-55,dy=e.clientY-r.top-55;const l=Math.hypot(dx,dy)||1,k=Math.min(l,45)/l;dx*=k;dy*=k;kn.style.transform=`translate(${dx}px,${dy}px)`;joy.x=dx/45;joy.y=dy/45};
 j.onpointerdown=e=>{on=true;j.setPointerCapture(e.pointerId);mv(e)};j.onpointermove=e=>on&&mv(e);j.onpointerup=j.onpointercancel=()=>{on=false;joy.x=joy.y=0;kn.style.transform=''}}

/* ---------- الدردشة (تُحذف الرسالة وملفاتها بعد 5 دقائق) ---------- */
let replyTo=null;
function fileEl(f){const u='/files/'+f.id+'?t='+token,w=document.createElement('div'),sz=f.size>1e6?(f.size/1e6).toFixed(1)+' MB':Math.ceil(f.size/1e3)+' KB';
 if(f.type.startsWith('image/')){const i=new Image();i.src=u;i.className='pic';i.onclick=()=>open(u);w.append(i)}
 else if(/^(video|audio)\//.test(f.type)){const v=document.createElement(f.type[0]=='v'?'video':'audio');v.src=u;v.controls=true;v.className='pic';w.append(v)}
 const a=document.createElement('a');a.href=u+'&dl=1';a.textContent='⬇ '+f.name+' ('+sz+')';w.append(a);
 if(f.type==='application/pdf')w.append(btn('📄 عرض',()=>{$('#pdf iframe').src=u;$('#pdf').hidden=false}));return w}
function addMsg(m){const exp=Date.now()+m.ttl,d=document.createElement('div');d.className='msg'+(m.from===selfId?' mine':'');d.dataset.room=m.room;d.hidden=m.room!==cur;
 const im=new Image();im.src=portraits[m.avatar];im.className='av';const b=document.createElement('div');b.className='bub';b.append(Object.assign(document.createElement('b'),{textContent:m.name}));
 if(m.reply)b.append(Object.assign(document.createElement('blockquote'),{textContent:m.reply}));
 if(m.text){const p=document.createElement('p');m.text.split(/(https?:\/\/\S+)/).forEach(s=>{if(/^https?:\/\//.test(s)){const a=document.createElement('a');a.href=s;a.textContent=s;a.target='_blank';a.rel='noopener noreferrer';p.append(a)}else p.append(s)});b.append(p)}
 if(m.file)b.append(fileEl(m.file));const t=document.createElement('small');b.append(t);d.append(im,b);$('#log').append(d);$('#log').scrollTop=1e9;
 b.onclick=e=>{if(e.target.closest('a,button,img,video,audio'))return;replyTo=(m.name+': '+(m.text||m.file?.name||'')).slice(0,80);$('#reply').textContent='↩ '+replyTo+'  (اضغط للإلغاء)';$('#reply').hidden=false};
 const tick=()=>{const s=Math.round((exp-Date.now())/1000);if(s<=0){d.remove();clearInterval(iv)}else t.textContent='⏳ تُحذف خلال '+Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};const iv=setInterval(tick,1000);tick()}
$('#reply').onclick=()=>{replyTo=null;$('#reply').hidden=true};
function sendChat(file){const text=$('#txt').value.trim();if(!text&&!file)return;send({t:'chat',room:cur,text,file,reply:replyTo});$('#txt').value='';replyTo=null;$('#reply').hidden=true}
async function upload(f){if(!f)return;if(f.size>25e6)return toast('الحد الأقصى للملف 25 ميجابايت');toast('جارٍ الرفع…');
 try{const r=await fetch('/api/upload',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/octet-stream','x-filename':encodeURIComponent(f.name),'x-filetype':f.type||'application/octet-stream'},body:f}),j=await r.json();if(!r.ok)throw Error(j.error);sendChat(j.id)}catch(e){toast(e.message)}}
$('#snd').onclick=()=>sendChat();$('#txt').onkeydown=e=>e.key=='Enter'&&sendChat();
$('#f1').onclick=()=>$('#fi').click();$('#f2').onclick=()=>$('#fm').click();$('#fi').onchange=e=>{upload(e.target.files[0]);e.target.value=''};$('#fm').onchange=e=>{upload(e.target.files[0]);e.target.value=''};
$('#pdfx').onclick=()=>{$('#pdf').hidden=true;$('#pdf iframe').src='about:blank'};
function renderTabs(){if(cur!=='public'&&!myRooms.some(r=>r.id===cur))cur='public';const t=$('#tabs');t.innerHTML='';
 [{id:'public',name:'🌍 العام'},...myRooms.map(r=>({id:r.id,name:'🔒 '+r.name}))].forEach(r=>{const b=btn(r.name,()=>{cur=r.id;renderTabs();$$('.msg').forEach(m=>m.hidden=m.dataset.room!==cur)});b.className=r.id==cur?'on':'';t.append(b)});updVoiceBtn()}

/* ---------- الصوت: WebRTC + صوت مكاني + فصل الغرف الخاصة ---------- */
const peers=new Map(),ICE=[{urls:'stun:stun.l.google.com:19302'}];let actx,micTrack,micOn=false,chan='public',localAn,devId='',vol=1,spatial=true;
const lv=an=>{const d=new Uint8Array(an.frequencyBinCount);an.getByteFrequencyData(d);return d.reduce((a,b)=>a+b,0)/d.length};
function mkPeer(id){const pc=new RTCPeerConnection({iceServers:ICE}),tr=pc.addTransceiver('audio',{direction:'sendrecv'}),P={pc,tr};if(micTrack)tr.sender.replaceTrack(micTrack);
 pc.onicecandidate=e=>e.candidate&&send({t:'sig',to:id,data:{c:e.candidate}});
 pc.ontrack=e=>{const s=e.streams[0];P.a=new Audio();P.a.srcObject=s;P.a.muted=true;P.a.play().catch(()=>{});const src=actx.createMediaStreamSource(s);P.gain=actx.createGain();P.an=actx.createAnalyser();src.connect(P.gain).connect(actx.destination);src.connect(P.an)};
 peers.set(id,P);return P}
async function onSig(from,d){const P=peers.get(from)||mkPeer(from),pc=P.pc;
 if(d.sdp){await pc.setRemoteDescription(d.sdp);if(d.sdp.type==='offer'){await pc.setLocalDescription(await pc.createAnswer());send({t:'sig',to:from,data:{sdp:pc.localDescription}})}P.q?.forEach(c=>pc.addIceCandidate(c).catch(()=>{}));P.q=null}
 else if(d.c){if(pc.remoteDescription)pc.addIceCandidate(d.c).catch(()=>{});else(P.q=P.q||[]).push(d.c)}}
function dropPeer(id){const P=peers.get(id);if(!P)return;P.pc.close();P.a?.pause();P.gain?.disconnect();peers.delete(id);const o=players.get(id);if(o)o.speak=false}
async function joinChan(ch,ids){chan=ch;[...peers.keys()].forEach(dropPeer);updVoiceBtn();
 for(const id of ids){const P=mkPeer(id);await P.pc.setLocalDescription(await P.pc.createOffer());send({t:'sig',to:id,data:{sdp:P.pc.localDescription}})}}
function updGains(){const m=players.get(selfId);if(!m)return;peers.forEach((P,id)=>{const o=players.get(id);if(!P.gain||!o)return;const d=Math.hypot(o.x-m.x,o.z-m.z);P.gain.gain.value=vol*(chan==='public'&&spatial?clamp(1-(d-2)/14,0,1):1)})}
setInterval(()=>{const m=players.get(selfId);if(m)m.speak=!!(micOn&&localAn&&lv(localAn)>18);peers.forEach((P,id)=>{const o=players.get(id);if(o&&P.an)o.speak=lv(P.an)>18})},120);
async function acquire(){const s=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,deviceId:devId?{exact:devId}:undefined}});micTrack?.stop();micTrack=s.getAudioTracks()[0];micTrack.enabled=micOn;
 actx.createMediaStreamSource(s).connect(localAn=actx.createAnalyser());peers.forEach(P=>P.tr.sender.replaceTrack(micTrack));
 const ds=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind=='audioinput');$('#dev').innerHTML=ds.map(d=>`<option value="${esc(d.deviceId)}" ${d.deviceId==devId?'selected':''}>${esc(d.label||'مايكروفون')}</option>`).join('')}
async function toggleMic(){actx?.resume();try{if(!micTrack)await acquire();micOn=!micOn;micTrack.enabled=micOn;send({t:'mic',on:micOn});const m=players.get(selfId);if(m){m.mic=micOn;tagText(m)}
 $$('.micbtn').forEach(b=>b.textContent=micOn?'🎤 المايك يعمل':'🔇 المايك مغلق')}catch{toast('تعذر تشغيل المايك: اسمح بالإذن وتأكد أن الموقع على HTTPS')}}
$$('.micbtn').forEach(b=>b.onclick=toggleMic);
$('#dev').onchange=async e=>{devId=e.target.value;try{await acquire()}catch{}};$('#vol').oninput=e=>vol=+e.target.value;$('#spat').onchange=e=>spatial=e.target.checked;
function updVoiceBtn(){const b=$('#vbtn'),r=myRooms.find(x=>x.id===chan);$('#chanLbl').textContent=chan==='public'?'الصوت: عام':'🔒 صوت خاص: '+(r?.name||'');
 b.hidden=cur==='public'&&chan==='public';b.textContent=chan===cur?'🔊 العودة للصوت العام':(cur==='public'?'🔊 العودة للصوت العام':'🎧 ادخل صوت هذه الغرفة');
 b.onclick=()=>send({t:'voice',ch:cur==='public'||chan===cur?'public':cur})}

/* ---------- الأصدقاء والغرف ---------- */
function row(u,btns,sub){const d=document.createElement('div');d.className='row';const i=new Image();i.src=portraits[u.avatar];const t=document.createElement('div');t.innerHTML='<b>'+esc(u.name)+'</b><br><small>'+sub+'</small>';d.append(i,t);btns.forEach(([l,f])=>d.append(btn(l,f)));return d}
const loadFriends=async()=>{try{friends=await api('friends');renderFriends();renderRoomsPanel()}catch{}};
function renderFriends(){const L=$('#flist');L.innerHTML='';friends.incoming.forEach(u=>L.append(row(u,[['✔',()=>respond(u.id,1)],['✖',()=>respond(u.id,0)]],'يريد أن يكون صديقك')));
 friends.friends.forEach(u=>L.append(row(u,[['💬',()=>privateWith(u)]],u.online?'🟢 متصل':'⚪ غير متصل')));if(!friends.friends.length&&!friends.incoming.length)L.textContent='لا أصدقاء بعد. ابحث عن شخص بالأعلى وأضفه.'}
const respond=async(id,accept)=>{await api('friend/respond',{id,accept});loadFriends()};
function privateWith(u){if(!u.online)return toast('صديقك غير متصل الآن');pendingInvite=u.id;send({t:'room+',name:me.name+' و '+u.name});$('#drawer').hidden=true}
let st;$('#fs').oninput=e=>{clearTimeout(st);st=setTimeout(async()=>{const q=e.target.value.trim(),L=$('#fres');L.innerHTML='';if(!q)return;
 try{(await api('search?q='+encodeURIComponent(q))).forEach(u=>L.append(row(u,[['➕',async()=>{try{await api('friend',{name:u.name});toast('أُرسل الطلب')}catch(x){toast(x.message)}}]],u.online?'🟢 متصل':'⚪ غير متصل')))}catch{}},300)};
$('#rmk').onclick=()=>{const n=$('#rn').value.trim();if(n){send({t:'room+',name:n});$('#rn').value=''}};
function renderRoomsPanel(){const L=$('#rlist');L.innerHTML='';if(!myRooms.length)L.textContent='لا غرف بعد. أنشئ غرفة وادعُ أصدقاءك.';
 myRooms.forEach(r=>{const d=document.createElement('div');d.className='card';d.innerHTML=`<b>🔒 ${esc(r.name)}</b><small>${r.members.map(esc).join('، ')}</small>`;
  const on=friends.friends.filter(f=>f.online&&!r.members.includes(f.name)),s=document.createElement('select');s.innerHTML=on.map(f=>`<option value="${f.id}">${esc(f.name)}</option>`).join('')||'<option value="">لا أصدقاء متصلون للدعوة</option>';
  d.append(s,btn('📨 دعوة',()=>{if(s.value){send({t:'invite',room:r.id,to:+s.value});toast('أُرسلت الدعوة')}}),btn(r.owner===selfId?'إغلاق الغرفة':'مغادرة الغرفة',()=>send({t:r.owner===selfId?'closeRoom':'leaveRoom',room:r.id})));L.append(d)})}

/* ---------- الشبكة ---------- */
function connect(){ws=new WebSocket((location.protocol==='https:'?'wss':'ws')+'://'+location.host+'/ws?t='+token);
 ws.onmessage=async ev=>{const m=JSON.parse(ev.data);switch(m.t){
  case'hello':selfId=m.self;players.forEach((_,id)=>removePlayer(id));m.players.forEach(addPlayer);{const s=players.get(selfId);s.x=s.tx=(Math.random()-.5)*8;s.z=s.tz=11;cy=0}myRooms=m.rooms;renderTabs();loadFriends();send({t:'voice',ch:'public'});break;
  case'join':addPlayer(m.p);if(!$('#drawer').hidden)loadFriends();break;
  case'leave':removePlayer(m.id);dropPeer(m.id);if(!$('#drawer').hidden)loadFriends();break;
  case'move':{const o=players.get(m.id);if(o)Object.assign(o,{tx:m.x,tz:m.z,try:m.ry,sit:m.sit});break}
  case'mic':{const o=players.get(m.id);if(o){o.mic=m.on;tagText(o)}break}
  case'chat':addMsg(m);break;
  case'rooms':myRooms=m.rooms;if(m.created){cur=m.created;if(pendingInvite){send({t:'invite',room:m.created,to:pendingInvite});pendingInvite=null}}renderTabs();renderRoomsPanel();break;
  case'invite':send({t:'accept',room:m.room,ok:confirm(m.from+' يدعوك إلى الغرفة الخاصة «'+m.name+'». هل تقبل؟')});break;
  case'friends':toast('وصلك طلب صداقة جديد');loadFriends();break;
  case'vpeers':joinChan(m.ch,m.ids);break;
  case'vjoin':break;
  case'vleave':dropPeer(m.id);break;
  case'sig':onSig(m.from,m.data);break}};
 ws.onclose=e=>{if(e.code===4001){localStorage.removeItem('sv_t');location.reload()}else if(e.code===4002)toast('فُتح حسابك من جهاز آخر');else{toast('انقطع الاتصال… نعيد المحاولة');setTimeout(connect,2000)}}}
function enter(){show('');$('#world').hidden=false;actx=new AudioContext();addEventListener('pointerdown',()=>actx.resume(),{once:true});initWorld();connect();
 if(matchMedia('(pointer:coarse)').matches)$('#chat').style.height='30vh';$('#pname').textContent=me.name;$('#bio').value=me.bio||'';grid($('#pav'),me.avatar,i=>pick=i);$('#qual').value=quality}
$$('[data-p]').forEach(b=>b.onclick=()=>{const d=$('#drawer'),same=!d.hidden&&d.dataset.cur===b.dataset.p;d.hidden=same;d.dataset.cur=b.dataset.p;$$('[data-pn]').forEach(p=>p.hidden=p.dataset.pn!==b.dataset.p);if(!same&&b.dataset.p!='audio'&&b.dataset.p!='settings')loadFriends()});
$('#psave').onclick=async()=>{try{me=await api('profile',{avatar:pick,bio:$('#bio').value});toast('تم الحفظ، أعد الدخول ليراك الجميع بشكلك الجديد')}catch(x){toast(x.message)}};
$('#qual').onchange=e=>{quality=+e.target.value;localStorage.sv_q=quality;resize()};$('#names').onchange=e=>showNames=e.target.checked;

makePortraits();$('#strip').innerHTML=[3,26,8,31,14,22].map(i=>`<img alt="" src="${portraits[i]}">`).join('');
(async()=>{if(token){try{me=await api('me');pick=me.avatar;enter();return}catch{localStorage.removeItem('sv_t')}}show('landing')})();
