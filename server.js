/**
 * ACIAPA — Backend Completo v2.0
 * Auth JWT · CRM · Financeiro · WhatsApp · IA · Kanban
 */
"use strict";
require("dotenv").config();
const express   = require("express");
const cors      = require("cors");
const http      = require("http");
const { Server }= require("socket.io");
const multer    = require("multer");
const XLSX      = require("xlsx");
const jwt       = require("jsonwebtoken");
const bcrypt    = require("bcryptjs");
const cron      = require("node-cron");
const path      = require("path");
const fs        = require("fs");
const qrcode    = require("qrcode");
const rateLimit = require("express-rate-limit");
const nodemailer= require("nodemailer");
const Bonjour = require("bonjour-service");
const db        = require("./db");

// ── mDNS advertiser (descoberta automática na rede) ──
let bonjour = null;
try {
  bonjour = new Bonjour();
  bonjour.publish({
    name: "ACIAPA Server",
    type: "aciapa",
    protocol: "tcp",
    port: process.env.PORT || 3001,
    txt: { versao: "2.2.0", nome: "ACIAPA" },
  });
  console.log(`  ✓ mDNS: ACIAPA anunciado na rede como 'ACIAPA Server'`);
} catch (e) {
  console.log("  ⚠ mDNS não disponível:", e.message);
}

const isPkg = typeof process.pkg !== "undefined";
const basePath = isPkg ? path.dirname(process.execPath) : __dirname;

// Diretorios customizaveis (usados pelo Electron para gravar em APPDATA em vez de Program Files)
const AUTH_DIR  = process.env.ACIAPA_AUTH_DIR || "auth_info";
const UPLOADS_DIR = process.env.ACIAPA_UPLOADS_DIR || "uploads";
[AUTH_DIR, UPLOADS_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors:{ origin:"*" } });

app.use(cors());
app.use(express.json({ limit:"50mb" }));

// Resolve a pasta dist de forma robusta para rodar localmente ou empacotado no Electron
let distPath = path.join(__dirname, "dist");
if (!isPkg && !fs.existsSync(distPath)) {
  const asarPath = path.join(__dirname, "..", "app.asar", "dist");
  if (fs.existsSync(asarPath)) {
    distPath = asarPath;
  }
}
app.use(express.static(distPath));
if (isPkg) app.use(express.static(path.join(basePath,"dist")));

// Servir boletos gerados de forma independente da pasta dist do ASAR (que é somente leitura)
app.use("/boletos", express.static(path.join(basePath, "dist", "boletos")));

const upload     = multer({ dest: UPLOADS_DIR + "/", limits:{ fileSize:50*1024*1024 } });
const JWT_SECRET = process.env.JWT_SECRET || "aciapa_jwt_2025_fallback_key";

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Muitas tentativas. Tente novamente em 15 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Helpers ──────────────────────────────────────────────────────────────────
const uid   = () => Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const fmt   = v  => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v||0);
const hoje  = () => new Date().toISOString().split("T")[0];
const mesN  = () => new Date().getMonth()+1;
const anoN  = () => new Date().getFullYear();

function diasAtraso(venc) {
  const d=new Date(venc),h=new Date();
  return d<h ? Math.floor((h-d)/86400000) : 0;
}
function calcSit(c) {
  if (c.status!=="ativo") return "inativo";
  const m=mesN(),a=anoN();
  if (c.pagamentos?.some(p=>p.mes===m&&p.ano===a&&p.pago)) return "em_dia";
  const venc=new Date(c.dataVencimento),h=new Date();
  if (venc<h) return "atrasado";
  if ((venc-h)/86400000<=5) return "vencendo";
  return "a_vencer";
}

// ── Auth middleware ───────────────────────────────────────────────────────────
const auth = (roles=[]) => (req,res,next) => {
  const h=req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return res.status(401).json({error:"Não autenticado"});
  try {
    const p=jwt.verify(h.slice(7),JWT_SECRET);
    const u=db.users.findById(p.id);
    if (!u||!u.ativo) return res.status(401).json({error:"Usuário inativo"});
    if (roles.length&&!roles.includes(u.role)&&u.role!=="super_admin") return res.status(403).json({error:"Sem permissão"});
    req.user=u; next();
  } catch { res.status(401).json({error:"Token inválido"}); }
};

// ── Versão e Diagnóstico ──────────────────────────────────────────────────────
let pkg = { version: "2.0.0", name: "aciapa", description: "" };
try {
  pkg = require("./package.json");
} catch {
  try {
    const fs = require("fs");
    const path = require("path");
    const asarPkgPath = path.join(__dirname, "..", "app.asar", "package.json");
    if (fs.existsSync(asarPkgPath)) {
      pkg = JSON.parse(fs.readFileSync(asarPkgPath, "utf8"));
    }
  } catch {}
}

// ── Descoberta automática na rede local ──
app.get("/api/discover", (_, res) => {
  const os = require("os");
  const nets = Object.values(os.networkInterfaces()).flat().filter(i => i.family === "IPv4" && !i.internal).map(i => i.address);
  res.json({
    nome: "ACIAPA",
    versao: pkg.version,
    hostname: os.hostname(),
    ip: nets[0] || "unknown",
    porta: process.env.PORT || 3001,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/versao", (_, res) => {
  res.json({
    versao: pkg.version,
    nome: pkg.name,
    descricao: pkg.description,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/admin/diagnostico", auth(["super_admin"]), (req, res) => {
  const stats = getStats();
  res.json({
    versao: pkg.version,
    node: process.version,
    plataforma: process.platform,
    memoria: process.memoryUsage(),
    uptime: process.uptime(),
    data: new Date().toISOString(),
    waStatus,
    waQueueSize: waQueue.length,
    stats: {
      clientes: stats.totalClientes,
      ativos: stats.ativos,
      transacoes: db.transacoes.count(),
      kanban: db.kanban.count(),
      produtos: db.produtos.count(),
      funcionarios: db.rh.count(),
      mensagens: db.mensagens.count(),
    },
  });
});

// ── Stats ─────────────────────────────────────────────────────────────────────
function getStats() {
  const todos=db.clientes.all, ativos=todos.filter(c=>c.status==="ativo");
  const emDia=ativos.filter(c=>calcSit(c)==="em_dia").length;
  const atrasados=ativos.filter(c=>calcSit(c)==="atrasado").length;
  const vencendo=ativos.filter(c=>calcSit(c)==="vencendo").length;
  const m=mesN(),a=anoN();
  const transMes=db.transacoes.all.filter(t=>{const d=new Date(t.data);return d.getMonth()+1===m&&d.getFullYear()===a;});
  const receitaMes=transMes.filter(t=>t.tipo==="entrada").reduce((s,t)=>s+t.valor,0);
  const despesasMes=transMes.filter(t=>t.tipo==="saida").reduce((s,t)=>s+t.valor,0);
  const receitaTotal=db.transacoes.find({tipo:"entrada"}).reduce((s,t)=>s+t.valor,0);
  const inadimplencia=ativos.filter(c=>calcSit(c)==="atrasado").reduce((s,c)=>s+c.valor,0);
  return {
    totalClientes:todos.length,ativos:ativos.length,inativos:todos.length-ativos.length,
    emDia,atrasados,vencendo,aVencer:ativos.length-emDia-atrasados-vencendo,
    receitaMes,despesasMes,saldoMes:receitaMes-despesasMes,
    receitaTotal,inadimplencia,receitaPotencial:ativos.reduce((s,c)=>s+c.valor,0),
    percentualAdimplencia:ativos.length>0?Math.round(emDia/ativos.length*100):0,
    kanbanTotal:db.kanban.count(),
    mensagensHoje:db.mensagens.all.filter(m=>m.timestamp?.startsWith(hoje())).length,
    campanhasAtivas:db.campanhas.find({status:"running"}).length,
    listAtrasados:ativos.filter(c=>calcSit(c)==="atrasado").map(c=>({...c,_diasAtraso:diasAtraso(c.dataVencimento)})).sort((a,b)=>b._diasAtraso-a._diasAtraso),
    listVencendo:ativos.filter(c=>calcSit(c)==="vencendo"),
    aniversariantesHoje:db.aniversariantes.all.filter(a=>{const p=a.dataNascimento?.split("-");if(!p||p.length<3)return false;const h=new Date();return +p[1]===h.getMonth()+1&&+p[2]===h.getDate();}),
    aniversariantesProximos:db.aniversariantes.all.filter(a=>{const p=a.dataNascimento?.split("-");if(!p||p.length<3)return false;const h=new Date();const dm=new Date(h.getFullYear(),+p[1]-1,+p[2]);const dif=Math.round((dm.getTime()-h.getTime())/86400000);return dif>=0&&dif<=2&&!((+p[1]===h.getMonth()+1)&&(+p[2]===h.getDate()));}),
  };
}

// ── WhatsApp ──────────────────────────────────────────────────────────────────
let waClient=null, waStatus="disconnected", waQR=null, waQueue=[], waProc=false;

async function initWA() {
  try {
    const { default:makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
    const pino=require("pino"); const { Boom }=require("@hapi/boom");
    if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR);
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();
    waClient = makeWASocket({ version, logger:pino({level:"silent"}), printQRInTerminal:false, auth:state, browser:["ACIAPA","Chrome","2.0"], shouldSyncHistoryMessage:()=>false });
    waClient.ev.on("connection.update", async({connection,lastDisconnect,qr})=>{
      if (qr) { waStatus="qr"; waQR=await qrcode.toDataURL(qr); io.emit("wa_qr",waQR); io.emit("wa_status",{status:"qr"}); }
      if (connection==="open")  { waStatus="connected"; waQR=null; io.emit("wa_status",{status:"connected"}); processWaQueue(); }
      if (connection==="close") {
        const r=new Boom(lastDisconnect?.error)?.output?.statusCode;
        waStatus="disconnected"; io.emit("wa_status",{status:"disconnected",reason:r});
        if (r!==DisconnectReason.loggedOut) setTimeout(initWA,5000);
        else { fs.rmSync(AUTH_DIR,{recursive:true,force:true}); fs.mkdirSync(AUTH_DIR); setTimeout(initWA,3000); }
      }
    });
    waClient.ev.on("creds.update", saveCreds);
    waClient.ev.on("messages.upsert",({messages,type})=>{
      if (type!=="notify") return;
      messages.filter(m=>!m.key.fromMe).forEach(m=>{
        const text=m.message?.conversation||m.message?.extendedTextMessage?.text||"";
        const from=m.key.remoteJid?.replace("@s.whatsapp.net","");
        if (text&&from) { const msg=db.mensagens.insert({de:from,texto:text,tipo:"recebida",timestamp:new Date().toISOString()}); io.emit("wa_mensagem_recebida",msg); }
      });
    });
  } catch(e) { waStatus="not_installed"; io.emit("wa_status",{status:"not_installed"}); console.log("[WA] Baileys nao instalado:",e.message); }
}

async function processWaQueue() {
  if (waProc||waStatus!=="connected") return;
  waProc=true;
  while (waQueue.length>0) {
    const item=waQueue.find(x=>x.status==="queued"); if (!item) break;
    item.status="sending"; io.emit("wa_queue_update",{id:item.id,status:"sending"});
    try {
      const cfg=db.settings.findOne({key:"empresa"})||{};
      await new Promise(r=>setTimeout(r,(cfg.minDelay||3)*1000+Math.random()*(cfg.maxDelay||8)*1000));
      const jid=item.telefone.replace(/\D/g,"").replace(/^(\d{10,11})$/,"55$1")+"@s.whatsapp.net";
      if (cfg.simulateTyping!==false) { await waClient.sendPresenceUpdate("composing",jid); await new Promise(r=>setTimeout(r,Math.min(item.mensagem.length*80,5000))); await waClient.sendPresenceUpdate("paused",jid); }
      await waClient.sendMessage(jid,{text:item.mensagem});
      item.status="sent"; io.emit("wa_queue_update",{id:item.id,status:"sent"});
      db.mensagens.insert({para:item.telefone,texto:item.mensagem,tipo:"enviada",campanhaId:item.campanhaId||null,timestamp:new Date().toISOString()});
    } catch(e) { item.status="failed"; io.emit("wa_queue_update",{id:item.id,status:"failed",error:e.message}); }
  }
  waProc=false;
}

// ── IA ────────────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
// API ROUTES
// ═══════════════════════════════════════════════════════════════════════════════
app.get("/api/status", (_,res)=>res.json({ok:true,version:"2.0.0",wa:waStatus}));
app.get("/api/stats",  auth(), (_,res)=>res.json(getStats()));

// AUTH
app.post("/api/auth/login", loginLimiter, async(req,res)=>{
  const {email,senha}=req.body;
  if(!email||!senha) return res.status(400).json({error:"Email e senha obrigatórios"});
  const u=db.users.findOne({email}); if(!u) return res.status(401).json({error:"Credenciais inválidas"});
  if(!u.ativo) return res.status(401).json({error:"Conta desativada"});
  if(!(await bcrypt.compare(senha,u.senha))) return res.status(401).json({error:"Credenciais inválidas"});
  const token=jwt.sign({id:u.id,role:u.role},JWT_SECRET,{expiresIn:"12h"});
  db.log(u.id,"auth","Login"); const {senha:_,...safe}=u; res.json({ok:true,token,user:safe});
});
app.get("/api/auth/me",     auth(), (req,res)=>{ const {senha:_,...u}=req.user; res.json(u); });
app.put("/api/auth/senha",  auth(), async(req,res)=>{ const {senhaAtual,novaSenha}=req.body; if(!(await bcrypt.compare(senhaAtual,req.user.senha))) return res.status(400).json({error:"Senha atual incorreta"}); if(!novaSenha||novaSenha.length<6) return res.status(400).json({error:"Nova senha deve ter no mínimo 6 caracteres"}); db.users.update(req.user.id,{senha:await bcrypt.hash(novaSenha,10)}); res.json({ok:true}); });

// USERS
app.get("/api/users",       auth(["super_admin","admin"]), (_,res)=>res.json(db.users.all.map(u=>({...u,senha:undefined}))));
app.post("/api/users",      auth(["super_admin"]), async(req,res)=>{ const {nome,email,senha,role,cor}=req.body; if(!nome||!email) return res.status(400).json({error:"Nome e email obrigatórios"}); if(db.users.findOne({email})) return res.status(400).json({error:"Email já existe"}); const pw=senha||"nexus123"; if(pw.length<6) return res.status(400).json({error:"Senha deve ter no mínimo 6 caracteres"}); const u=db.users.insert({nome,email,senha:await bcrypt.hash(pw,10),role:role||"atendimento",ativo:true,avatar:nome?.slice(0,2).toUpperCase()||"??",cor:cor||"#6366f1"}); res.json({ok:true,user:{...u,senha:undefined}}); });
app.put("/api/users/:id",   auth(["super_admin"]), (req,res)=>{ const u=db.users.update(req.params.id,req.body); res.json({ok:true,user:{...u,senha:undefined}}); });
app.delete("/api/users/:id",auth(["super_admin"]), (req,res)=>{ db.users.delete(req.params.id); res.json({ok:true}); });

// CLIENTES
app.get("/api/clientes", auth(), (req,res)=>{
  const {status,situacao,search,plano}=req.query;
  let list=db.clientes.all.map(c=>({...c,_situacao:calcSit(c),_diasAtraso:diasAtraso(c.dataVencimento)}));
  if(status&&status!=="todos") list=list.filter(c=>c.status===status);
  if(situacao&&situacao!=="todos") list=list.filter(c=>c._situacao===situacao);
  if(plano&&plano!=="todos") list=list.filter(c=>c.plano===plano);
  if(search){const q=search.toLowerCase();list=list.filter(c=>c.nome.toLowerCase().includes(q)||c.email.toLowerCase().includes(q)||c.telefone.includes(q));}
  res.json(list);
});
app.get("/api/clientes/export", auth(), (_,res)=>{ const rows=db.clientes.all.map(c=>({Nome:c.nome,Email:c.email,Telefone:c.telefone,Plano:c.plano,Valor:c.valor,Status:c.status,"Situação":calcSit(c),Vencimento:c.dataVencimento,"Dias Atraso":diasAtraso(c.dataVencimento),Cidade:c.cidade})); const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),"Clientes");const buf=XLSX.write(wb,{type:"buffer",bookType:"xlsx"});res.setHeader("Content-Disposition",`attachment; filename="clientes_${Date.now()}.xlsx"`);res.setHeader("Content-Type","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");res.send(buf); });
app.get("/api/clientes/:id",   auth(), (req,res)=>{ const c=db.clientes.findById(req.params.id); if(!c) return res.status(404).json({error:"Não encontrado"}); res.json({...c,_situacao:calcSit(c),_diasAtraso:diasAtraso(c.dataVencimento)}); });
app.post("/api/clientes",      auth(), (req,res)=>{
  const body={...req.body};
  if(body.portalSenha) body.portalSenha=bcrypt.hashSync(body.portalSenha,10);
  const c=db.clientes.insert({...body,pagamentos:[],tags:[],score:100});
  io.emit("data_update",{type:"cliente"}); res.json({ok:true,cliente:c});
});
app.put("/api/clientes/:id",   auth(), (req,res)=>{
  const body = { ...req.body };
  if (body.portalSenha) body.portalSenha = bcrypt.hashSync(body.portalSenha, 10);
  const c = db.clientes.update(req.params.id, body);
  io.emit("data_update", { type: "cliente" });
  res.json({ ok: true, cliente: c });
});
app.delete("/api/clientes/:id",auth(["super_admin","admin"]), (req,res)=>{ db.clientes.delete(req.params.id); io.emit("data_update",{type:"cliente"}); res.json({ok:true}); });
app.post("/api/clientes/:id/pagar", auth(), (req,res)=>{ const c=db.clientes.findById(req.params.id); if(!c) return res.status(404).json({error:"Não encontrado"}); const m=mesN(),a=anoN(),valor=req.body.valor||c.valor; if(!c.pagamentos) c.pagamentos=[]; const idx=c.pagamentos.findIndex(p=>p.mes===m&&p.ano===a); const pag={mes:m,ano:a,pago:true,dataPagamento:hoje(),valor}; if(idx>=0) c.pagamentos[idx]=pag; else c.pagamentos.push(pag); db.clientes.update(c.id,{pagamentos:c.pagamentos}); db.transacoes.insert({tipo:"entrada",categoria:"Mensalidade",descricao:`Mensalidade ${c.nome.split(" ")[0]}`,valor,data:hoje(),status:"pago",clienteId:c.id}); io.emit("data_update",{type:"pagamento"}); res.json({ok:true}); });
app.post("/api/clientes/import", auth(["super_admin","admin"]), upload.single("file"), (req,res)=>{ if(!req.file) return res.status(400).json({error:"Arquivo não enviado"}); try { const wb=XLSX.readFile(req.file.path);const ws=wb.Sheets[wb.SheetNames[0]];const rows=XLSX.utils.sheet_to_json(ws,{defval:""});let n=0; rows.forEach(r=>{ if(!r.nome&&!r.Nome) return; db.clientes.insert({nome:String(r.nome||r.Nome||"").trim(),email:String(r.email||r.Email||"").trim(),telefone:String(r.telefone||r.Telefone||"").replace(/\D/g,""),cpfCnpj:String(r.cpfCnpj||r["CPF/CNPJ"]||"").trim(),plano:String(r.plano||r.Plano||"Basic").trim(),valor:+(String(r.valor||r.Valor||"0").replace(/[R$\s.]/g,"").replace(",","."))||0,status:String(r.status||r.Status||"ativo").toLowerCase().includes("ativ")?"ativo":"inativo",dataVencimento:r.dataVencimento||hoje(),cidade:String(r.cidade||r.Cidade||"").trim(),segmento:String(r.segmento||r.Segmento||"").trim(),pagamentos:[],tags:[],score:100}); n++; }); fs.unlinkSync(req.file.path); io.emit("data_update",{type:"cliente"}); res.json({ok:true,importados:n}); } catch(e){ try{fs.unlinkSync(req.file.path);}catch(_){} res.status(500).json({error:e.message}); } });

// ASSOCIADOS
app.get("/api/associados", auth(), (req,res)=>{
  const {status,search}=req.query;
  let list=db.associados.all;
  if(status&&status!=="todos") list=list.filter(a=>a.status===status);
  if(search){const q=search.toLowerCase();list=list.filter(a=>a.nome.toLowerCase().includes(q)||a.email.toLowerCase().includes(q)||(a.telefone||"").includes(q));}
  res.json(list);
});
app.get("/api/associados/export", auth(), (_,res)=>{ const rows=db.associados.all.map(a=>({Codigo:a.codigo,Nome:a.nome,Email:a.email,Telefone:a.telefone,CPF:a.cpf,"Data de Entrada":a.dataEntrada,Status:a.status,Cidade:a.cidade})); const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),"Associados");const buf=XLSX.write(wb,{type:"buffer",bookType:"xlsx"});res.setHeader("Content-Disposition",`attachment; filename="associados_${Date.now()}.xlsx"`);res.setHeader("Content-Type","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");res.send(buf); });
app.get("/api/associados/:id",   auth(), (req,res)=>{ const a=db.associados.findById(req.params.id); if(!a) return res.status(404).json({error:"Não encontrado"}); res.json(a); });
app.post("/api/associados",      auth(), (req,res)=>{ const a=db.associados.insert(req.body); io.emit("data_update",{type:"associado"}); res.json({ok:true,associado:a}); });
app.put("/api/associados/:id",   auth(), (req,res)=>{ const a=db.associados.update(req.params.id,req.body); io.emit("data_update",{type:"associado"}); res.json({ok:true,associado:a}); });
app.delete("/api/associados/:id",auth(["super_admin","admin"]), (req,res)=>{ db.associados.delete(req.params.id); io.emit("data_update",{type:"associado"}); res.json({ok:true}); });
app.post("/api/associados/import", auth(["super_admin","admin"]), upload.single("file"), (req,res)=>{ if(!req.file) return res.status(400).json({error:"Arquivo não enviado"}); try { const wb=XLSX.readFile(req.file.path);const ws=wb.Sheets[wb.SheetNames[0]];const rows=XLSX.utils.sheet_to_json(ws,{defval:""});let n=0; rows.forEach(r=>{ if(!r.nome&&!r.Nome) return; db.associados.insert({nome:String(r.nome||r.Nome||"").trim(),codigo:String(r.codigo||r.Codigo||"").trim(),email:String(r.email||r.Email||"").trim(),telefone:String(r.telefone||r.Telefone||"").replace(/\D/g,""),cpf:String(r.cpf||r.CPF||"").trim(),dataEntrada:r.dataEntrada||hoje(),status:String(r.status||r.Status||"ativo").toLowerCase().includes("ativ")?"ativo":"inativo",cidade:String(r.cidade||r.Cidade||"").trim(),observacoes:""}); n++; }); fs.unlinkSync(req.file.path); io.emit("data_update",{type:"associado"}); res.json({ok:true,importados:n}); } catch(e){ try{fs.unlinkSync(req.file.path);}catch(_){} res.status(500).json({error:e.message}); } });

// ANIVERSARIANTES
app.get("/api/aniversariantes", auth(), (req,res)=>{ res.json(db.aniversariantes.all); });
app.post("/api/aniversariantes", auth(), (req,res)=>{ const a=db.aniversariantes.insert(req.body); io.emit("data_update",{type:"aniversariante"}); res.json({ok:true,aniversariante:a}); });
app.put("/api/aniversariantes/:id", auth(), (req,res)=>{ const a=db.aniversariantes.update(req.params.id,req.body); io.emit("data_update",{type:"aniversariante"}); res.json({ok:true,aniversariante:a}); });
app.delete("/api/aniversariantes/:id", auth(), (req,res)=>{ db.aniversariantes.delete(req.params.id); io.emit("data_update",{type:"aniversariante"}); res.json({ok:true}); });

// KANBAN
app.get("/api/kanban",         auth(), (_,res)=>res.json(db.kanban.all));
app.post("/api/kanban",        auth(), (req,res)=>{ const k=db.kanban.insert(req.body); io.emit("kanban_update",k); res.json({ok:true,card:k}); });
app.put("/api/kanban/:id",     auth(), (req,res)=>{ const k=db.kanban.update(req.params.id,req.body); io.emit("kanban_update",k); res.json({ok:true,card:k}); });
app.delete("/api/kanban/:id",  auth(), (req,res)=>{ db.kanban.delete(req.params.id); io.emit("kanban_update",{id:req.params.id,deleted:true}); res.json({ok:true}); });

// FINANCEIRO
app.get("/api/transacoes", auth(), (req,res)=>{ const {tipo,mes,ano,limit=100,offset=0}=req.query; let list=db.transacoes.all.sort((a,b)=>new Date(b.data)-new Date(a.data)); if(tipo&&tipo!=="todos") list=list.filter(t=>t.tipo===tipo); if(mes&&ano) list=list.filter(t=>{const d=new Date(t.data);return d.getMonth()+1===+mes&&d.getFullYear()===+ano;}); res.json({total:list.length,items:list.slice(+offset,+offset+ +limit)}); });
app.post("/api/transacoes",       auth(), (req,res)=>{ const t=db.transacoes.insert({...req.body,data:req.body.data||hoje()}); io.emit("data_update",{type:"transacao"}); res.json({ok:true,transacao:t}); });
app.delete("/api/transacoes/:id", auth(), (req,res)=>{ db.transacoes.delete(req.params.id); res.json({ok:true}); });
app.put("/api/transacoes/:id", auth(), (req,res)=>{ const t=db.transacoes.findById(req.params.id); if(!t) return res.status(404).json({error:"Transação não encontrada"}); const upd={...t,...req.body,updatedAt:new Date().toISOString()}; db.transacoes.insert(upd); io.emit("data_update",{type:"transacao"}); res.json({ok:true}); });
app.get("/api/analytics/mensal", auth(), (req,res)=>{ const a=req.query.ano?+req.query.ano:anoN(); const mn=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"]; res.json(mn.map((nome,i)=>{const m=i+1;const e=db.transacoes.find({tipo:"entrada"}).filter(t=>{const d=new Date(t.data);return d.getMonth()+1===m&&d.getFullYear()===a;}).reduce((s,t)=>s+t.valor,0);const s2=db.transacoes.find({tipo:"saida"}).filter(t=>{const d=new Date(t.data);return d.getMonth()+1===m&&d.getFullYear()===a;}).reduce((s,t)=>s+t.valor,0);return {nome,mes:m,entradas:e,saidas:s2,saldo:e-s2};})); });
app.get("/api/analytics/forecast",auth(), (_,res)=>{ const h=new Date(),mn=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"]; const hist=[1,2,3].map(i=>{const d=new Date(h);d.setMonth(d.getMonth()-i);const m=d.getMonth()+1,a=d.getFullYear();return db.transacoes.find({tipo:"entrada"}).filter(t=>{const x=new Date(t.data);return x.getMonth()+1===m&&x.getFullYear()===a;}).reduce((s,t)=>s+t.valor,0);}); const media=hist.reduce((s,v)=>s+v,0)/3; res.json({previsao:Array.from({length:6},(_,i)=>{const d=new Date(h);d.setMonth(d.getMonth()+i+1);return {nome:`${mn[d.getMonth()]}/${d.getFullYear()}`,previsto:Math.round(media*(0.95+Math.random()*0.1)),otimista:Math.round(media*1.15),pessimista:Math.round(media*0.85)};}),media:Math.round(media),potencial:getStats().receitaPotencial}); });
app.get("/api/export/financeiro", auth(), (req,res)=>{ const {mes,ano}=req.query; let list=db.transacoes.all; if(mes&&ano) list=list.filter(t=>{const d=new Date(t.data);return d.getMonth()+1===+mes&&d.getFullYear()===+ano;}); const rows=list.map(t=>({Tipo:t.tipo,Categoria:t.categoria,"Descrição":t.descricao,Valor:t.valor,Data:t.data})); const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),"Financeiro");const buf=XLSX.write(wb,{type:"buffer",bookType:"xlsx"});res.setHeader("Content-Disposition",`attachment; filename="financeiro_${Date.now()}.xlsx"`);res.setHeader("Content-Type","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");res.send(buf); });

// WHATSAPP
app.get("/api/wa/status",   auth(), (_,res)=>res.json({status:waStatus,qr:waQR}));
app.post("/api/wa/init",    auth(["super_admin","admin"]), (_,res)=>{ initWA(); res.json({ok:true}); });
app.post("/api/wa/logout",  auth(["super_admin","admin"]), async(_,res)=>{ try{await waClient?.logout();}catch(_){} if(fs.existsSync(AUTH_DIR)) fs.rmSync(AUTH_DIR,{recursive:true,force:true}); fs.mkdirSync(AUTH_DIR); waStatus="disconnected";waClient=null;io.emit("wa_status",{status:"disconnected"}); setTimeout(initWA,2000); res.json({ok:true}); });
app.post("/api/wa/send",    auth(), (req,res)=>{ const {telefone,mensagem,prioridade}=req.body; if(!telefone||!mensagem) return res.status(400).json({error:"telefone e mensagem obrigatórios"}); const item={id:uid(),telefone,mensagem,status:"queued",createdAt:new Date().toISOString()}; if(prioridade==="alta") waQueue.unshift(item); else waQueue.push(item); if(waStatus==="connected") processWaQueue(); io.emit("wa_queue_add",item); res.json({ok:true,id:item.id}); });
app.post("/api/wa/campanha",auth(["super_admin","admin","financeiro"]), (req,res)=>{ const {nome,contatos,mensagem}=req.body; if(!contatos?.length||!mensagem) return res.status(400).json({error:"contatos[] e mensagem obrigatórios"}); const camp=db.campanhas.insert({nome:nome||"Campanha "+new Date().toLocaleDateString("pt-BR"),mensagem,total:contatos.length,enviados:0,falhas:0,status:"running"}); const items=contatos.map(c=>({id:uid(),telefone:c.telefone||c,mensagem:mensagem.replace(/\{\{nome\}\}/gi,c.nome||"").replace(/\{\{valor\}\}/gi,fmt(c.valor||0)).replace(/\{\{vencimento\}\}/gi,c.dataVencimento||""),status:"queued",campanhaId:camp.id,createdAt:new Date().toISOString()})); waQueue.push(...items); if(waStatus==="connected") processWaQueue(); io.emit("campanha_add",camp); res.json({ok:true,campanhaId:camp.id,total:items.length}); });
app.get("/api/wa/queue",      auth(), (_,res)=>res.json({total:waQueue.length,items:waQueue.slice(0,50)}));
app.delete("/api/wa/queue",   auth(), (_,res)=>{ waQueue=waQueue.filter(x=>x.status!=="queued"); res.json({ok:true}); });
app.post("/api/wa/queue/pause", auth(), (_,res)=>{ waProc=false; res.json({status:"paused"}); });
app.post("/api/wa/queue/resume",auth(), (_,res)=>{ processWaQueue(); res.json({status:"running"}); });
app.get("/api/wa/mensagens",  auth(), (req,res)=>{ const {telefone,limit=50}=req.query; let l=db.mensagens.all.sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp)); if(telefone) l=l.filter(m=>m.de===telefone||m.para===telefone); res.json(l.slice(0,+limit)); });
app.get("/api/wa/campanhas",  auth(), (_,res)=>res.json(db.campanhas.all));
app.get("/api/wa/templates",  auth(), (_,res)=>res.json(db.templates.all));
app.post("/api/wa/templates", auth(), (req,res)=>{ const t=db.templates.insert(req.body); res.json({ok:true,template:t}); });
app.put("/api/wa/templates/:id", auth(), (req,res)=>{ const t=db.templates.update(req.params.id,req.body); res.json({ok:true,template:t}); });
app.delete("/api/wa/templates/:id",auth(), (req,res)=>{ db.templates.delete(req.params.id); res.json({ok:true}); });

// IA
app.post("/api/ia/chat", auth(), async(req,res)=>{ const {mensagem}=req.body; if(!mensagem) return res.status(400).json({error:"Mensagem vazia"}); try { const resp=await queryIA(mensagem); const entry=db.chatIA.insert({userId:req.user.id,pergunta:mensagem,resposta:resp,timestamp:new Date().toISOString()}); res.json({ok:true,id:entry.id,...resp}); } catch(e){ res.status(500).json({error:e.message}); } });
app.get("/api/ia/historico", auth(), (_,res)=>res.json(db.chatIA.all.slice(0,50)));
app.delete("/api/ia/chat",   auth(), (_,res)=>{ db.chatIA.deleteMany({}); res.json({ok:true}); });

// AGENDA
app.get("/api/agenda/vencimentos", auth(), (_,res)=>{ const l=db.clientes.find({status:"ativo"}).map(c=>({...c,_situacao:calcSit(c),_diasAtraso:diasAtraso(c.dataVencimento)})).sort((a,b)=>a._diasAtraso-b._diasAtraso); res.json(l.slice(0,30)); });
app.get("/api/agenda/compromissos", auth(), (_,res)=>res.json(db.agenda.all.sort((a,b)=>new Date(a.data||0)-new Date(b.data||0))));
app.post("/api/agenda/compromissos", auth(), (req,res)=>{
  const item=db.agenda.insert({
    tipo:req.body.tipo||"reuniao",
    titulo:req.body.titulo||"Compromisso",
    data:req.body.data||hoje(),
    hora:req.body.hora||"",
    local:req.body.local||"",
    participantes:req.body.participantes||"",
    observacoes:req.body.observacoes||"",
    status:req.body.status||"agendado",
    userId:req.user.id,
  });
  res.json({ok:true,compromisso:item});
});
app.put("/api/agenda/compromissos/:id", auth(), (req,res)=>{
  const item=db.agenda.update(req.params.id,req.body);
  if(!item) return res.status(404).json({error:"Compromisso nao encontrado"});
  res.json({ok:true,compromisso:item});
});
app.delete("/api/agenda/compromissos/:id", auth(), (req,res)=>{ db.agenda.delete(req.params.id); res.json({ok:true}); });

// ADVOCACIA
const advItems = categoria => db.advocacia.find({categoria}).sort((a,b)=>new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt));
const advSafe = item => {
  const {categoria, ...rest}=item;
  return rest;
};

app.get("/api/advocacia/resumo", auth(), (_,res)=>{
  const processos=db.advocacia.find({categoria:"processo"});
  const peticoes=db.advocacia.find({categoria:"peticao"});
  const arquivos=db.advocacia.find({categoria:"arquivo"});
  res.json({
    totalProcessos:processos.length,
    andamento:processos.filter(p=>p.status==="andamento").length,
    julgado:processos.filter(p=>p.status==="julgado").length,
    finalizado:processos.filter(p=>p.status==="finalizado").length,
    suspenso:processos.filter(p=>p.status==="suspenso").length,
    peticoes:peticoes.length,
    arquivos:arquivos.length,
  });
});

app.get("/api/advocacia/processos", auth(), (req,res)=>{
  const {status,search}=req.query;
  let list=advItems("processo");
  if(status&&status!=="todos") list=list.filter(p=>p.status===status);
  if(search){const q=search.toLowerCase();list=list.filter(p=>[p.numero,p.cliente,p.parteContraria,p.area,p.classe,p.responsavel].some(v=>String(v||"").toLowerCase().includes(q)));}
  res.json(list.map(advSafe));
});
app.post("/api/advocacia/processos", auth(), (req,res)=>{
  const p=db.advocacia.insert({categoria:"processo",status:"andamento",...req.body});
  res.json({ok:true,processo:advSafe(p)});
});
app.put("/api/advocacia/processos/:id", auth(), (req,res)=>{
  const p=db.advocacia.update(req.params.id,{...req.body,categoria:"processo"});
  if(!p) return res.status(404).json({error:"Processo nao encontrado"});
  res.json({ok:true,processo:advSafe(p)});
});
app.delete("/api/advocacia/processos/:id", auth(), (req,res)=>{ db.advocacia.delete(req.params.id); res.json({ok:true}); });

app.get("/api/advocacia/peticoes", auth(), (_,res)=>res.json(advItems("peticao").map(advSafe)));
app.post("/api/advocacia/peticoes", auth(), (req,res)=>{
  const p=db.advocacia.insert({categoria:"peticao",status:"rascunho",...req.body});
  res.json({ok:true,peticao:advSafe(p)});
});
app.put("/api/advocacia/peticoes/:id", auth(), (req,res)=>{
  const p=db.advocacia.update(req.params.id,{...req.body,categoria:"peticao"});
  if(!p) return res.status(404).json({error:"Peticao nao encontrada"});
  res.json({ok:true,peticao:advSafe(p)});
});
app.delete("/api/advocacia/peticoes/:id", auth(), (req,res)=>{ db.advocacia.delete(req.params.id); res.json({ok:true}); });

app.get("/api/advocacia/arquivos", auth(), (_,res)=>res.json(advItems("arquivo").map(advSafe)));
app.post("/api/advocacia/upload", auth(), upload.single("file"), (req,res)=>{
  if(!req.file) return res.status(400).json({error:"Arquivo nao enviado"});
  try {
    const ext=path.extname(req.file.originalname||"").toLowerCase();
    const isPlanilha=[".xlsx",".xls",".csv"].includes(ext);
    let linhas=0,headers=[],preview=[];
    if(isPlanilha){
      const wb=XLSX.readFile(req.file.path);
      const ws=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(ws,{defval:""});
      linhas=rows.length; headers=rows.length?Object.keys(rows[0]):[]; preview=rows.slice(0,10);
    }
    const arq=db.advocacia.insert({
      categoria:"arquivo",
      nome:req.file.originalname,
      tipo:isPlanilha?"planilha":ext===".pdf"?"pdf":"documento",
      mime:req.file.mimetype,
      caminho:req.file.path,
      tamanho:req.file.size,
      processoId:req.body.processoId||"",
      linhas,headers,preview,
      enviadoPor:req.user.id,
    });
    res.json({ok:true,arquivo:advSafe(arq)});
  } catch(e) {
    res.status(500).json({error:e.message});
  }
});

app.get("/api/advocacia/export", auth(), (_,res)=>{
  const processos=advItems("processo").map(p=>({
    Numero:p.numero,Cliente:p.cliente,"Parte contraria":p.parteContraria,Area:p.area,Classe:p.classe,
    Tribunal:p.tribunal,Comarca:p.comarca,Vara:p.vara,Fase:p.fase,Status:p.status,
    "Valor causa":p.valorCausa,Prazo:p.prazo,Responsavel:p.responsavel,"Proxima acao":p.proximaAcao,
  }));
  const peticoes=advItems("peticao").map(p=>({Titulo:p.titulo,Cliente:p.cliente,"Parte contraria":p.parteContraria,Modelo:p.modelo,Status:p.status,Processo:p.processoId}));
  const arquivos=advItems("arquivo").map(a=>({Nome:a.nome,Tipo:a.tipo,Linhas:a.linhas,Tamanho:a.tamanho,Processo:a.processoId,Data:a.createdAt}));
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(processos),"Processos");
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(peticoes),"Peticoes");
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(arquivos),"Arquivos");
  const buf=XLSX.write(wb,{type:"buffer",bookType:"xlsx"});
  res.setHeader("Content-Disposition",`attachment; filename="advocacia_${Date.now()}.xlsx"`);
  res.setHeader("Content-Type","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.send(buf);
});

// SETTINGS
app.get("/api/settings", auth(), (_,res)=>{ const s={...db.settings.findOne({key:"empresa"})||{}}; if(s.anthropicKey) s.anthropicKey="***"; if(s.openaiKey) s.openaiKey="***"; res.json(s); });
app.put("/api/settings", auth(["super_admin","admin"]), (req,res)=>{ const cur=db.settings.findOne({key:"empresa"}); const upd={...req.body}; if(upd.anthropicKey==="***") delete upd.anthropicKey; if(upd.openaiKey==="***") delete upd.openaiKey; if(cur) db.settings.update(cur.id,upd); else db.settings.insert({key:"empresa",...upd}); res.json({ok:true}); });

// SMTP CONFIG
app.get("/api/smtp-config", auth(), (req,res)=>{
  const cfg=db.settings.findOne({key:"smtp"})||{};
  const {senha, ...safe} = cfg;
  safe.senhaSet = !!senha;
  res.json(safe);
});
app.put("/api/smtp-config", auth(["super_admin","admin"]), (req,res)=>{
  const cur=db.settings.findOne({key:"smtp"});
  const upd={...req.body};
  if (upd.senha === "" || upd.senha === undefined) delete upd.senha;
  delete upd.senhaSet;
  if(cur) db.settings.update(cur.id,{...upd,key:"smtp"});
  else db.settings.insert({key:"smtp",...upd});
  res.json({ok:true});
});
app.post("/api/smtp-test", auth(["super_admin","admin"]), async(req,res)=>{
  try {
    const cfg=req.body;
    const transporter=nodemailer.createTransport({host:cfg.host,port:parseInt(cfg.port)||587,secure:!!cfg.secure,auth:{user:cfg.usuario,pass:cfg.senha}});
    await transporter.verify();
    res.json({ok:true,mensagem:"Conexão SMTP bem-sucedida!"});
  } catch(e){
    res.status(400).json({error:"Falha na conexão SMTP: "+e.message});
  }
});

// NOTIFICATIONS
app.get("/api/notificacoes",          auth(), (req,res)=>res.json(db.notificacoes.find({userId:req.user.id}).slice(0,20)));
app.delete("/api/notificacoes",       auth(), (req,res)=>{ db.notificacoes.deleteMany({userId:req.user.id}); res.json({ok:true}); });

// RELATORIO
app.get("/api/relatorio/dados", auth(), (req,res)=>{ const {mes:m,ano:a}=req.query; const m_=m?+m:mesN(),a_=a?+a:anoN(); const stats=getStats(); const cfg=db.settings.findOne({key:"empresa"})||{}; const transMes=db.transacoes.all.filter(t=>{const d=new Date(t.data);return d.getMonth()+1===m_&&d.getFullYear()===a_;}); res.json({empresa:cfg,periodo:{mes:m_,ano:a_},stats,clientes:db.clientes.all.map(c=>({...c,_situacao:calcSit(c),_diasAtraso:diasAtraso(c.dataVencimento)})),transacoes:transMes,inadimplentes:stats.listAtrasados}); });

// PLANILHAS
app.post("/api/upload/planilha", auth(), upload.single("file"), (req,res)=>{ if(!req.file) return res.status(400).json({error:"Arquivo não enviado"}); try { const wb=XLSX.readFile(req.file.path);const ws=wb.Sheets[wb.SheetNames[0]];const rows=XLSX.utils.sheet_to_json(ws,{defval:""});const headers=rows.length>0?Object.keys(rows[0]):[];const p=db.planilhas.insert({nome:req.file.originalname,linhas:rows.length,headers,dados:rows.slice(0,500),dataUpload:new Date().toISOString()});fs.unlinkSync(req.file.path);res.json({ok:true,planilhaId:p.id,linhas:rows.length,headers,preview:rows.slice(0,5)}); } catch(e){ try{fs.unlinkSync(req.file.path);}catch(_){} res.status(500).json({error:e.message}); } });
app.get("/api/planilhas", auth(), (_,res)=>res.json(db.planilhas.all.map(p=>({id:p.id,nome:p.nome,linhas:p.linhas,dataUpload:p.dataUpload}))));

// ── ESTOQUE ──────────────────────────────────────────────────────────────────
app.get("/api/estoque", auth(), (req,res)=>{
  const {search,categoria}=req.query;
  let list=db.produtos.all;
  if(search){const q=search.toLowerCase();list=list.filter(p=>p.nome.toLowerCase().includes(q)||p.codigo.toLowerCase().includes(q));}
  if(categoria&&categoria!=="todas") list=list.filter(p=>p.categoria===categoria);
  res.json(list);
});
app.post("/api/estoque", auth(), (req,res)=>{const p=db.produtos.insert(req.body);res.json({ok:true,produto:p});});
app.put("/api/estoque/:id", auth(), (req,res)=>{const p=db.produtos.update(req.params.id,req.body);res.json({ok:true,produto:p});});
app.delete("/api/estoque/:id", auth(), (req,res)=>{db.produtos.delete(req.params.id);res.json({ok:true});});
app.get("/api/estoque/categorias", auth(), (_,res)=>{const cats=[...new Set(db.produtos.all.map(p=>p.categoria).filter(Boolean))];res.json(cats);});
app.get("/api/estoque/baixo", auth(), (_,res)=>res.json(db.produtos.all.filter(p=>p.quantidade<=5)));

// ── RH ────────────────────────────────────────────────────────────────────────
app.get("/api/rh", auth(), (req,res)=>{
  const {search}=req.query;
  let list=db.rh.all;
  if(search){const q=search.toLowerCase();list=list.filter(f=>f.nome.toLowerCase().includes(q)||f.departamento.toLowerCase().includes(q));}
  res.json(list);
});
app.post("/api/rh", auth(), (req,res)=>{const f=db.rh.insert(req.body);res.json({ok:true,funcionario:f});});
app.put("/api/rh/:id", auth(), (req,res)=>{const f=db.rh.update(req.params.id,req.body);res.json({ok:true,funcionario:f});});
app.delete("/api/rh/:id", auth(), (req,res)=>{db.rh.delete(req.params.id);res.json({ok:true});});
app.get("/api/rh/departamentos", auth(), (_,res)=>{const deps=[...new Set(db.rh.all.map(f=>f.departamento).filter(Boolean))];res.json(deps);});
app.get("/api/rh/folha", auth(), (_,res)=>{const total=db.rh.all.reduce((s,f)=>s+(f.salario||0),0);res.json({total,funcionarios:db.rh.count(),media:db.rh.count()?Math.round(total/db.rh.count()):0});});

// ── EMAIL ─────────────────────────────────────────────────────────────────────
app.get("/api/emails", auth(), (req,res)=>{
  const {pasta="inbox",search}=req.query;
  let list=db.emails.all.filter(e=>e.pasta===pasta).sort((a,b)=>new Date(b.data)-new Date(a.data));
  if(search){const q=search.toLowerCase();list=list.filter(e=>e.assunto.toLowerCase().includes(q)||e.de.includes(q)||e.para.includes(q));}
  res.json(list);
});
app.post("/api/emails", auth(), async(req,res)=>{
  const email=db.emails.insert({...req.body,data:new Date().toISOString(),lido:false});
  // Tenta enviar via SMTP real
  try {
    const smtp=db.settings.findOne({key:"smtp"});
    if(smtp&&smtp.host&&smtp.usuario&&smtp.senha&&smtp.senha!=="***"){
      const transporter=nodemailer.createTransport({host:smtp.host,port:parseInt(smtp.port)||587,secure:!!smtp.secure,auth:{user:smtp.usuario,pass:smtp.senha}});
      await transporter.sendMail({from:smtp.remetente||smtp.usuario,to:req.body.para,subject:req.body.assunto,text:req.body.corpo||""});
      console.log("[EMAIL] Enviado via SMTP para",req.body.para);
    }
  } catch(e){ console.error("[EMAIL] Falha ao enviar via SMTP:",e.message); }
  res.json({ok:true,email});
});
app.put("/api/emails/:id", auth(), (req,res)=>{const e=db.emails.update(req.params.id,req.body);res.json({ok:true,email:e});});
app.delete("/api/emails/:id", auth(), (req,res)=>{db.emails.delete(req.params.id);res.json({ok:true});});
app.get("/api/emails/nao-lidos", auth(), (_,res)=>res.json({total:db.emails.find({lido:false}).length}));

// EMAIL SUBSCRIBERS (newsletter/cadastro para recebimento)
app.get("/api/email-subscribers", auth(), (req,res)=>{
  const {search}=req.query;
  let list=db.email_subscribers.all.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  if(search){const q=search.toLowerCase();list=list.filter(s=>s.email.toLowerCase().includes(q)||(s.nome||"").toLowerCase().includes(q));}
  res.json(list);
});
app.post("/api/email-subscribers", (req,res)=>{
  const {email,nome}=req.body;
  if(!email) return res.status(400).json({error:"E-mail obrigatório"});
  if(db.email_subscribers.findOne({email})) return res.status(400).json({error:"E-mail já cadastrado"});
  const s=db.email_subscribers.insert({email,nome:nome||"",ativo:true,dataCadastro:new Date().toISOString(),origem:req.body.origem||"sistema"});
  res.json({ok:true,subscriber:s});
});
app.put("/api/email-subscribers/:id", auth(), (req,res)=>{const s=db.email_subscribers.update(req.params.id,req.body);res.json({ok:true,subscriber:s});});
app.delete("/api/email-subscribers/:id", auth(), (req,res)=>{db.email_subscribers.delete(req.params.id);res.json({ok:true});});
app.get("/api/email-subscribers/count", auth(), (_,res)=>res.json({total:db.email_subscribers.count(),ativos:db.email_subscribers.find({ativo:true}).length}));

// ── CONTABILIDADE ─────────────────────────────────────────────────────────────
app.get("/api/contabilidade", auth(), (req,res)=>{
  const {tipo,categoria,search}=req.query;
  let list=db.contabilidade.all.sort((a,b)=>new Date(b.data)-new Date(a.data));
  if(tipo&&tipo!=="todos") list=list.filter(c=>c.tipo===tipo);
  if(categoria&&categoria!=="todas") list=list.filter(c=>c.categoria===categoria);
  if(search){const q=search.toLowerCase();list=list.filter(c=>c.descricao.toLowerCase().includes(q));}
  res.json(list);
});
app.post("/api/contabilidade", auth(), (req,res)=>{const c=db.contabilidade.insert(req.body);res.json({ok:true,conta:c});});
app.put("/api/contabilidade/:id", auth(), (req,res)=>{const c=db.contabilidade.update(req.params.id,req.body);res.json({ok:true,conta:c});});
app.delete("/api/contabilidade/:id", auth(), (req,res)=>{db.contabilidade.delete(req.params.id);res.json({ok:true});});
app.get("/api/contabilidade/resumo", auth(), (_,res)=>{
  const receitas=db.contabilidade.find({tipo:"receita"}).reduce((s,c)=>s+c.valor,0);
  const despesas=db.contabilidade.find({tipo:"despesa"}).reduce((s,c)=>s+c.valor,0);
  res.json({receitas,despesas,saldo:receitas-despesas,total:db.contabilidade.count()});
});
app.get("/api/contabilidade/categorias", auth(), (_,res)=>{const cats=[...new Set(db.contabilidade.all.map(c=>c.categoria).filter(Boolean))];res.json(cats);});

// ── PORTAL DO CLIENTE ─────────────────────────────────────────────────────────
const portalAuth = (req, res, next) => {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return res.status(401).json({ error: "Não autenticado" });
  try {
    const p = jwt.verify(h.slice(7), JWT_SECRET);
    if (p.type !== "portal") return res.status(401).json({ error: "Token inválido" });
    const c = db.clientes.findById(p.id);
    if (!c || !c.portalAtivo) return res.status(401).json({ error: "Acesso desativado" });
    req.cliente = c;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
};

app.post("/api/portal/login", async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ error: "Email e senha obrigatórios" });
  const c = db.clientes.findOne({ email });
  if (!c || !c.portalAtivo || !c.portalSenha) return res.status(401).json({ error: "Credenciais inválidas" });
  if (!(await bcrypt.compare(senha, c.portalSenha))) return res.status(401).json({ error: "Credenciais inválidas" });
  const token = jwt.sign({ id: c.id, type: "portal" }, JWT_SECRET, { expiresIn: "7d" });
  const { portalSenha: _, ...safe } = c;
  res.json({ ok: true, token, cliente: safe });
});

app.get("/api/portal/me", portalAuth, (req, res) => {
  const c = req.cliente;
  const hoje = new Date();
  const m = hoje.getMonth() + 1, a = hoje.getFullYear();
  const pagoEsteMes = c.pagamentos?.some(p => p.mes === m && p.ano === a && p.pago);
  const totalPago = (c.pagamentos || []).filter(p => p.pago).reduce((s, p) => s + (p.valor || c.valor || 0), 0);
  res.json({
    ...c,
    _situacao: calcSit(c),
    _diasAtraso: diasAtraso(c.dataVencimento),
    pagoEsteMes: !!pagoEsteMes,
    totalPago,
    mesesPagos: (c.pagamentos || []).filter(p => p.pago).length,
  });
});

app.get("/api/portal/extrato", portalAuth, (req, res) => {
  const c = req.cliente;
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const historico = Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1;
    const p = (c.pagamentos || []).find(x => x.mes === mes && x.ano === ano);
    return {
      mes: ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][mes],
      mesNum: mes,
      ano,
      pago: p?.pago || false,
      valor: p?.valor || c.valor || 0,
      dataPagamento: p?.dataPagamento || null,
    };
  });
  res.json({ cliente: c.nome, plano: c.plano, valor: c.valor, historico });
});

app.get("/api/portal/transacoes", portalAuth, (req, res) => {
  const c = req.cliente;
  const trans = db.transacoes.find({ clienteId: c.id }).slice(0, 20);
  res.json(trans);
});

// ── MERCADO PAGO ───────────────────────────────────────────────────────────────
const { MercadoPagoConfig, Payment, Preference } = require("mercadopago");
const MP_ACCESS_TOKEN = process.env.MERCADO_PAGO_ACCESS_TOKEN;
const MP_PUBLIC_KEY   = process.env.MERCADO_PAGO_PUBLIC_KEY;
const mpClient = MP_ACCESS_TOKEN && !MP_ACCESS_TOKEN.startsWith("TEST-000")
  ? new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN })
  : null;

function mpPagar(cliente, valor, descricao, paymentMethod = "pix") {
  if (!mpClient) throw new Error("Mercado Pago não configurado");
  const payment = new Payment(mpClient);
  return payment.create({
    body: {
      transaction_amount: valor,
      description: descricao,
      payment_method_id: paymentMethod,
      payer: {
        email: cliente.email || "cliente@email.com",
        first_name: cliente.nome?.split(" ")[0] || "Cliente",
        last_name: cliente.nome?.split(" ").slice(1).join(" ") || "",
        identification: cliente.cpfCnpj ? { type: cliente.cpfCnpj.length > 11 ? "CNPJ" : "CPF", number: cliente.cpfCnpj.replace(/\D/g, "") } : undefined,
      },
      notification_url: `${process.env.BASE_URL || `http://localhost:${PORT}`}/api/mercado-pago/webhook`,
    },
  });
}

app.post("/api/mercado-pago/gerar-pagamento", portalAuth, async (req, res) => {
  try {
    if (!mpClient) return res.status(400).json({ error: "Mercado Pago não configurado. Defina MERCADO_PAGO_ACCESS_TOKEN no .env" });
    const { mes, ano, valor } = req.body;
    const c = req.cliente;
    const m = mes || new Date().getMonth() + 1;
    const a = ano || new Date().getFullYear();
    const v = valor || c.valor || 0;
    if (!v) return res.status(400).json({ error: "Valor inválido" });
    if (c.pagamentos?.some(p => p.mes === m && p.ano === a && p.pago))
      return res.status(400).json({ error: "Este mês já está pago" });

    const result = await mpPagar(c, v, `Mensalidade ${c.nome} - ${m}/${a}`, req.body.metodo || "pix");

    // Salva referência do pagamento pendente
    const cobranca = {
      id: result.id,
      mes: m,
      ano: a,
      valor: v,
      status: result.status,
      metodo: req.body.metodo || "pix",
      qrCode: result.point_of_interaction?.transaction_data?.qr_code || null,
      qrCodeBase64: result.point_of_interaction?.transaction_data?.qr_code_base64 || null,
      linkPagamento: result.point_of_interaction?.transaction_data?.ticket_url || null,
      criadoEm: new Date().toISOString(),
    };
    if (!c.cobrancas) c.cobrancas = [];
    c.cobrancas.push(cobranca);
    db.clientes.update(c.id, { cobrancas: c.cobrancas });

    res.json({
      ok: true,
      pagamento: cobranca,
      publicKey: MP_PUBLIC_KEY,
    });
  } catch (e) {
    console.error("MP error:", e);
    res.status(500).json({ error: e.message || "Erro ao gerar pagamento" });
  }
});

app.post("/api/mercado-pago/admin-gerar-cobranca", auth(), async (req, res) => {
  try {
    if (!mpClient) return res.status(400).json({ error: "Mercado Pago não configurado" });
    const { clienteId, mes, ano, valor, metodo } = req.body;
    const c = db.clientes.findById(clienteId);
    if (!c) return res.status(404).json({ error: "Cliente não encontrado" });
    const m = mes || new Date().getMonth() + 1;
    const a = ano || new Date().getFullYear();
    const v = valor || c.valor || 0;
    const result = await mpPagar(c, v, `Mensalidade ${c.nome} - ${m}/${a}`, metodo || "pix");
    const cobranca = {
      id: result.id,
      mes: m, ano: a, valor: v,
      status: result.status,
      metodo: metodo || "pix",
      qrCode: result.point_of_interaction?.transaction_data?.qr_code || null,
      qrCodeBase64: result.point_of_interaction?.transaction_data?.qr_code_base64 || null,
      linkPagamento: result.point_of_interaction?.transaction_data?.ticket_url || null,
      criadoEm: new Date().toISOString(),
    };
    if (!c.cobrancas) c.cobrancas = [];
    c.cobrancas.push(cobranca);
    db.clientes.update(c.id, { cobrancas: c.cobrancas });
    res.json({ ok: true, pagamento: cobranca });
  } catch (e) {
    res.status(500).json({ error: e.message || "Erro ao gerar cobrança" });
  }
});

app.post("/api/mercado-pago/webhook", async (req, res) => {
  try {
    const event = req.body;
    if (!event || !event.data?.id) return res.sendStatus(200);

    const payment = new Payment(mpClient);
    const mpResult = await payment.get({ id: event.data.id });

    if (mpResult.status === "approved") {
      const desc = mpResult.description || "";
      const mesMatch = desc.match(/(\d{1,2})\/(\d{4})/);
      const clienteMatch = desc.match(/Mensalidade (.+?) -/);
      if (clienteMatch && mesMatch) {
        const nome = clienteMatch[1].trim();
        const m = parseInt(mesMatch[1]), a = parseInt(mesMatch[2]);
        const cliente = db.clientes.findOne({ nome });
        if (cliente) {
          if (!cliente.pagamentos) cliente.pagamentos = [];
          const idx = cliente.pagamentos.findIndex(p => p.mes === m && p.ano === a);
          const pag = { mes: m, ano: a, pago: true, dataPagamento: hoje(), valor: mpResult.transaction_amount, formaPagamento: "mercado_pago", transactionId: String(mpResult.id), statusPix: "approved" };
          if (idx >= 0) cliente.pagamentos[idx] = pag;
          else cliente.pagamentos.push(pag);
          db.clientes.update(cliente.id, { pagamentos: cliente.pagamentos });
          db.transacoes.insert({ tipo: "entrada", categoria: "Mensalidade", descricao: `Mensalidade ${nome} (MP)`, valor: mpResult.transaction_amount, data: hoje(), status: "pago", clienteId: cliente.id });
          // Atualiza cobranca pendente
          const cobrancas = (cliente.cobrancas || []).map(cb => cb.id === mpResult.id ? { ...cb, status: "approved" } : cb);
          db.clientes.update(cliente.id, { cobrancas });
          io.emit("data_update", { type: "pagamento" });
          io.emit("pagamento_aprovado", { clienteId: cliente.id, mes: m, ano: a });
        }
      }
    }
    res.sendStatus(200);
  } catch (e) {
    console.error("MP webhook error:", e);
    res.sendStatus(200);
  }
});

app.get("/api/mercado-pago/status/:paymentId", portalAuth, async (req, res) => {
  try {
    if (!mpClient) return res.status(400).json({ error: "MP não configurado" });
    const payment = new Payment(mpClient);
    const result = await payment.get({ id: req.params.paymentId });
    res.json({ status: result.status, detail: result.status_detail });
  } catch {
    const cobranca = req.cliente?.cobrancas?.find(c => c.id === req.params.paymentId);
    res.json({ status: cobranca?.status || "unknown" });
  }
});

app.get("/api/mercado-pago/config", (_, res) => {
  res.json({
    configured: !!mpClient,
    publicKey: MP_PUBLIC_KEY || null,
  });
});

// ── NOTAS FISCAIS ──────────────────────────────────────────────────────────────
function gerarChaveAcesso() {
  const now=new Date();
  const cfg=db.settings.findOne({key:"empresa"})||{};
  const uf="35"; const ano=String(now.getFullYear()).slice(-2); const mes=String(now.getMonth()+1).padStart(2,"0");
  const cnpj=String(cfg.cnpj||"00000000000000").replace(/\D/g,"").padStart(14,"0").slice(0,14);
  const modelo="55"; const serie="001"; const nNF=String(Math.floor(Math.random()*999999999)).padStart(9,"0");
  const tpEmis="1"; const cNF=String(Math.floor(Math.random()*99999999)).padStart(8,"0");
  const base=`${uf}${ano}${mes}${cnpj}${modelo}${serie}${nNF}${tpEmis}${cNF}`;
  const pesos=[2,3,4,5,6,7,8,9];
  let soma=0;
  base.split("").reverse().forEach((n,i)=>{ soma+=Number(n)*pesos[i%pesos.length]; });
  const resto=soma%11;
  const dv=resto<2?0:11-resto;
  return `${base}${dv}`;
}
async function gerarQRCode(chave) {
  const url=`https://www.sefaz.${chave.substring(0,2)}.gov.br/NFCE/consulta?p=${chave}`;
  return qrcode.toDataURL(url,{width:220,margin:1,errorCorrectionLevel:"M"});
}
app.get("/api/notas-fiscais", auth(), (_,res)=>{res.json(db.notas_fiscais.all.sort((a,b)=>new Date(b.dataEmissao)-new Date(a.dataEmissao)));});
app.post("/api/notas-fiscais", auth(), async(req,res)=>{
  const chave=gerarChaveAcesso();
  const cfg=db.settings.findOne({key:"empresa"})||{};
  const nf={
    ...req.body,
    emitente:cfg.nomeEmpresa||"ACIAPA Gestao",
    emitenteCnpj:cfg.cnpj||"00.000.000/0001-00",
    emitenteEndereco:cfg.endereco||"",
    emitenteTelefone:cfg.telefone||"",
    chaveAcesso:chave,
    qrCode:await gerarQRCode(chave),
    dataEmissao:new Date().toISOString(),
    status:"autorizada",
    ambiente:"Homologacao",
    modelo:"55",
    serie:"001",
    numero:Math.floor(Math.random()*999999)
  };
  const r=db.notas_fiscais.insert(nf);
  db.transacoes.insert({tipo:"entrada",categoria:"Nota Fiscal",descricao:`NF ${r.numero} - ${r.cliente||""}`,valor:r.valorTotal||0,data:hoje(),status:"pago"});
  res.json({ok:true,nota:r});
});
app.get("/api/notas-fiscais/:id", auth(), (req,res)=>{const nf=db.notas_fiscais.findById(req.params.id);if(!nf)return res.status(404).json({error:"NF não encontrada"});res.json(nf);});
app.delete("/api/notas-fiscais/:id", auth(), (req,res)=>{db.notas_fiscais.delete(req.params.id);res.json({ok:true});});

// ── IA OLLAMA ─────────────────────────────────────────────────────────────────
async function queryIAOllama(pergunta, contexto) {
  try {
    const r=await fetch("http://localhost:11434/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
      model:"llama3.2:3b",prompt:`Você é assistente IA do ACIAPA. Responda em português.
Voce pode tratar qualquer assunto perguntado pelo usuario. Use o contexto da empresa apenas quando a pergunta envolver dados internos.
Contexto da empresa: ${JSON.stringify(contexto)}

Pergunta: ${pergunta}

Responda de forma natural, util e direta. Se for numerico, mostre valores. Se for juridico, escreva com linguagem humana, profissional e revisavel por advogado habilitado. Nao invente fatos, artigos, jurisprudencia, datas ou provas; quando faltar informacao, use campos entre colchetes.`,stream:false
    })});
    const d=await r.json();
    return {resposta:d.response||"Sem resposta",tabela:null,grafico:null,resumo:null,alertas:null,acoes:null};
  } catch(e) {
    return null;
  }
}

function respostaGeral(pergunta,stats) {
  const tema=pergunta.trim();
  const juridico=/peti|contrato|processo|advoc|jurid|direito|recurso|contest|inicial|audiencia/i.test(tema);
  if (juridico) {
    return {
      resposta:[
        `Minuta juridica para revisao: "${tema}".`,
        "",
        "AO JUIZO/DESTINATARIO COMPETENTE",
        "",
        "[Nome da parte], por seu advogado, vem apresentar a presente manifestacao, carta ou peca cabivel, com base nos fatos e documentos informados.",
        "",
        "1. DOS FATOS",
        "Descrever, em ordem logica e humana, o que ocorreu, quem participou, quais documentos comprovam cada ponto e por que a providencia e necessaria.",
        "",
        "2. DOS FUNDAMENTOS",
        "Relacionar os fundamentos juridicos aplicaveis sem inventar artigos, precedentes ou provas nao informadas. Quando houver duvida, marcar [fundamento a confirmar].",
        "",
        "3. DOS PEDIDOS OU PROVIDENCIAS",
        "Requerer as medidas adequadas ao caso, incluindo notificacao, cumprimento de obrigacao, producao de provas, condenacao, acordo ou outra providencia cabivel.",
        "",
        "Termos em que, pede deferimento.",
        "",
        "[Local], [data].",
        "[Advogado responsavel]",
        "",
        "Minuta sujeita a revisao tecnica do advogado responsavel.",
      ].join("\n"),
      tabela:[
        {Etapa:"Fatos",Descricao:"Linha do tempo, partes, valores e eventos"},
        {Etapa:"Provas",Descricao:"Contratos, mensagens, PDFs, planilhas e testemunhas"},
        {Etapa:"Fundamentos",Descricao:"Lei, jurisprudencia e tese principal"},
        {Etapa:"Pedidos",Descricao:"Tutela, condenacao, obrigacao, provas e custas"},
      ],
      acoes:["Abrir aba Advocacia","Criar processo","Gerar minuta com IA Juridica"],
    };
  }
  return {
    resposta:`Posso tratar qualquer assunto. Sobre "${tema}", organize a resposta por objetivo, contexto, pontos principais, riscos e proximos passos. Para respostas mais profundas e criativas, mantenha Ollama ligado ou configure uma chave de IA nas configuracoes; sem provedor externo eu uso respostas locais e dados do ACIAPA.`,
    tabela:[
      {Bloco:"Objetivo",Uso:"O que voce quer decidir, criar ou entender"},
      {Bloco:"Contexto",Uso:"Dados, restricoes, publico e prazo"},
      {Bloco:"Resposta",Uso:"Explicacao direta com passos praticos"},
      {Bloco:"Proximos passos",Uso:"Acoes recomendadas"},
    ],
    resumo:`ACIAPA: ${stats.ativos||0} clientes ativos, ${fmt(stats.receitaMes||0)} de receita no mes e ${stats.atrasados||0} inadimplentes.`,
  };
}

function queryIACompleta(pergunta,stats) {
  const q=pergunta.toLowerCase();
  if (q.includes("inadimpl")||q.includes("atras")) {
    const l=db.clientes.find({status:"ativo"}).filter(c=>calcSit(c)==="atrasado").map(c=>({Nome:c.nome,Valor:fmt(c.valor),"Dias":diasAtraso(c.dataVencimento)}));
    return {resposta:`${l.length} clientes inadimplentes. Total: ${fmt(stats.inadimplencia)}`,tabela:l,grafico:null,resumo:`${l.length} inadimplentes = ${fmt(stats.inadimplencia)}`,alertas:[`Cobrar ${l.length} clientes`],acoes:["Enviar WhatsApp","Exportar"]};
  }
  if (q.includes("receita")||q.includes("faturamento")) {
    const pm={}; db.transacoes.find({tipo:"entrada"}).forEach(t=>{const d=new Date(t.data);const k=`${d.getMonth()+1}/${d.getFullYear()}`;pm[k]=(pm[k]||0)+t.valor;});
    return {resposta:`Receita total: ${fmt(stats.receitaTotal)}. Mês: ${fmt(stats.receitaMes)}`,grafico:{tipo:"bar",titulo:"Receita",dados:Object.entries(pm).slice(-6).map(([n,v])=>({nome:n,valor:v}))},acoes:["Ver financeiro"]};
  }
  if (q.includes("estoque")||q.includes("produto")) {
    const baixo=db.produtos.all.filter(p=>p.quantidade<=5);
    return {resposta:`${db.produtos.count()} produtos em estoque. ${baixo.length} com estoque baixo.`,tabela:baixo.map(p=>({Produto:p.nome,Qtd:p.quantidade,Preco:fmt(p.preco)})),alertas:baixo.length?[`Repor ${baixo.length} produtos`]:null};
  }
  if (q.includes("funcionario")||q.includes("colaborador")||q.includes("rh")) {
    return {resposta:`${db.rh.count()} funcionários. Folha total: ${fmt(db.rh.all.reduce((s,f)=>s+(f.salario||0),0))}`};
  }
  if (q.includes("cliente")) {
    return {resposta:`${stats.ativos} clientes ativos de ${stats.totalClientes}`,tabela:db.clientes.all.slice(0,5).map(c=>({Nome:c.nome,Plano:c.plano,Valor:fmt(c.valor)})),grafico:{tipo:"pie",titulo:"Status",dados:[{nome:"Em Dia",valor:stats.emDia},{nome:"Atrasados",valor:stats.atrasados},{nome:"Inativos",valor:stats.inativos}]}};
  }
  const baixoEstoque=db.produtos.all.filter(p=>p.quantidade<=5);
  const alertas=[];
  if(stats.atrasados>0) alertas.push(`${stats.atrasados} clientes inadimplentes`);
  if(baixoEstoque.length>0) alertas.push(`${baixoEstoque.length} produtos com estoque baixo`);
  if (q.includes("resumo")||q.includes("dashboard")||q.includes("aciapa")||q.includes("empresa")) {
    return {resposta:`Resumo ACIAPA: ${stats.ativos} clientes ativos, ${fmt(stats.receitaMes)} receita no mes, ${stats.atrasados} inadimplentes, ${db.rh.count()} funcionarios, ${db.produtos.count()} produtos.`,alertas:alertas.length?alertas:null,acoes:["Ver dashboard","Ver clientes","Ver estoque"]};
  }
  return respostaGeral(pergunta,stats);
}

async function queryIA(pergunta) {
  const cfg=db.settings.findOne({key:"empresa"})||{};
  const stats=getStats();
  const ctxIA={...stats,empresa:cfg.nomeEmpresa||"ACIAPA",produtos:db.produtos.count(),funcionarios:db.rh.count()};
  const ollamaResp = await queryIAOllama(pergunta, ctxIA);
  if (ollamaResp) return ollamaResp;
  const sys="Você é assistente IA do ACIAPA. Responda em português e trate qualquer assunto perguntado, sem restringir ao contexto interno. Use os dados da empresa quando forem relevantes. Em documentos juridicos, escreva com linguagem humana, natural, profissional e revisavel, evitando tom artificial; nao invente fatos, jurisprudencia, artigos, datas ou provas, e use campos entre colchetes quando faltar informacao. Retorne APENAS JSON: {\"resposta\":\"texto\",\"tabela\":[...]|null,\"grafico\":{...}|null,\"resumo\":\"texto\"|null,\"alertas\":[...]|null,\"acoes\":[...]|null}";
  if (cfg.anthropicKey&&cfg.anthropicKey!=="***") { try { const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":cfg.anthropicKey,"anthropic-version":"2023-06-01"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:2000,system:sys,messages:[{role:"user",content:`Dados: ${JSON.stringify(ctxIA)}\n\nPergunta: ${pergunta}`}]})});const d=await r.json();return JSON.parse(d.content?.[0]?.text||"{}");}catch(e){}}
  if (cfg.openaiKey&&cfg.openaiKey!=="***") { try { const r=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${cfg.openaiKey}`},body:JSON.stringify({model:"gpt-4o-mini",max_tokens:2000,messages:[{role:"system",content:sys},{role:"user",content:`Dados: ${JSON.stringify(ctxIA)}\n\nPergunta: ${pergunta}`}]})});const d=await r.json();return JSON.parse(d.choices?.[0]?.message?.content||"{}");}catch(e){}}
  return queryIACompleta(pergunta,stats);
}

// ── Backup ────────────────────────────────────────────────────────────────────
app.get("/api/admin/backup", auth(["super_admin"]), async (req, res) => {
  const dirs = [
    { name:"data",     path: process.env.ACIAPA_DATA_DIR || path.join(basePath, "data") },
    { name:"uploads",  path: process.env.ACIAPA_UPLOADS_DIR || path.join(basePath, "uploads") },
    { name:"auth_info",path: process.env.ACIAPA_AUTH_DIR || path.join(basePath, "auth_info") },
  ];
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="aciapa_backup_${new Date().toISOString().slice(0,10)}.zip"`);
  const archiver = require("archiver");
  const archive = archiver("zip", { zlib: { level: 6 } });
  archive.pipe(res);
  for (const d of dirs) {
    if (fs.existsSync(d.path)) archive.directory(d.path, d.name);
  }
  archive.file(path.join(__dirname, "package.json"), { name: "package.json" });
  archive.file(path.join(__dirname, "server.js"), { name: "server.js" });
  archive.finalize();
});

// Bank config
const BOLETO_CFG_PATH = path.join(basePath, "bank-config.json");
function loadBankCfg() {
  try { return JSON.parse(fs.readFileSync(BOLETO_CFG_PATH, "utf8")); } catch { return {}; }
}
function saveBankCfg(cfg) {
  fs.writeFileSync(BOLETO_CFG_PATH, JSON.stringify(cfg, null, 2));
}
app.get("/api/config/bancario", auth(), (req, res) => res.json(loadBankCfg()));
app.put("/api/config/bancario", auth(), (req, res) => {
  saveBankCfg(req.body); res.json({ ok: true });
});

// Direct bank boleto generation
app.post("/api/boleto/direto", auth(), async (req, res) => {
  try {
    const { clienteId, valor, banco, agencia, agenciaDigito, conta, contaDigito, carteira, vencimento, multa, mora } = req.body;
    if (!banco || !clienteId || !valor) return res.status(400).json({ error: "Banco, cliente e valor são obrigatórios" });

    const c = db.clientes.findById(clienteId);
    if (!c) return res.status(404).json({ error: "Cliente não encontrado" });

    const cfg = loadBankCfg();
    const bankCfg = cfg[banco] || {};
    const ag = agencia || bankCfg.agencia || "0000";
    const agD = agenciaDigito || bankCfg.agenciaDigito || "";
    const cc = conta || bankCfg.conta || "00000";
    const ccD = contaDigito || bankCfg.contaDigito || "";
    const car = carteira || bankCfg.carteira || "09";

    const { Bancos, Boletos } = require("gerar-boletos");
    const bankMap = {
      banco_do_brasil: Bancos.BancoDoBrasil,
      bradesco: Bancos.Bradesco,
      itau: Bancos.Itau,
      caixa: Bancos.Caixa,
      santander: Bancos.Santander,
    };
    const BankClass = bankMap[banco];
    if (!BankClass) return res.status(400).json({ error: `Banco "${banco}" não suportado` });

    const hojeStr = new Date().toLocaleDateString("pt-BR");
    const vencStr = vencimento ? new Date(vencimento).toLocaleDateString("pt-BR") : new Date(Date.now() + 5 * 86400000).toLocaleDateString("pt-BR");
    const nossoNum = String(Date.now()).slice(-10);

    const dadosBancarios = {
      carteira: car,
      agencia: ag,
      agenciaDigito: agD || "0",
      conta: cc,
      contaDigito: ccD || "0",
      nossoNumero: nossoNum,
      nossoNumeroDigito: "0",
    };
    if (banco === "banco_do_brasil") {
      dadosBancarios.convenio = bankCfg.convenio || "1234567";
    }

    const dados = {
      banco: new BankClass(),
      pagador: {
        nome: c.nome || "Cliente",
        registroNacional: c.cpfCnpj?.replace(/\D/g, "") || "00000000000",
        endereco: {
          logradouro: c.endereco || "Endereço não informado",
          bairro: c.bairro || "",
          cidade: c.cidade || "",
          estadoUF: c.uf || "SP",
          cep: c.cep?.replace(/\D/g, "") || "00000000",
        },
      },
      instrucoes: [`Após o vencimento, multa de ${multa||2}%`, `Mora de R$ ${(+mora||1.59).toFixed(2)} ao dia`],
      beneficiario: {
        nome: bankCfg.nome || bankCfg.razao || "Empresa",
        cnpj: bankCfg.cnpj?.replace(/\D/g, "") || "00000000000000",
        dadosBancarios,
        endereco: {
          logradouro: bankCfg.endereco || "",
          bairro: bankCfg.bairro || "",
          cidade: bankCfg.cidade || "",
          estadoUF: bankCfg.uf || "SP",
          cep: bankCfg.cep?.replace(/\D/g, "") || "00000000",
        },
      },
      boleto: {
        numeroDocumento: nossoNum,
        especieDocumento: "DM",
        valor: +valor,
        datas: { vencimento: vencStr, processamento: hojeStr, documentos: hojeStr },
      },
    };

    const novoBoleto = new Boletos(dados);
    novoBoleto.gerarBoleto();
    const tmpDir = path.join(basePath, "tmp", "boletos");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const { filePath } = await novoBoleto.pdfFile(tmpDir, banco);
    const fileName = `boleto_${banco}_${Date.now()}.pdf`;
    const publicPath = path.join(basePath, "dist", "boletos");
    if (!fs.existsSync(publicPath)) fs.mkdirSync(publicPath, { recursive: true });
    fs.copyFileSync(filePath, path.join(publicPath, fileName));

    // Register as transação
    db.transacoes.insert({
      tipo: "entrada", categoria: "Boleto", descricao: `Boleto ${c.nome} - ${banco}`,
      valor: +valor, data: hoje(), status: "pendente", clienteId: c.id,
    });

    res.json({ ok: true, boleto: { url: `/boletos/${fileName}`, banco, valor, vencimento: vencStr } });
  } catch (e) {
    console.error("Boleto error:", e);
    res.status(500).json({ error: e.message || "Erro ao gerar boleto" });
  }
});

// SPA
app.get("*", (req,res)=>{
  const fsPath = path.join(basePath,"dist","index.html");
  try {
    if (isPkg && fs.existsSync(fsPath)) return res.sendFile(fsPath);
  } catch {}
  res.sendFile(path.join(distPath,"index.html"));
});

// SOCKET
io.on("connection", socket=>{ socket.emit("stats_update",getStats()); socket.emit("wa_status",{status:waStatus}); if(waQR) socket.emit("wa_qr",waQR); });

// CRONS
cron.schedule("0 9 * * *", ()=>{ const s=getStats(); if(s.atrasados>0){ io.emit("alerta",{tipo:"inadimplencia",total:s.atrasados,valor:s.inadimplencia}); db.users.find({ativo:true}).forEach(u=>db.notificacoes.insert({userId:u.id,titulo:"Inadimplência",mensagem:`${s.atrasados} clientes em atraso — ${fmt(s.inadimplencia)}`,tipo:"alerta",lida:false})); } });

const PORT=process.env.PORT||3001;
server.listen(PORT, ()=>{
  if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR);
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);
  console.log(`\n==============================================\n  ACIAPA v2.0 -- Iniciado!\n  http://localhost:${PORT}\n  Login: admin@aciapa.com / nexus123\n==============================================\n`);
  const cfg=db.settings.findOne({key:"empresa"});
  if(cfg?.whatsappAtivo) setTimeout(initWA,3000);
});
process.on("SIGINT",()=>{ try{ bonjour?.unpublishAll(); bonjour?.destroy(); }catch(e){} process.exit(0); });
process.on("SIGTERM",()=>{ try{ bonjour?.unpublishAll(); bonjour?.destroy(); }catch(e){} process.exit(0); });
