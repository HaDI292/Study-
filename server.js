import express from 'express';import {WebSocketServer} from 'ws';import Database from 'better-sqlite3';
import crypto from 'node:crypto';import http from 'node:http';import fs from 'node:fs';import path from 'node:path';
const PORT=process.env.PORT||3000,TTL=5*60*1000,UP='uploads';
fs.mkdirSync(UP,{recursive:true});for(const f of fs.readdirSync(UP))fs.rmSync(path.join(UP,f)); // الملفات المؤقتة تُمسح عند التشغيل
const db=new Database(process.env.DB||'studyverse.db');
db.exec(`create table if not exists users(id integer primary key,name text unique collate nocase,hash text,salt text,avatar int default 0,bio text default '');
create table if not exists sessions(token text primary key,uid int);
create table if not exists friends(a int,b int,ok int default 0,primary key(a,b));`);
const q=s=>db.prepare(s),U=id=>q('select * from users where id=?').get(id);
const hash=(p,s)=>crypto.scryptSync(p,s,32).toString('hex');
const clients=new Map(),rooms=new Map(),files=new Map();
const pub=u=>({id:u.id,name:u.name,avatar:u.avatar,bio:u.bio,online:clients.has(u.id)});
const session=id=>{const token=crypto.randomBytes(32).toString('hex');q('insert into sessions values(?,?)').run(token,id);return{token,me:pub(U(id))}};
const app=express();app.use(express.json());app.get('/',(_,r)=>r.sendFile(path.resolve('index.html')));app.get('/app.js',(_,r)=>r.sendFile(path.resolve('app.js')));
const authz=(req,res,next)=>{const t=req.headers.authorization?.slice(7)||req.query.t;const r=t&&q('select uid from sessions where token=?').get(t);if(!r)return res.status(401).json({error:'سجّل الدخول أولًا'});req.uid=r.uid;next()};
app.post('/api/register',(req,res)=>{const{name,password,avatar}=req.body;
 if(!/^[\w\u0600-\u06FF]{3,20}$/.test(name||'')||(password||'').length<6)return res.status(400).json({error:'اسم المستخدم من 3 إلى 20 حرفًا وكلمة المرور 6 أحرف على الأقل'});
 if(q('select 1 from users where name=?').get(name))return res.status(409).json({error:'اسم المستخدم مستخدم، جرّب اسمًا آخر'});
 const salt=crypto.randomBytes(16).toString('hex');
 res.json(session(q('insert into users(name,hash,salt,avatar) values(?,?,?,?)').run(name,hash(password,salt),salt,Math.min(39,Math.max(0,avatar|0))).lastInsertRowid))});
app.post('/api/login',(req,res)=>{const u=q('select * from users where name=?').get(String(req.body.name||''));
 const ok=u&&crypto.timingSafeEqual(Buffer.from(hash(String(req.body.password||''),u.salt)),Buffer.from(u.hash));
 if(!ok)return res.status(401).json({error:'اسم المستخدم أو كلمة المرور غير صحيحة'});res.json(session(u.id))});
app.get('/api/me',authz,(req,res)=>res.json(pub(U(req.uid))));
app.post('/api/profile',authz,(req,res)=>{q('update users set avatar=?,bio=? where id=?').run(Math.min(39,Math.max(0,req.body.avatar|0)),String(req.body.bio||'').slice(0,140),req.uid);res.json(pub(U(req.uid)))});
app.get('/api/search',authz,(req,res)=>res.json(q('select * from users where name like ? and id!=? limit 10').all('%'+String(req.query.q||'').replace(/[%_]/g,'')+'%',req.uid).map(pub)));
app.get('/api/friends',authz,(req,res)=>{const i=req.uid;res.json({
 friends:q('select u.* from users u join friends f on ((f.a=? and f.b=u.id) or (f.b=? and f.a=u.id)) where f.ok=1').all(i,i).map(pub),
 incoming:q('select u.* from users u join friends f on f.a=u.id where f.b=? and f.ok=0').all(i).map(pub)})});
app.post('/api/friend',authz,(req,res)=>{const o=q('select * from users where name=?').get(String(req.body.name||''));
 if(!o||o.id===req.uid)return res.status(404).json({error:'المستخدم غير موجود'});
 if(q('select 1 from friends where a=? and b=?').get(o.id,req.uid))q('update friends set ok=1 where a=? and b=?').run(o.id,req.uid);
 else q('insert or ignore into friends(a,b) values(?,?)').run(req.uid,o.id);
 send(clients.get(o.id),{t:'friends'});res.json({ok:1})});
app.post('/api/friend/respond',authz,(req,res)=>{const{id,accept}=req.body;
 accept?q('update friends set ok=1 where a=? and b=?').run(id,req.uid):q('delete from friends where a=? and b=?').run(id,req.uid);res.json({ok:1})});
// رفع الملفات: تُحذف بعد انتهاء الرسالة (5 دقائق)
app.post('/api/upload',authz,express.raw({type:'*/*',limit:'25mb'}),(req,res)=>{
 const name=decodeURIComponent(req.headers['x-filename']||'file').replace(/[\\/]/g,'_').slice(0,100);
 if(!req.body?.length||/\.(exe|bat|cmd|sh|js|mjs|html?|svg|php|msi|jar|dll|apk)$/i.test(name))return res.status(400).json({error:'نوع الملف غير مسموح'});
 const id=crypto.randomBytes(12).toString('hex'),type=String(req.headers['x-filetype']||'application/octet-stream').slice(0,100);
 fs.writeFileSync(path.join(UP,id),req.body);files.set(id,{name,size:req.body.length,type,exp:Date.now()+TTL,uid:req.uid});res.json({id})});
app.get('/files/:id',authz,(req,res)=>{const f=files.get(req.params.id);if(!f)return res.sendStatus(404);
 const inline=!req.query.dl&&(/^(image|video|audio)\/(?!svg)/.test(f.type)||f.type==='application/pdf');
 res.set({'Content-Type':inline?f.type:'application/octet-stream','Content-Disposition':`${inline?'inline':'attachment'}; filename*=UTF-8''${encodeURIComponent(f.name)}`,'X-Content-Type-Options':'nosniff'});
 fs.createReadStream(path.join(UP,req.params.id)).pipe(res)});
setInterval(()=>{for(const[id,f]of files)if(f.exp<Date.now()){files.delete(id);fs.rm(path.join(UP,id),()=>{})}},15000);

app.use((err,req,res,next)=>{console.error(err);res.status(500).json({error:'خطأ في الخادم: '+String(err.message).slice(0,120)})});
const server=http.createServer(app),wss=new WebSocketServer({server,path:'/ws',maxPayload:64*1024});
const send=(c,o)=>c&&c.ws.readyState===1&&c.ws.send(JSON.stringify(o));
const all=o=>clients.forEach(c=>send(c,o)),view=c=>({id:c.id,name:c.name,avatar:c.avatar,x:c.x,z:c.z,ry:c.ry,sit:c.sit,mic:c.mic});
const inChan=ch=>[...clients.values()].filter(c=>c.voice===ch);
const myRooms=id=>[...rooms.values()].filter(r=>r.members.has(id)).map(r=>({id:r.id,name:r.name,owner:r.owner,members:[...r.members].map(i=>clients.get(i)?.name||'؟')}));
const pushRooms=(r,created)=>r.members.forEach(i=>send(clients.get(i),{t:'rooms',rooms:myRooms(i),created:created===i?r.id:undefined}));
function leaveVoice(c){inChan(c.voice).forEach(o=>o!==c&&send(o,{t:'vleave',id:c.id}))}
function joinVoice(c,ch){ // الصوت الخاص منفصل تمامًا: لا اتصالات WebRTC إلا بين أعضاء نفس القناة
 if(ch!=='public'&&!rooms.get(ch)?.members.has(c.id))ch='public';
 leaveVoice(c);c.voice=ch;const others=inChan(ch).filter(o=>o!==c);
 send(c,{t:'vpeers',ch,ids:others.map(o=>o.id)});others.forEach(o=>send(o,{t:'vjoin',id:c.id}))}
function closeRoom(r){rooms.delete(r.id);r.members.forEach(i=>{const o=clients.get(i);if(o){if(o.voice===r.id)joinVoice(o,'public');send(o,{t:'rooms',rooms:myRooms(i)})}})}
function leaveRoom(c,id){const r=rooms.get(id);if(!r||!r.members.has(c.id))return;if(r.owner===c.id)return closeRoom(r);
 r.members.delete(c.id);if(c.voice===id)joinVoice(c,'public');send(c,{t:'rooms',rooms:myRooms(c.id)});pushRooms(r)}
wss.on('connection',(ws,req)=>{
 const r=q('select uid from sessions where token=?').get(new URL(req.url,'http://x').searchParams.get('t'));if(!r)return ws.close(4001);
 const u=U(r.uid);clients.get(u.id)?.ws.close(4002);
 const c={ws,id:u.id,name:u.name,avatar:u.avatar,x:0,z:11,ry:0,sit:0,mic:false,voice:'public'};clients.set(c.id,c);
 send(c,{t:'hello',self:c.id,players:[...clients.values()].map(view),rooms:myRooms(c.id)});all({t:'join',p:view(c)});
 ws.on('message',d=>{let m;try{m=JSON.parse(d)}catch{return}handle(c,m)});
 ws.on('close',()=>{if(clients.get(c.id)!==c)return;leaveVoice(c);for(const rm of[...rooms.values()])leaveRoom(c,rm.id);clients.delete(c.id);all({t:'leave',id:c.id})})});
function handle(c,m){switch(m.t){
 case'move':Object.assign(c,{x:+m.x||0,z:+m.z||0,ry:+m.ry||0,sit:m.sit?1:0});clients.forEach(o=>o!==c&&send(o,{t:'move',id:c.id,x:c.x,z:c.z,ry:c.ry,sit:c.sit}));break;
 case'chat':{const room=m.room==='public'?null:rooms.get(m.room);if(m.room!=='public'&&!room?.members.has(c.id))return;
  const text=String(m.text||'').slice(0,500),f=m.file&&files.get(m.file);if(f&&f.uid!==c.id)return;if(!text&&!f)return;
  const msg={t:'chat',room:m.room,from:c.id,name:c.name,avatar:c.avatar,text,reply:m.reply?String(m.reply).slice(0,100):null,ttl:TTL,file:f?{id:m.file,name:f.name,size:f.size,type:f.type}:null};
  if(f)f.exp=Date.now()+TTL+5000; // الملف يبقى حتى تنتهي رسالته فقط
  (room?[...room.members].map(i=>clients.get(i)):[...clients.values()]).forEach(o=>send(o,msg));break}
 case'mic':c.mic=!!m.on;all({t:'mic',id:c.id,on:c.mic});break;
 case'voice':joinVoice(c,m.ch);break;
 case'sig':{const o=clients.get(m.to);if(o&&o.voice===c.voice)send(o,{t:'sig',from:c.id,data:m.data});break}
 case'room+':{const id=crypto.randomBytes(4).toString('hex'),r={id,name:String(m.name||'غرفة').slice(0,30),owner:c.id,members:new Set([c.id]),invited:new Set()};rooms.set(id,r);pushRooms(r,c.id);break}
 case'invite':{const r=rooms.get(m.room),o=clients.get(m.to);if(r?.members.has(c.id)&&o&&!r.members.has(o.id)){r.invited.add(o.id);send(o,{t:'invite',room:r.id,name:r.name,from:c.name})}break}
 case'accept':{const r=rooms.get(m.room);if(!r?.invited.has(c.id))break;r.invited.delete(c.id);if(m.ok){r.members.add(c.id);pushRooms(r)}break}
 case'leaveRoom':leaveRoom(c,m.room);break;
 case'closeRoom':{const r=rooms.get(m.room);if(r?.owner===c.id)closeRoom(r)}}}
server.listen(PORT,()=>console.log('StudyVerse on http://localhost:'+PORT));
