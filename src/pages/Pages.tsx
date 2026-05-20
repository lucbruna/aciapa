// ══════════════════════════════════════════════════════════════════════════════
// KANBAN
// ══════════════════════════════════════════════════════════════════════════════
import { useState, useEffect, useRef } from "react";
import { C, fmt } from "../constants.js";
import { Plus, X, Edit, Trash2, RefreshCw, Save, DollarSign, ChevronRight, FileText, FileSpreadsheet, Upload, Printer, Check, Eye, EyeOff, Brain, Building2, Users as UsersIcon, Bell, Shield, Search, AlertTriangle, CalendarDays, Clock, MapPin, Download, RotateCw, Mail, Send, Users } from "lucide-react";

const COLUNAS = [
  {id:"prospeccao",    label:"Prospecção",      color:C.muted},
  {id:"qualificacao",  label:"Qualificação",     color:C.cyan},
  {id:"proposta",      label:"Proposta",         color:C.amber},
  {id:"negociacao",    label:"Negociação",       color:C.purple},
  {id:"fechado_ganho", label:"Ganho ✓",          color:C.green},
  {id:"fechado_perdido",label:"Perdido ✗",       color:C.red},
];

const PRIO_COLOR={alta:C.red,media:C.amber,baixa:C.muted};

function CardForm({initial,onSave,onCancel}){
  const blank={titulo:"",valor:0,coluna:"prospeccao",responsavel:"",prioridade:"media",prazo:"",descricao:"",contato:"",empresa:""};
  const [form,setForm]=useState({...blank,...initial});
  const F=(l,k,type="text",ph="")=>(
    <div><label style={{color:C.sub}} className="text-xs font-bold mb-1 block uppercase tracking-wider">{l}</label>
    <input type={type} value={form[k]||""} onChange={e=>setForm({...form,[k]:type==="number"?+e.target.value:e.target.value})} placeholder={ph}
      style={{background:C.surface,border:`1px solid ${C.border}`,color:type==="number"?C.indigo:C.text,width:"100%",borderRadius:10,padding:"8px 12px",fontSize:12,outline:"none",fontFamily:type==="number"?"monospace":"inherit",fontWeight:type==="number"?"bold":"normal"}}/></div>
  );
  return (
    <div style={{background:C.card2,border:`1px solid ${C.indigoBorder}`,borderRadius:16,padding:16}} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">{F("Título *","titulo","text","Nome do negócio")}{F("Valor (R$)","valor","number")}</div>
      <div className="grid grid-cols-2 gap-3">{F("Empresa","empresa","text","Empresa S/A")}{F("Contato","contato","text","Nome do contato")}</div>
      <div className="grid grid-cols-3 gap-3">
        <div><label style={{color:C.sub}} className="text-xs font-bold mb-1 block uppercase tracking-wider">Coluna</label>
        <select value={form.coluna} onChange={e=>setForm({...form,coluna:e.target.value})} style={{background:C.surface,border:`1px solid ${C.border}`,color:C.text,width:"100%",borderRadius:10,padding:"8px 12px",fontSize:12,outline:"none"}}>
          {COLUNAS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
        <div><label style={{color:C.sub}} className="text-xs font-bold mb-1 block uppercase tracking-wider">Prioridade</label>
        <select value={form.prioridade} onChange={e=>setForm({...form,prioridade:e.target.value})} style={{background:C.surface,border:`1px solid ${C.border}`,color:C.text,width:"100%",borderRadius:10,padding:"8px 12px",fontSize:12,outline:"none"}}>
          {["alta","media","baixa"].map(p=><option key={p}>{p}</option>)}</select></div>
        {F("Prazo","prazo","date")}
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} style={{border:`1px solid ${C.border}`,color:C.muted}} className="flex-1 py-2 rounded-xl text-xs hover:border-white/20">Cancelar</button>
        <button onClick={()=>onSave(form)} style={{background:`linear-gradient(135deg,${C.indigo},${C.purple})`,color:"white"}} className="flex-1 py-2 rounded-xl text-xs font-extrabold hover:opacity-90"><Save size={11} className="inline mr-1"/>Salvar</button>
      </div>
    </div>
  );
}

export function Kanban({ toast, api }) {
  const [cards,   setCards]  = useState<any[]>([]);
  const [newCard, setNewCard]= useState<any>(null);
  const [editCard,setEditCard]=useState<any>(null);
  const [drag,    setDrag]   = useState<any>(null);

  useEffect(()=>{ api("/api/kanban").then(r=>r.json()).then(setCards).catch(()=>{}); },[]);

  const save=async(form)=>{
    if(!form.titulo) return toast("Título obrigatório","error");
    if(editCard?.id) await api(`/api/kanban/${editCard.id}`,{method:"PUT",body:JSON.stringify(form)});
    else             await api("/api/kanban",{method:"POST",body:JSON.stringify(form)});
    toast("Salvo!","success"); setNewCard(null); setEditCard(null);
    api("/api/kanban").then(r=>r.json()).then(setCards);
  };

  const del=async id=>{ if(!confirm("Excluir?")) return; await api(`/api/kanban/${id}`,{method:"DELETE"}); setCards(c=>c.filter(x=>x.id!==id)); };

  const moveCard=async(cardId,novaColuna)=>{
    await api(`/api/kanban/${cardId}`,{method:"PUT",body:JSON.stringify({coluna:novaColuna})});
    setCards(cs=>cs.map(c=>c.id===cardId?{...c,coluna:novaColuna}:c));
  };

  const totalPipeline=cards.filter(c=>!["fechado_ganho","fechado_perdido"].includes(c.coluna)).reduce((s,c)=>s+c.valor,0);
  const totalGanho=cards.filter(c=>c.coluna==="fechado_ganho").reduce((s,c)=>s+c.valor,0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div style={{color:C.text}} className="font-bold text-lg">Pipeline de Vendas</div>
          <div style={{color:C.muted}} className="text-xs mt-0.5">Pipeline: {fmt(totalPipeline)} · Ganho: {fmt(totalGanho)}</div>
        </div>
        <button onClick={()=>setNewCard({})} style={{background:`linear-gradient(135deg,${C.indigo},${C.purple})`,color:"white",boxShadow:`0 0 20px ${C.indigo}30`}} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-extrabold hover:opacity-90"><Plus size={15}/>Novo Card</button>
      </div>
      {newCard!==null&&<CardForm initial={newCard} onSave={save} onCancel={()=>setNewCard(null)}/>}

      <div className="flex gap-3 overflow-x-auto pb-2">
        {COLUNAS.map(col=>{
          const colCards=cards.filter(c=>c.coluna===col.id);
          const colTotal=colCards.reduce((s,c)=>s+c.valor,0);
          return (
            <div key={col.id} style={{minWidth:230,flex:"0 0 230px"}}
              onDragOver={e=>{e.preventDefault();}}
              onDrop={e=>{ e.preventDefault(); if(drag) moveCard(drag,col.id); setDrag(null); }}>
              {/* Column header */}
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderTop:`3px solid ${col.color}`}} className="rounded-t-xl px-3 py-2.5 flex items-center justify-between mb-2">
                <div>
                  <div style={{color:col.color}} className="font-bold text-xs">{col.label}</div>
                  <div style={{color:C.muted}} className="text-[10px]">{colCards.length} · {fmt(colTotal)}</div>
                </div>
                <span style={{background:`${col.color}20`,color:col.color}} className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">{colCards.length}</span>
              </div>
              {/* Cards */}
              <div className="space-y-2 min-h-[100px]">
                {colCards.map(card=>(
                  <div key={card.id} draggable onDragStart={()=>setDrag(card.id)} onDragEnd={()=>setDrag(null)}
                    style={{background:C.card,border:`1px solid ${C.border}`,cursor:"grab",opacity:drag===card.id?0.5:1}} className="rounded-xl p-3 hover:border-white/15 transition-colors select-none">
                    <div className="flex items-start justify-between mb-1.5">
                      <div style={{color:C.text}} className="text-xs font-bold leading-tight flex-1">{card.titulo}</div>
                      <div className="flex gap-0.5 ml-1">
                        <button onClick={()=>setEditCard(card)} style={{color:C.muted}} className="w-5 h-5 rounded flex items-center justify-center hover:text-white"><Edit size={10}/></button>
                        <button onClick={()=>del(card.id)} style={{color:C.red}} className="w-5 h-5 rounded flex items-center justify-center hover:bg-red-500/10"><X size={10}/></button>
                      </div>
                    </div>
                    {card.empresa&&<div style={{color:C.muted}} className="text-[10px] mb-1">{card.empresa}</div>}
                    <div className="flex items-center justify-between">
                      <span style={{color:C.indigo,fontFamily:"monospace"}} className="text-xs font-extrabold">{fmt(card.valor)}</span>
                      <span style={{background:`${PRIO_COLOR[card.prioridade]}20`,color:PRIO_COLOR[card.prioridade],border:`1px solid ${PRIO_COLOR[card.prioridade]}30`}} className="text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize">{card.prioridade}</span>
                    </div>
                    {card.prazo&&<div style={{color:C.muted}} className="text-[10px] mt-1">Prazo: {card.prazo}</div>}
                    {card.responsavel&&<div style={{color:C.muted}} className="text-[10px]">{card.responsavel}</div>}
                    {/* Move arrows */}
                    <div className="flex gap-1 mt-2">
                      {COLUNAS.filter(c=>c.id!==col.id).slice(0,2).map(c=>(
                        <button key={c.id} onClick={()=>moveCard(card.id,c.id)} style={{background:`${c.color}15`,color:c.color,border:`1px solid ${c.color}25`}} className="flex-1 py-0.5 rounded text-[9px] font-bold truncate hover:opacity-80">→ {c.label.split(" ")[0]}</button>
                      ))}
                    </div>
                  </div>
                ))}
                {editCard?.coluna===col.id&&<CardForm initial={editCard} onSave={async f=>{ await save({...editCard,...f}); setEditCard(null); }} onCancel={()=>setEditCard(null)}/>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// AGENDA — TURBO
// ══════════════════════════════════════════════════════════════════════════════
export function Agenda({ toast, api }) {
  const [modo, setModo] = useState("financeira");
  const [venc, setVenc] = useState<any[]>([]);
  const [compromissos, setCompromissos] = useState<any[]>([]);
  const [novoComp, setNovoComp] = useState<any>(null);
  const [filtro, setFiltro] = useState("todos");
  const [busca, setBusca] = useState("");
  const [mes, setMes] = useState(new Date().getMonth());
  const [ano, setAno] = useState(new Date().getFullYear());

  useEffect(()=>{ api("/api/agenda/vencimentos").then(r=>r.json()).then(d=>setVenc(Array.isArray(d)?d:[])).catch(()=>setVenc([])); },[]);
  const loadCompromissos=()=>api("/api/agenda/compromissos").then(r=>r.json()).then(d=>setCompromissos(Array.isArray(d)?d:[])).catch(()=>setCompromissos([]));
  useEffect(()=>{ loadCompromissos(); },[]);

  const MESES=["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const hoje=new Date();
  const diasNoMes=new Date(ano,mes+1,0).getDate();
  const primeiroDia=new Date(ano,mes,1).getDay();

  const clientesAgenda=venc.filter(Boolean).map(c=>({
    ...c,
    nome:String(c.nome||"Cliente sem nome"),
    plano:String(c.plano||"Sem plano"),
    dataVencimento:c.dataVencimento||"",
    valor:Number(c.valor)||0,
  }));

  const filtered=clientesAgenda.filter(c=>{
    if(busca){const q=busca.toLowerCase();if(!c.nome.toLowerCase().includes(q)&&!c.plano.toLowerCase().includes(q)) return false;}
    if(filtro==="todos") return true;
    return c._situacao===filtro;
  });

  const grupos={atrasado:filtered.filter(c=>c._situacao==="atrasado"),vencendo:filtered.filter(c=>c._situacao==="vencendo"),a_vencer:filtered.filter(c=>c._situacao==="a_vencer"),em_dia:filtered.filter(c=>c._situacao==="em_dia")};
  const totalDivida=grupos.atrasado.reduce((s,c)=>s+c.valor,0);
  const totalPotencial=filtered.reduce((s,c)=>s+c.valor,0);

  const navMes=dir=>{let nm=mes+dir,na=ano;if(nm<0){nm=11;na--;}if(nm>11){nm=0;na++;}setMes(nm);setAno(na);};

  const cores={atrasado:C.red,vencendo:C.amber,a_vencer:C.cyan,em_dia:C.green};
  const rotulos={atrasado:"Vencidos",vencendo:"Vencendo",a_vencer:"A Vencer",em_dia:"Em Dia"};

  const seletorAgenda = (
    <div style={{background:C.card,border:`1px solid ${C.border}`}} className="rounded-2xl p-1 flex gap-1 w-[420px]">
      <button onClick={()=>setModo("financeira")} style={{background:modo==="financeira"?C.indigoDim:"transparent",color:modo==="financeira"?C.indigo:C.muted,border:`1px solid ${modo==="financeira"?C.indigoBorder:"transparent"}`}} className="flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2">
        <DollarSign size={13}/>Agenda Financeira
      </button>
      <button onClick={()=>setModo("compromissos")} style={{background:modo==="compromissos"?C.cyanDim:"transparent",color:modo==="compromissos"?C.cyan:C.muted,border:`1px solid ${modo==="compromissos"?"rgba(6,182,212,0.3)":"transparent"}`}} className="flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2">
        <CalendarDays size={13}/>Reunioes/Compromissos
      </button>
    </div>
  );

  const salvarCompromisso=async(form)=>{
    if(!form.titulo) return toast("Informe o titulo do compromisso","error");
    if(!form.data) return toast("Informe a data","error");
    await api("/api/agenda/compromissos",{method:"POST",body:JSON.stringify(form)});
    toast("Compromisso agendado","success");
    setNovoComp(null);
    loadCompromissos();
  };

  const excluirCompromisso=async(id)=>{
    if(!confirm("Excluir este compromisso?")) return;
    await api(`/api/agenda/compromissos/${id}`,{method:"DELETE"});
    toast("Compromisso excluido","info");
    loadCompromissos();
  };

  const CompForm=({onSave,onCancel})=>{
    const [f,setF]=useState({tipo:"reuniao",titulo:"",data:new Date().toISOString().split("T")[0],hora:"09:00",local:"",participantes:"",observacoes:""});
    const inputStyle={background:C.surface,border:`1px solid ${C.border}`,color:C.text,width:"100%",borderRadius:10,padding:"9px 12px",fontSize:13,outline:"none"};
    const F=(label,key,type="text")=>(
      <div><label style={{color:C.sub}} className="text-xs font-bold uppercase tracking-wider mb-1 block">{label}</label>
        <input type={type} value={f[key]||""} onChange={e=>setF({...f,[key]:e.target.value})} style={inputStyle}/></div>
    );
    return (
      <div style={{background:C.card2,border:`1px solid ${C.indigoBorder}`}} className="rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-4 gap-3">
          <div><label style={{color:C.sub}} className="text-xs font-bold uppercase tracking-wider mb-1 block">Tipo</label>
            <select value={f.tipo} onChange={e=>setF({...f,tipo:e.target.value})} style={inputStyle}>
              <option value="reuniao">Reuniao</option>
              <option value="compromisso">Compromisso</option>
              <option value="audiencia">Audiencia</option>
              <option value="ligacao">Ligacao</option>
            </select></div>
          <div className="col-span-3">{F("Titulo","titulo")}</div>
          {F("Data","data","date")}
          {F("Hora","hora","time")}
          {F("Local","local")}
          {F("Participantes","participantes")}
        </div>
        <div><label style={{color:C.sub}} className="text-xs font-bold uppercase tracking-wider mb-1 block">Observacoes</label>
          <textarea value={f.observacoes} onChange={e=>setF({...f,observacoes:e.target.value})} rows={3} style={{...inputStyle,resize:"vertical"}}/></div>
        <div className="flex gap-2">
          <button onClick={onCancel} style={{border:`1px solid ${C.border}`,color:C.muted}} className="flex-1 py-2.5 rounded-xl text-sm">Cancelar</button>
          <button onClick={()=>onSave(f)} style={{background:`linear-gradient(135deg,${C.indigo},${C.purple})`,color:"white"}} className="flex-1 py-2.5 rounded-xl text-sm font-extrabold flex items-center justify-center gap-2"><Save size={14}/>Salvar</button>
        </div>
      </div>
    );
  };

  if(modo==="compromissos") {
    const q=busca.toLowerCase();
    const lista=compromissos.filter(c=>!q||[c.titulo,c.local,c.participantes,c.tipo].some(v=>String(v||"").toLowerCase().includes(q)));
    const porDia=lista.reduce((acc:Record<string,number>,c)=>{ if(c.data) acc[c.data]=(acc[c.data]||0)+1; return acc; },{} as Record<string,number>);
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div><div style={{color:C.text}} className="font-bold text-lg">Agenda</div>
            <div style={{color:C.muted}} className="text-xs mt-0.5">{lista.length} reunioes ou compromissos cadastrados</div></div>
          {seletorAgenda}
        </div>
        <div className="flex items-center gap-3">
          <div style={{flex:1,position:"relative"}}>
            <Search size={14} style={{color:C.muted,position:"absolute",left:12,top:"50%",transform:"translateY(-50%)"}}/>
            <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar reuniao, local ou participante..." style={{background:C.card,border:`1px solid ${C.border}`,color:C.text,width:"100%",borderRadius:12,padding:"10px 14px 10px 36px",fontSize:13,outline:"none"}}/>
          </div>
          <button onClick={()=>setNovoComp({})} style={{background:`linear-gradient(135deg,${C.cyan},${C.indigo})`,color:"white"}} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-extrabold"><Plus size={15}/>Novo compromisso</button>
        </div>
        {novoComp!==null&&<CompForm onSave={salvarCompromisso} onCancel={()=>setNovoComp(null)}/>}
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,overflow:"hidden"}}>
          <div className="grid grid-cols-7" style={{borderBottom:`1px solid ${C.border}`}}>
            {["Dom","Seg","Ter","Qua","Qui","Sex","Sab"].map(d=><div key={d} style={{color:C.muted,padding:"8px 4px",textAlign:"center",fontSize:10,fontWeight:800,textTransform:"uppercase"}}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({length:primeiroDia},(_,i)=><div key={`e${i}`} style={{minHeight:64}}/>)}
            {Array.from({length:diasNoMes},(_,i)=>{
              const dia=i+1;
              const dataStr=`${ano}-${String(mes+1).padStart(2,"0")}-${String(dia).padStart(2,"0")}`;
              const isHoje=dia===hoje.getDate()&&mes===hoje.getMonth()&&ano===hoje.getFullYear();
              return (
                <div key={dia} style={{border:`1px solid ${C.border}`,minHeight:64,padding:5,background:isHoje?C.indigoDim:"transparent"}}>
                  <div style={{color:isHoje?"white":C.sub,fontSize:10,fontWeight:isHoje?800:500}}>{dia}</div>
                  {porDia[dataStr]>0&&<div style={{background:C.cyanDim,color:C.cyan,border:`1px solid rgba(6,182,212,0.25)`}} className="mt-2 rounded-md px-1.5 py-0.5 text-[9px] font-bold">{porDia[dataStr]} evento(s)</div>}
                </div>
              );
            })}
          </div>
        </div>
        <div className="grid gap-3">
          {lista.map(c=>(
            <div key={c.id} style={{background:C.card,border:`1px solid ${C.border}`}} className="rounded-2xl p-4 flex items-center gap-3">
              <div style={{background:C.cyanDim,color:C.cyan}} className="w-10 h-10 rounded-xl flex items-center justify-center"><CalendarDays size={18}/></div>
              <div className="flex-1 min-w-0">
                <div style={{color:C.text}} className="text-sm font-bold truncate">{c.titulo}</div>
                <div style={{color:C.muted}} className="text-xs flex flex-wrap gap-x-3 gap-y-1 mt-1">
                  <span className="flex items-center gap-1"><Clock size={11}/>{c.data ? new Date(`${c.data}T00:00:00`).toLocaleDateString("pt-BR") : "-"} {c.hora||""}</span>
                  {c.local&&<span className="flex items-center gap-1"><MapPin size={11}/>{c.local}</span>}
                  {c.participantes&&<span>{c.participantes}</span>}
                </div>
                {c.observacoes&&<div style={{color:C.sub}} className="text-xs mt-1 truncate">{c.observacoes}</div>}
              </div>
              <span style={{color:C.cyan,background:C.cyanDim,border:`1px solid rgba(6,182,212,0.25)`}} className="text-[10px] font-extrabold px-2 py-1 rounded-lg capitalize">{c.tipo}</span>
              <button onClick={()=>excluirCompromisso(c.id)} style={{color:C.red}} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-500/10"><Trash2 size={12}/></button>
            </div>
          ))}
          {lista.length===0&&<div style={{color:C.muted,background:C.card,border:`1px solid ${C.border}`}} className="rounded-2xl p-8 text-center text-sm">Nenhum compromisso cadastrado</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><div style={{color:C.text}} className="font-bold text-lg">Agenda Financeira</div>
          <div style={{color:C.muted}} className="text-xs mt-0.5">{filtered.length} clientes · {fmt(totalPotencial)} em recibos</div></div>
      </div>

      {seletorAgenda}

      <div className="grid grid-cols-5 gap-3">
        {["todos","atrasado","vencendo","a_vencer","em_dia"].map(k=>(
          <button key={k} onClick={()=>setFiltro(k)}
            style={{background:filtro===k?`${cores[k]||C.indigo}15`:'transparent',border:`1px solid ${filtro===k?`${cores[k]||C.indigo}40`:'transparent'}`,color:cores[k]||C.text}}
            className="rounded-xl p-3 text-center hover:bg-white/[0.02] transition-colors">
            <div className="font-bold text-lg" style={{fontFamily:"monospace"}}>{(k==="todos"?filtered:grupos[k]).length}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider">{rotulos[k]||"Total"}</div>
          </button>
        ))}
      </div>

      {filtro==="atrasado"&&totalDivida>0&&(
        <div style={{background:C.redDim,border:`1px solid rgba(244,63,94,0.3)`,borderRadius:12,padding:"10px 14px"}} className="flex items-center gap-2">
          <AlertTriangle size={14} style={{color:C.red}}/>
          <span className="text-xs font-bold" style={{color:C.red}}>Total em atraso: {fmt(totalDivida)} — {grupos.atrasado.length} clientes</span>
        </div>
      )}

      <div className="flex gap-3 items-center">
        <div style={{flex:1,position:"relative"}}>
          <Search size={14} style={{color:C.muted,position:"absolute",left:12,top:"50%",transform:"translateY(-50%)"}}/>
          <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar cliente..." style={{background:C.card,border:`1px solid ${C.border}`,color:C.text,width:"100%",borderRadius:12,padding:"10px 14px 10px 36px",fontSize:13,outline:"none"}}/>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={()=>navMes(-1)} style={{color:C.muted,border:`1px solid ${C.border}`}} className="w-7 h-7 rounded-lg flex items-center justify-center hover:border-white/20"><ChevronRight size={13} className="rotate-180"/></button>
          <span className="text-sm font-bold w-32 text-center" style={{color:C.text}}>{MESES[mes]} {ano}</span>
          <button onClick={()=>navMes(1)} style={{color:C.muted,border:`1px solid ${C.border}`}} className="w-7 h-7 rounded-lg flex items-center justify-center hover:border-white/20"><ChevronRight size={13}/></button>
        </div>
      </div>

      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,overflow:"hidden"}}>
        <div className="grid grid-cols-7" style={{borderBottom:`1px solid ${C.border}`}}>
          {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map(d=><div key={d} style={{color:C.muted,padding:"8px 4px",textAlign:"center",fontSize:10,fontWeight:800,textTransform:"uppercase"}}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({length:primeiroDia},(_,i)=><div key={`e${i}`} style={{minHeight:70}}/>)}
          {Array.from({length:diasNoMes},(_,i)=>{
            const dia=i+1;
            const dataStr=`${ano}-${String(mes+1).padStart(2,"0")}-${String(dia).padStart(2,"0")}`;
            const clientesDoDia=filtered.filter(c=>c.dataVencimento===dataStr);
            const isHoje=dia===hoje.getDate()&&mes===hoje.getMonth()&&ano===hoje.getFullYear();
            return (
              <div key={dia} style={{border:`1px solid ${C.border}`,minHeight:70,padding:4,background:isHoje?C.indigoDim:"transparent"}}>
                <div className="flex items-center justify-center mb-1">
                  <span style={{background:isHoje?C.indigo:"transparent",color:isHoje?"white":C.sub,width:22,height:22,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:isHoje?800:500}}>{dia}</span>
                </div>
                {clientesDoDia.slice(0,3).map(c=>(
                  <div key={c.id} style={{background:`${cores[c._situacao]||C.muted}20`,borderRadius:4,padding:"1px 3px",marginBottom:1,fontSize:8,color:cores[c._situacao]||C.muted,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.nome.split(" ")[0]||"Cliente"}</div>
                ))}
                {clientesDoDia.length>3&&<div style={{fontSize:7,color:C.muted,textAlign:"center"}}>+{clientesDoDia.length-3}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {["atrasado","vencendo","a_vencer"].map(sit=>{
        const items=grupos[sit]; if(!items.length) return null;
        const c=cores[sit]; const titulos={atrasado:"⚠️ Vencidos — Ação Urgente",vencendo:"🔔 Vencendo em Breve",a_vencer:"📅 Próximos Vencimentos"};
        return (
          <div key={sit} style={{background:C.card,border:`1px solid ${c}20`}} className="rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div style={{color:c}} className="font-bold text-sm">{titulos[sit]} ({items.length})</div>
              <span style={{color:c,fontFamily:"monospace"}} className="font-bold text-sm">{fmt(items.reduce((s,i)=>s+i.valor,0))}</span>
            </div>
            <div className="space-y-2">
              {items.map(cli=>(
                <div key={cli.id} style={{background:`${c}07`,border:`1px solid ${c}15`}} className="rounded-xl p-3 flex items-center gap-3">
                  <div style={{background:`${c}20`,color:c}} className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-extrabold flex-shrink-0">{cli.nome.split(" ").map(w=>w[0]).join("").slice(0,2)}</div>
                  <div className="flex-1 min-w-0">
                    <div style={{color:C.text}} className="text-sm font-semibold truncate">{cli.nome}</div>
                    <div style={{color:C.muted}} className="text-[10px]">{cli.plano} · {fmt(cli.valor)} · Venc: {cli.dataVencimento?new Date(cli.dataVencimento).toLocaleDateString("pt-BR"):"sem data"}</div>
                  </div>
                  {sit==="atrasado"&&<span style={{color:C.red,fontFamily:"monospace"}} className="text-xs font-bold">{cli._diasAtraso}d</span>}
                  {cli.telefone&&<a href={`https://wa.me/55${cli.telefone.replace(/\D/g,"")}?text=${encodeURIComponent(`Olá ${cli.nome.split(" ")[0]}, sua mensalidade de ${fmt(cli.valor)} venceu!`)}`} target="_blank" rel="noopener noreferrer" style={{background:"rgba(37,211,102,0.12)",border:"1px solid rgba(37,211,102,0.25)",color:"#25d366"}} className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-green-500/20 transition-colors flex-shrink-0"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.025.507 3.933 1.399 5.611L0 24l6.545-1.38A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.003-1.371l-.36-.214-3.722.786.798-3.618-.235-.372A9.77 9.77 0 012.182 12C2.182 6.58 6.58 2.182 12 2.182S21.818 6.58 21.818 12 17.42 21.818 12 21.818z"/></svg></a>}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// RELATÓRIOS — COM SELEÇÃO DE CAMPOS POR PASTA
// ══════════════════════════════════════════════════════════════════════════════
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
const SECOES_RELATORIO = {
  resumo: { label: "Resumo Executivo", cor: C.indigo },
  inadimplentes: { label: "Inadimplentes", cor: C.red },
  financeiro: { label: "Extrato Financeiro", cor: C.green },
  clientes: { label: "Clientes Ativos", cor: C.cyan },
  kanban: { label: "Pipeline Kanban", cor: C.purple },
  estoque: { label: "Estoque Baixo", cor: C.amber },
};

export function Relatorios({ toast, api }) {
  const [mes, setMes] = useState(new Date().getMonth()+1);
  const [ano, setAno] = useState(new Date().getFullYear());
  const [dados, setDados] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [secoes, setSecoes] = useState<Record<string,boolean>>(() => Object.keys(SECOES_RELATORIO).reduce((a,k)=>({...a,[k]:true}),{} as Record<string,boolean>));
  const [pasta, setPasta] = useState("gerencial");
  const [gerando, setGerando] = useState(false);
  const importRef=useRef<HTMLInputElement>(null);
  const MESES=["","Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

  const PASTAS = [
    {id:"gerencial",label:"Relatório Gerencial",secoesPadrao:["resumo","inadimplentes","financeiro"]},
    {id:"comercial",label:"Comercial & Vendas",secoesPadrao:["clientes","kanban","resumo"]},
    {id:"financeiro",label:"Financeiro & Contábil",secoesPadrao:["financeiro","inadimplentes","resumo"]},
    {id:"completo",label:"Relatório Completo",secoesPadrao:Object.keys(SECOES_RELATORIO)},
  ];

  useEffect(()=>{
    setLoading(true);
    api(`/api/relatorio/dados?mes=${mes}&ano=${ano}`).then(r=>r.json()).then(d=>{setDados(d);setLoading(false);}).catch(()=>setLoading(false));
  },[mes,ano]);

  useEffect(()=>{
    const p=PASTAS.find(p=>p.id===pasta);
    if(p) setSecoes(p.secoesPadrao.reduce((a,k)=>({...a,[k]:true}),{}));
  },[pasta]);

  const gerarPDF=async()=>{
    if(!dados) return;
    setGerando(true);
    const doc=new jsPDF();
    const ind:any=[99,102,241],red:any=[244,63,94],green:any=[34,197,94],dark:any=[2,4,8],cyan:any=[6,182,212];
    doc.setFillColor(dark[0],dark[1],dark[2]); doc.rect(0,0,210,42,"F");
    doc.setTextColor(ind[0],ind[1],ind[2]); doc.setFontSize(20); doc.setFont("helvetica","bold");
    doc.text(dados.empresa?.nomeEmpresa||"ACIAPA",14,20);
    doc.setFontSize(10); doc.setTextColor(180,180,180);
    doc.text(`Relatório ${PASTAS.find(p=>p.id===pasta)?.label||""} — ${MESES[mes]}/${ano}`,14,31);
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`,14,39);
    let y=55;
    const st=dados.stats||{};

    if(secoes.resumo){
      doc.setTextColor(ind[0],ind[1],ind[2]); doc.setFontSize(12); doc.setFont("helvetica","bold");
      doc.text("RESUMO EXECUTIVO",14,y); y+=6;
      autoTable(doc,{startY:y,head:[["Indicador","Resultado"]],body:[
        ["Total de Clientes",String(st.totalClientes||0)],["Clientes Ativos",String(st.ativos||0)],
        ["Em Dia",String(st.emDia||0)],["Inadimplentes",String(st.atrasados||0)],
        ["Adimplência",`${st.percentualAdimplencia||0}%`],
        ["Receita do Mês",fmt(st.receitaMes||0)],["Despesas do Mês",fmt(st.despesasMes||0)],
        ["Saldo do Mês",fmt(st.saldoMes||0)],["Inadimplência",fmt(st.inadimplencia||0)],
        ["Receita Potencial",fmt(st.receitaPotencial||0)],
      ],theme:"grid",headStyles:{fillColor:dark,textColor:ind,fontStyle:"bold"},alternateRowStyles:{fillColor:[240,245,255]},bodyStyles:{fontSize:10}});
      y=doc.lastAutoTable!.finalY+12;
    }
    if(secoes.inadimplentes&&dados.inadimplentes?.length>0){
      doc.setTextColor(red[0],red[1],red[2]); doc.setFontSize(12); doc.setFont("helvetica","bold");
      doc.text(`INADIMPLENTES (${dados.inadimplentes.length})`,14,y); y+=4;
      autoTable(doc,{startY:y,head:[["Nome","Plano","Valor","Dias","Telefone"]],body:dados.inadimplentes.map(c=>[c.nome,c.plano,fmt(c.valor),String(c._diasAtraso||0)+"d",c.telefone]),theme:"grid",headStyles:{fillColor:red,textColor:255,fontStyle:"bold"},alternateRowStyles:{fillColor:[255,240,243]},bodyStyles:{fontSize:9}});
      y=doc.lastAutoTable!.finalY+12;
    }
    if(secoes.financeiro&&dados.transacoes?.length>0){
      if(y>220){doc.addPage();y=20;}
      doc.setTextColor(dark[0],dark[1],dark[2]); doc.setFontSize(12); doc.setFont("helvetica","bold");
      doc.text("EXTRATO FINANCEIRO",14,y); y+=4;
      autoTable(doc,{startY:y,head:[["Tipo","Cat.","Descrição","Valor","Data"]],body:dados.transacoes.map((t:any)=>[(t.tipo||"").toUpperCase(),t.categoria,t.descricao,(t.tipo==="entrada"?"+":"-")+fmt(t.valor),t.data]),theme:"striped",headStyles:{fillColor:dark,textColor:ind,fontStyle:"bold"},bodyStyles:{fontSize:9},didParseCell:(d:any)=>{if(d.column.index===3&&d.cell.raw?.startsWith("+"))d.cell.styles.textColor=green;if(d.column.index===3&&d.cell.raw?.startsWith("-"))d.cell.styles.textColor=red;}});
      y=doc.lastAutoTable!.finalY+12;
    }
    if(secoes.clientes&&dados.clientes?.length>0){
      if(y>220){doc.addPage();y=20;}
      doc.setTextColor(cyan[0],cyan[1],cyan[2]); doc.setFontSize(12); doc.setFont("helvetica","bold");
      doc.text("CLIENTES ATIVOS",14,y); y+=4;
      autoTable(doc,{startY:y,head:[["Nome","Plano","Valor","Status","Vencimento"]],body:dados.clientes.filter(c=>c.status==="ativo").slice(0,20).map(c=>[c.nome,c.plano,fmt(c.valor),c._situacao,c.dataVencimento]),theme:"grid",headStyles:{fillColor:[6,182,212],textColor:255,fontStyle:"bold"},bodyStyles:{fontSize:8}});
      y=doc.lastAutoTable!.finalY+12;
    }
    const pgs=(doc.internal as any).getNumberOfPages();
    for(let p=1;p<=pgs;p++){doc.setPage(p);doc.setFillColor(dark[0],dark[1],dark[2]); doc.rect(0,282,210,15,"F");doc.setTextColor(100,100,100);doc.setFontSize(7);doc.text(`${dados.empresa?.nomeEmpresa||"ACIAPA"} — Relatório ${PASTAS.find(p=>p.id===pasta)?.label} — Pág ${p}/${pgs}`,14,290);}
    doc.save(`relatorio_${PASTAS.find(p=>p.id===pasta)?.id}_${MESES[mes]}_${ano}.pdf`);
    toast("PDF gerado com sucesso!","success");
    setGerando(false);
  };

  const navMes=dir=>{let nm=mes+dir,na=ano;if(nm<1){nm=12;na--;}if(nm>12){nm=1;na++;}setMes(nm);setAno(na);};

  return (
    <div className="space-y-5">
      <div style={{color:C.text}} className="font-bold text-lg">Relatórios Inteligentes</div>

      <div className="flex items-center justify-between" style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"12px 16px"}}>
        <div className="flex items-center gap-4">
          <span className="text-xs font-bold uppercase tracking-wider" style={{color:C.indigo}}>Período:</span>
          <div className="flex items-center gap-1">
            <button onClick={()=>navMes(-1)} style={{color:C.muted,border:`1px solid ${C.border}`}} className="w-7 h-7 rounded-lg flex items-center justify-center hover:border-white/20"><ChevronRight size={13} className="rotate-180"/></button>
            <span style={{color:C.text}} className="text-sm font-bold w-36 text-center">{MESES[mes]} {ano}</span>
            <button onClick={()=>navMes(1)} style={{color:C.muted,border:`1px solid ${C.border}`}} className="w-7 h-7 rounded-lg flex items-center justify-center hover:border-white/20"><ChevronRight size={13}/></button>
          </div>
        </div>
        {dados&&!loading&&(
          <div className="flex gap-4">
            {[["Clientes",dados.stats?.totalClientes,C.indigo],["Em Dia",dados.stats?.emDia,C.green],["Atrasados",dados.stats?.atrasados,C.red],["Receita",fmt(dados.stats?.receitaMes),C.cyan]].map(([k,v,c])=>(
              <div key={k} className="text-center"><div style={{color:c,fontFamily:"monospace"}} className="font-extrabold text-sm">{v}</div><div style={{color:C.muted}} className="text-[9px]">{k}</div></div>
            ))}
          </div>
        )}
        {loading&&<RefreshCw size={16} style={{color:C.indigo}} className="animate-spin"/>}
      </div>

      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:16}} className="space-y-4">
        <div style={{color:C.text}} className="font-bold text-sm">1. Escolha a pasta do relatório</div>
        <div className="flex gap-2 flex-wrap">
          {PASTAS.map(p=>(
            <button key={p.id} onClick={()=>setPasta(p.id)}
              style={{background:pasta===p.id?C.indigoDim:"transparent",border:`1px solid ${pasta===p.id?C.indigoBorder:C.border}`,color:pasta===p.id?C.indigo:C.muted}}
              className="px-4 py-2 rounded-xl text-xs font-bold transition-all hover:text-white">{p.label}</button>
          ))}
        </div>
      </div>

      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:16}} className="space-y-4">
        <div className="flex items-center justify-between">
          <div style={{color:C.text}} className="font-bold text-sm">2. Selecione as seções para incluir</div>
          <div className="flex gap-2">
            <button onClick={()=>setSecoes(Object.keys(SECOES_RELATORIO).reduce((a,k)=>({...a,[k]:true}),{}))} style={{color:C.muted,border:`1px solid ${C.border}`}} className="px-3 py-1.5 rounded-lg text-[10px] font-bold hover:border-white/20">Todas</button>
            <button onClick={()=>setSecoes(Object.keys(SECOES_RELATORIO).reduce((a,k)=>({...a,[k]:false}),{}))} style={{color:C.muted,border:`1px solid ${C.border}`}} className="px-3 py-1.5 rounded-lg text-[10px] font-bold hover:border-white/20">Nenhuma</button>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(SECOES_RELATORIO).map(([k,v])=>(
            <button key={k} onClick={()=>setSecoes({...secoes,[k]:!secoes[k]})}
              style={{background:secoes[k]?`${v.cor}18`:"transparent",border:`1px solid ${secoes[k]?`${v.cor}40`:C.border}`,color:secoes[k]?v.cor:C.muted}}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all hover:text-white">
              {secoes[k]?<Check size={12}/>:<div style={{width:12,height:12,border:`1px solid ${C.border}`,borderRadius:3}}/>}
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div style={{background:C.card,border:`1px solid ${C.indigoBorder}`}} className="rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div style={{background:C.indigoDim}} className="w-10 h-10 rounded-xl flex items-center justify-center"><FileText size={18} style={{color:C.indigo}}/></div>
            <div><div style={{color:C.text}} className="font-bold text-sm">Gerar PDF</div><div style={{color:C.muted}} className="text-xs">{Object.values(secoes).filter(Boolean).length} seções selecionadas</div></div>
          </div>
          <button onClick={gerarPDF} disabled={gerando||!dados}
            style={{background:gerando?C.muted:`linear-gradient(135deg,${C.indigo},${C.purple})`,color:"white",opacity:dados?1:0.5}}
            className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90">
            {gerando?<><RefreshCw size={15} className="animate-spin"/>Gerando...</>:<><Printer size={15}/>Gerar PDF Personalizado</>}
          </button>
        </div>

        <div style={{background:C.card,border:"1px solid rgba(34,197,94,0.2)"}} className="rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div style={{background:C.greenDim}} className="w-10 h-10 rounded-xl flex items-center justify-center"><FileSpreadsheet size={18} style={{color:C.green}}/></div>
            <div><div style={{color:C.text}} className="font-bold text-sm">Exportar Excel</div><div style={{color:C.muted}} className="text-xs">Dados em planilha .xlsx</div></div>
          </div>
          <div className="space-y-2">
            {[["/api/clientes/export","Clientes"],["/api/export/financeiro?mes="+mes+"&ano="+ano,`Financeiro ${MESES[mes]}`]].map(([url,l])=>(
              <a key={l} href={url} download style={{background:C.greenDim,border:"1px solid rgba(34,197,94,0.25)",color:C.green}} className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold hover:bg-green-500/20 transition-colors"><FileSpreadsheet size={13}/>{l}</a>
            ))}
          </div>
        </div>

        <div style={{background:C.card,border:"1px solid rgba(139,92,246,0.2)"}} className="rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div style={{background:C.purpleDim}} className="w-10 h-10 rounded-xl flex items-center justify-center"><Upload size={18} style={{color:C.purple}}/></div>
            <div><div style={{color:C.text}} className="font-bold text-sm">Importar Planilha</div><div style={{color:C.muted}} className="text-xs">Clientes via arquivo</div></div>
          </div>
          <button onClick={()=>importRef.current?.click()} style={{background:C.purpleDim,border:"1px solid rgba(139,92,246,0.25)",color:C.purple,width:"100%"}} className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold hover:bg-purple-500/20 transition-colors"><Upload size={13}/>Importar Clientes</button>
          <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={async e=>{const f=e.target.files?.[0];if(!f)return;const fd=new FormData();fd.append("file",f);const r=await fetch("/api/clientes/import",{method:"POST",headers:{Authorization:`Bearer ${localStorage.getItem("aciapa_token")}`},body:fd});const d=await r.json();if(d.ok)toast(`${d.importados} clientes importados!`,"success");else toast(d.error||"Erro","error");e.target.value="";}}/>
          <div style={{color:C.muted,marginTop:12}} className="text-[10px]">Colunas: nome, email, telefone, plano, valor, status</div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CONFIGURAÇÕES
// ══════════════════════════════════════════════════════════════════════════════
import { useAuth } from "../contexts/AuthContext.jsx";
import { MessageSquare } from "lucide-react";

export function Configuracoes({ toast, api, reload }) {
  const { user, can } = useAuth();
  const [tab,    setTab]  = useState("empresa");
  const [cfg,    setCfg]  = useState<any>({});
  const [users,  setUsers]= useState<any[]>([]);
  const [saved,  setSaved]= useState(false);
  const [showKey,setShowKey]=useState({a:false,o:false});
  const [newUser,setNewUser]=useState<any>(null);
  const smtpRef = useRef({smtpHost:"",smtpPort:"587",smtpUsuario:"",smtpSenha:"",smtpRemetente:"",smtpSecure:false,smtpSenhaSet:false});
  const [smtpInit,setSmtpInit] = useState(0);

  useEffect(()=>{
    if(tab==="email"){
      api("/api/smtp-config").then(r=>r.json()).then(d=>{
        const v = smtpRef.current;
        v.smtpHost = d.host||"";
        v.smtpPort = d.port||"587";
        v.smtpUsuario = d.usuario||"";
        v.smtpSenha = d.senha||"";
        v.smtpRemetente = d.remetente||"";
        v.smtpSecure = d.secure||false;
        v.smtpSenhaSet = d.senhaSet||false;
        setCfg({smtpHost:v.smtpHost,smtpPort:v.smtpPort,smtpUsuario:v.smtpUsuario,smtpSenha:v.smtpSenha,smtpRemetente:v.smtpRemetente,smtpSecure:v.smtpSecure,smtpSenhaSet:v.smtpSenhaSet});
        setSmtpInit(i=>i+1);
      }).catch(()=>{});
    } else {
      api("/api/settings").then(r=>r.json()).then(setCfg).catch(()=>{});
    }
  },[tab]);
  useEffect(()=>{ if(tab==="usuarios"&&can("super_admin","admin")) api("/api/users").then(r=>r.json()).then(setUsers).catch(()=>{}); },[tab]);

  const saveCfg=async()=>{
    if(tab==="email"){
      const v = smtpRef.current;
      const body:any = {host:v.smtpHost,port:v.smtpPort,usuario:v.smtpUsuario,remetente:v.smtpRemetente,secure:v.smtpSecure};
      if (v.smtpSenha) body.senha = v.smtpSenha;
      await api("/api/smtp-config",{method:"PUT",body:JSON.stringify(body)});
    } else {
      await api("/api/settings",{method:"PUT",body:JSON.stringify(cfg)});
    }
    setSaved(true); setTimeout(()=>setSaved(false),2500); toast("Configurações salvas!","success"); reload();
  };

  const saveUser=async(u)=>{
    if(u.id) await api(`/api/users/${u.id}`,{method:"PUT",body:JSON.stringify(u)});
    else await api("/api/users",{method:"POST",body:JSON.stringify(u)});
    toast("Usuário salvo!","success"); setNewUser(null);
    api("/api/users").then(r=>r.json()).then(setUsers);
  };

  const delUser=async id=>{ if(!confirm("Excluir usuário?")) return; await api(`/api/users/${id}`,{method:"DELETE"}); setUsers(us=>us.filter(u=>u.id!==id)); };

  const TABS=[["empresa","Empresa"],["usuarios","Usuários"],["ia","Inteligência Artificial"],["whatsapp","WhatsApp"],["email","E-mail SMTP"],["seguranca","Segurança"],["atualizacoes","Atualizações"]];
  const roleColors={super_admin:C.red,admin:C.indigo,financeiro:C.green,atendimento:C.cyan,visualizador:C.muted};

  const S=({icon:Icon,title,sub,color,children})=>(
    <div style={{background:C.card2,border:`1px solid ${C.border}`}} className="rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-3 mb-1"><div style={{background:`${color}15`}} className="w-9 h-9 rounded-xl flex items-center justify-center"><Icon size={16} style={{color}}/></div><div><div style={{color:C.text}} className="font-bold text-sm">{title}</div><div style={{color:C.muted}} className="text-xs">{sub}</div></div></div>
      {children}
    </div>
  );

  const F=(l,k,type="text",ph="")=>(
    <div><label style={{color:C.sub}} className="text-xs font-bold mb-1.5 block uppercase tracking-wider">{l}</label>
    <input type={type} value={cfg[k]||""} onChange={e=>setCfg({...cfg,[k]:e.target.value})} placeholder={ph}
      style={{background:C.surface,border:`1px solid ${C.border}`,color:C.text,width:"100%",borderRadius:12,padding:"10px 14px",fontSize:13,outline:"none"}}
      onFocus={e=>e.target.style.borderColor=C.indigoBorder} onBlur={e=>e.target.style.borderColor=C.border}/></div>
  );

  return (
    <div className="max-w-3xl space-y-4">
      <div style={{color:C.text}} className="font-bold text-lg">Configurações</div>
      <div style={{background:C.card,border:`1px solid ${C.border}`}} className="rounded-2xl p-1 flex gap-1 flex-wrap">
        {TABS.filter(([k])=>k!=="usuarios"||can("super_admin","admin")).map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{background:tab===k?C.indigoDim:"transparent",color:tab===k?C.indigo:C.muted,border:`1px solid ${tab===k?C.indigoBorder:"transparent"}`}} className="flex-1 min-w-[80px] py-2 rounded-xl text-xs font-bold transition-all">{l}</button>
        ))}
      </div>

      {tab==="empresa"&&(
        <S icon={Building2} title="Dados da Empresa" sub="Informações gerais" color={C.indigo}>
          <div className="grid grid-cols-2 gap-4">
            {F("Nome da Empresa","nomeEmpresa")} {F("CNPJ","cnpj")} {F("E-mail","email","email")} {F("Telefone","telefone")} <div className="col-span-2">{F("Endereço","endereco")}</div>
          </div>
        </S>
      )}

      {tab==="usuarios"&&can("super_admin","admin")&&(
        <div className="space-y-4">
          <button onClick={()=>setNewUser({nome:"",email:"",role:"atendimento",cor:"#6366f1"})} style={{background:`linear-gradient(135deg,${C.indigo},${C.purple})`,color:"white"}} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-extrabold hover:opacity-90"><Plus size={14}/>Novo Usuário</button>
          {newUser&&(
            <div style={{background:C.card2,border:`1px solid ${C.indigoBorder}`}} className="rounded-2xl p-5 space-y-3">
              <div style={{color:C.indigo}} className="font-bold text-sm">Novo Usuário</div>
              <div className="grid grid-cols-2 gap-3">
                {[["Nome",v=>setNewUser({...newUser,nome:v}),newUser.nome,"Nome completo"],["E-mail",v=>setNewUser({...newUser,email:v}),newUser.email,"email@empresa.com"],["Senha",v=>setNewUser({...newUser,senha:v}),newUser.senha||"","Senha inicial (min 6 chars)"]].map(([l,set,val,ph])=>(
                  <div key={l}><label style={{color:C.sub}} className="text-xs font-bold mb-1 block uppercase tracking-wider">{l}</label><input value={val} onChange={e=>set(e.target.value)} placeholder={ph} type={l==="Senha"?"password":"text"} style={{background:C.surface,border:`1px solid ${C.border}`,color:C.text,width:"100%",borderRadius:12,padding:"8px 12px",fontSize:13,outline:"none"}}/></div>
                ))}
                <div><label style={{color:C.sub}} className="text-xs font-bold mb-1 block uppercase tracking-wider">Perfil</label>
                <select value={newUser.role} onChange={e=>setNewUser({...newUser,role:e.target.value})} style={{background:C.surface,border:`1px solid ${C.border}`,color:C.text,width:"100%",borderRadius:12,padding:"8px 12px",fontSize:13,outline:"none"}}>
                  {["super_admin","admin","financeiro","atendimento","visualizador"].map(r=><option key={r}>{r}</option>)}</select></div>
              </div>
              <div className="flex gap-3">
                <button onClick={()=>setNewUser(null)} style={{border:`1px solid ${C.border}`,color:C.muted}} className="flex-1 py-2.5 rounded-xl text-sm hover:border-white/20">Cancelar</button>
                <button onClick={()=>saveUser(newUser)} style={{background:`linear-gradient(135deg,${C.indigo},${C.purple})`,color:"white"}} className="flex-1 py-2.5 rounded-xl text-sm font-extrabold hover:opacity-90"><Save size={12} className="inline mr-1"/>Salvar</button>
              </div>
            </div>
          )}
          <div style={{background:C.card,border:`1px solid ${C.border}`}} className="rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead><tr style={{background:C.card2,borderBottom:`1px solid ${C.border}`}}>{["Usuário","E-mail","Perfil","Status","Ações"].map(h=><th key={h} style={{color:C.muted,padding:"10px 14px",textAlign:"left",fontSize:10,fontWeight:800,textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
              <tbody>
                {users.map((u,i)=>(
                  <tr key={u.id} style={{borderBottom:i<users.length-1?`1px solid ${C.border}`:"none"}} className="hover:bg-white/[0.015]">
                    <td style={{padding:"10px 14px"}}>
                      <div className="flex items-center gap-2">
                        <div style={{background:`${u.cor||C.indigo}20`,color:u.cor||C.indigo,border:`1px solid ${u.cor||C.indigo}30`}} className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-extrabold">{u.avatar}</div>
                        <span style={{color:C.text}} className="text-sm font-semibold">{u.nome}</span>
                      </div>
                    </td>
                    <td style={{padding:"10px 14px",color:C.sub,fontSize:12}}>{u.email}</td>
                    <td style={{padding:"10px 14px"}}><span style={{color:roleColors[u.role]||C.muted,background:`${roleColors[u.role]||C.muted}15`,border:`1px solid ${roleColors[u.role]||C.muted}30`,fontSize:10,fontWeight:800,padding:"2px 8px",borderRadius:6}}>{u.role}</span></td>
                    <td style={{padding:"10px 14px"}}><span style={{color:u.ativo?C.green:C.red,fontSize:10,fontWeight:800}}>{u.ativo?"Ativo":"Inativo"}</span></td>
                    <td style={{padding:"10px 14px"}}>
                      <div className="flex gap-1">
                        <button onClick={()=>setNewUser(u)} style={{color:C.muted,border:`1px solid ${C.border}`}} className="w-7 h-7 rounded-lg flex items-center justify-center hover:text-white hover:border-white/20"><Edit size={11}/></button>
                        {u.id!==user?.id&&<button onClick={()=>delUser(u.id)} style={{color:C.red,background:C.redDim}} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-500/20"><Trash2 size={11}/></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab==="ia"&&(
          <S icon={Brain} title="Inteligência Artificial" sub="Configure provedores de IA" color={C.purple}>
            <div style={{background:C.purpleDim,border:"1px solid rgba(139,92,246,0.2)",color:C.sub}} className="rounded-xl p-3 text-xs space-y-1">
              <div style={{color:C.green}} className="font-bold">✅ Ollama (gratuito/local) — ativo automaticamente</div>
              <div style={{color:C.muted}}>Com Ollama rodando em <code style={{color:C.cyan}}>localhost:11434</code>, o sistema já responde com IA local (Llama 3.2). Nenhuma chave necessária.</div>
              <hr style={{borderColor:C.border,margin:"6px 0"}}/>
              <div style={{color:C.purple}} className="font-bold">🔑 APIs pagas (fallback se Ollama estiver off)</div>
              <div style={{color:C.muted}}>Se Ollama não estiver disponível, tenta estas chaves em ordem:</div>
            </div>
          {[["Chave Anthropic Claude (claude-sonnet-4-20250514)","anthropicKey","sk-ant-...","a"],["Chave OpenAI (gpt-4o-mini)","openaiKey","sk-...","o"]].map(([l,k,ph,showK])=>(
            <div key={k}>
              <label style={{color:C.sub}} className="text-xs font-bold mb-1.5 block uppercase tracking-wider">{l}</label>
              <div className="flex gap-2">
                <input type={showKey[showK]?"text":"password"} value={cfg[k]||""} onChange={e=>setCfg({...cfg,[k]:e.target.value})} placeholder={ph} style={{background:C.surface,border:`1px solid ${C.border}`,color:C.text,flex:1,borderRadius:12,padding:"10px 14px",fontSize:12,outline:"none",fontFamily:"monospace"}}/>
                <button onClick={()=>setShowKey({...showKey,[showK]:!showKey[showK]})} style={{border:`1px solid ${C.border}`,color:C.muted}} className="px-3 rounded-xl text-xs hover:border-white/20">
                  {showKey[showK]?<EyeOff size={14}/>:<Eye size={14}/>}
                </button>
              </div>
            </div>
          ))}
        </S>
      )}

      {tab==="whatsapp"&&(
        <S icon={MessageSquare} title="Configuração WhatsApp" sub="Comportamento de envio e mensagens" color={C.green}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label style={{color:C.sub}} className="text-xs font-bold mb-1.5 block uppercase tracking-wider">Delay Mínimo (s)</label>
              <input type="number" min="1" max="30" value={cfg.minDelay||3} onChange={e=>setCfg({...cfg,minDelay:+e.target.value})} style={{background:C.surface,border:`1px solid ${C.border}`,color:C.text,width:"100%",borderRadius:12,padding:"10px 14px",fontSize:13,outline:"none"}}/>
            </div>
            <div>
              <label style={{color:C.sub}} className="text-xs font-bold mb-1.5 block uppercase tracking-wider">Delay Máximo (s)</label>
              <input type="number" min="1" max="60" value={cfg.maxDelay||8} onChange={e=>setCfg({...cfg,maxDelay:+e.target.value})} style={{background:C.surface,border:`1px solid ${C.border}`,color:C.text,width:"100%",borderRadius:12,padding:"10px 14px",fontSize:13,outline:"none"}}/>
            </div>
          </div>
          <div>
            <label style={{color:C.sub}} className="text-xs font-bold mb-1.5 block uppercase tracking-wider">Mensagem padrão de cobrança</label>
            <textarea value={cfg.whatsappMsg||""} onChange={e=>setCfg({...cfg,whatsappMsg:e.target.value})} rows={4} style={{background:C.surface,border:`1px solid ${C.border}`,color:C.text,width:"100%",borderRadius:12,padding:"10px 14px",fontSize:13,outline:"none",resize:"none"}}/>
            <div style={{color:C.muted}} className="text-[10px] mt-1">Variáveis: {"{{nome}} {{valor}} {{vencimento}} {{diasAtraso}}"}</div>
          </div>
        </S>
      )}

      {tab==="email"&&(
        <S key={smtpInit} icon={Mail} title="Configuração SMTP" sub="Servidor de e-mail para envio real" color={C.cyan}>
          <div className="space-y-4">
            <div style={{background:C.cyanDim,border:"1px solid rgba(6,182,212,0.2)",color:C.sub}} className="rounded-xl p-3 text-xs space-y-1">
              <div style={{color:C.cyan}} className="font-bold">📧 Configure o servidor SMTP para enviar e-mails reais</div>
              <div style={{color:C.muted}}>Os e-mails enviados pelo sistema usarão estas credenciais. O campo "Remetente" é opcional (padrão: usuário SMTP).</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label style={{color:C.sub}} className="text-xs font-bold mb-1.5 block uppercase tracking-wider">Servidor SMTP *</label>
                <input defaultValue={smtpRef.current.smtpHost} onInput={e=>smtpRef.current.smtpHost=e.currentTarget.value} placeholder="smtp.gmail.com" style={{background:C.surface,border:`1px solid ${C.border}`,color:C.text,width:"100%",borderRadius:12,padding:"10px 14px",fontSize:13,outline:"none"}}/>
              </div>
              <div>
                <label style={{color:C.sub}} className="text-xs font-bold mb-1.5 block uppercase tracking-wider">Porta *</label>
                <input type="number" defaultValue={smtpRef.current.smtpPort} onInput={e=>smtpRef.current.smtpPort=e.currentTarget.value} placeholder="587" style={{background:C.surface,border:`1px solid ${C.border}`,color:C.text,width:"100%",borderRadius:12,padding:"10px 14px",fontSize:13,outline:"none"}}/>
              </div>
              <div>
                <label style={{color:C.sub}} className="text-xs font-bold mb-1.5 block uppercase tracking-wider">Usuário *</label>
                <input defaultValue={smtpRef.current.smtpUsuario} onInput={e=>smtpRef.current.smtpUsuario=e.currentTarget.value} placeholder="seu@email.com" style={{background:C.surface,border:`1px solid ${C.border}`,color:C.text,width:"100%",borderRadius:12,padding:"10px 14px",fontSize:13,outline:"none"}}/>
              </div>
              <div>
                <label style={{color:C.sub}} className="text-xs font-bold mb-1.5 block uppercase tracking-wider">Senha</label>
                <input type="password" defaultValue={smtpRef.current.smtpSenha} onInput={e=>smtpRef.current.smtpSenha=e.currentTarget.value} placeholder={smtpRef.current.smtpSenhaSet ? "•••••••• (deixe vazio para manter)" : "senha ou app password"} style={{background:C.surface,border:`1px solid ${C.border}`,color:C.text,width:"100%",borderRadius:12,padding:"10px 14px",fontSize:13,outline:"none"}}/>
              </div>
              <div>
                <label style={{color:C.sub}} className="text-xs font-bold mb-1.5 block uppercase tracking-wider">Remetente (opcional)</label>
                <input defaultValue={smtpRef.current.smtpRemetente} onInput={e=>smtpRef.current.smtpRemetente=e.currentTarget.value} placeholder="Nome <email>" style={{background:C.surface,border:`1px solid ${C.border}`,color:C.text,width:"100%",borderRadius:12,padding:"10px 14px",fontSize:13,outline:"none"}}/>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer" style={{color:C.sub}}>
                  <input type="checkbox" defaultChecked={smtpRef.current.smtpSecure} onChange={e=>smtpRef.current.smtpSecure=e.target.checked} style={{accentColor:C.cyan}}/>
                  <span className="text-xs font-bold uppercase tracking-wider">SSL/TLS (porta 465)</span>
                </label>
              </div>
            </div>
            <button onClick={async()=>{
              const v = smtpRef.current;
              const r=await api("/api/smtp-test",{method:"POST",body:JSON.stringify({host:v.smtpHost,port:v.smtpPort,usuario:v.smtpUsuario,senha:v.smtpSenha,secure:v.smtpSecure})});
              const d=await r.json();
              if(d.ok) toast(d.mensagem,"success"); else toast(d.error||"Falha no teste","error");
            }} style={{background:`linear-gradient(135deg,${C.cyan},${C.indigo})`,color:"white"}} className="w-full py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 hover:opacity-90">
              <Send size={13}/> Testar Conexão SMTP
            </button>
          </div>
        </S>
      )}

      {tab==="seguranca"&&(
        <S icon={Shield} title="Segurança" sub="Alterar senha da sua conta" color={C.amber}>
          <SenhaForm api={api} toast={toast}/>
        </S>
      )}

      {tab==="atualizacoes"&&(
        <Atualizacoes api={api} toast={toast}/>
      )}

      {tab!=="usuarios"&&tab!=="atualizacoes"&&<button onClick={saveCfg} style={{background:saved?"#16a34a":`linear-gradient(135deg,${C.indigo},${C.purple})`,color:"white",boxShadow:`0 0 24px ${C.indigo}25`}} className="w-full py-3.5 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all">
        {saved?<><Check size={16}/>Salvo!</>:<><Save size={16}/>Salvar Configurações</>}
      </button>}
    </div>
  );
}

function Atualizacoes({ api, toast }) {
  const [status, setStatus] = useState("idle");
  const [versao, setVersao] = useState<any>(null);
  const [info, setInfo] = useState<any>(null);
  const [progresso, setProgresso] = useState<any>(null);
  const [isElectron, setIsElectron] = useState(!!window.aciapa?.checkForUpdates);

  useEffect(() => {
    api("/api/versao").then(r => r.json()).then(setVersao).catch(() => {});
    if (window.aciapa?.onUpdateStatus) {
      const off = window.aciapa.onUpdateStatus((...args) => {
        if (args[0]?.percent !== undefined) {
          setProgresso(args[0].percent);
        } else if (args[0] === "download-complete" || args.length === 0) {
          setStatus("baixado");
        } else if (typeof args[0] === "string") {
          setStatus("erro");
          toast("Erro na atualização: " + args[0], "error");
        }
      });
      return off;
    }
  }, []);

  const verificar = async () => {
    setStatus("verificando");
    if (isElectron) {
      const r = await window.aciapa?.checkForUpdates?.();
      if (r?.available) {
        setInfo(r.info);
        setStatus("disponivel");
      } else {
        setStatus("atualizado");
      }
    } else {
      try {
        const r = await api("/api/versao");
        const d = await r.json();
        setVersao(d);
        setStatus("web");
      } catch {
        setStatus("erro");
      }
    }
  };

  const baixar = async () => {
    setStatus("baixando");
    const r = await window.aciapa?.downloadUpdate?.();
    if (r?.downloaded) setStatus("baixado");
    else setStatus("erro");
  };

  const instalar = () => {
    window.aciapa?.installUpdate?.();
  };

  return (
    <div className="space-y-4">
      <div style={{background:C.card2,border:`1px solid ${C.border}`}} className="rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div style={{background:`${C.indigo}15`}} className="w-9 h-9 rounded-xl flex items-center justify-center">
            <Download size={16} style={{color:C.indigo}}/>
          </div>
          <div>
            <div style={{color:C.text}} className="font-bold text-sm">Atualizações</div>
            <div style={{color:C.muted}} className="text-xs">Versão atual: {versao?.versao || "carregando..."}</div>
          </div>
        </div>

        {!isElectron && (
          <div style={{background:C.amberDim,border:"1px solid rgba(245,158,11,0.2)",color:C.sub}} className="rounded-xl p-3 text-xs">
            Você está usando a <strong style={{color:C.amber}}>versão web</strong>. Para receber atualizações automáticas, faça 
            o download da versão mais recente em <strong style={{color:C.indigo}}>github.com/lucbruna/nexuspro/releases</strong> 
            ou execute o instalador do ACIAPA.
          </div>
        )}

        {status === "idle" && (
          <button onClick={verificar} style={{background:`linear-gradient(135deg,${C.indigo},${C.purple})`,color:"white"}} className="w-full py-3 rounded-xl text-sm font-extrabold flex items-center justify-center gap-2">
            <RefreshCw size={14}/> Verificar atualizações
          </button>
        )}

        {status === "verificando" && (
          <div style={{color:C.muted}} className="text-center text-sm py-4 flex items-center justify-center gap-2">
            <RotateCw size={14} className="animate-spin"/> Verificando...
          </div>
        )}

        {status === "atualizado" && (
          <div style={{background:`${C.green}15`,border:`1px solid ${C.green}30`,color:C.green}} className="rounded-xl p-4 text-center text-sm font-bold">
            ✅ ACIAPA está atualizado!
          </div>
        )}

        {status === "disponivel" && info && (
          <div style={{background:`${C.amber}15`,border:`1px solid ${C.amber}30`}} className="rounded-xl p-4 space-y-3">
            <div style={{color:C.amber}} className="font-bold text-sm">Nova versão disponível: {info.version}</div>
            {info.releaseNotes && <div style={{color:C.sub}} className="text-xs whitespace-pre-wrap">{info.releaseNotes}</div>}
            <button onClick={baixar} style={{background:`linear-gradient(135deg,${C.indigo},${C.purple})`,color:"white"}} className="w-full py-3 rounded-xl text-sm font-extrabold flex items-center justify-center gap-2">
              <Download size={14}/> Baixar atualização
            </button>
          </div>
        )}

        {status === "baixando" && (
          <div className="space-y-2">
            <div style={{color:C.text}} className="text-sm font-bold text-center">Baixando atualização...</div>
            {progresso !== null && (
              <div style={{background:C.surface,borderRadius:10,height:8,overflow:"hidden"}}>
                <div style={{width:`${progresso}%`,background:`linear-gradient(90deg,${C.indigo},${C.purple})`,height:"100%",borderRadius:10,transition:"width 0.3s"}}/>
              </div>
            )}
            <div style={{color:C.muted}} className="text-xs text-center">{progresso != null ? `${Math.round(progresso)}%` : "Iniciando..."}</div>
          </div>
        )}

        {status === "baixado" && (
          <div className="space-y-3">
            <div style={{background:`${C.green}15`,border:`1px solid ${C.green}30`,color:C.green}} className="rounded-xl p-4 text-center text-sm font-bold">
              ✅ Download concluído!
            </div>
            <button onClick={instalar} style={{background:`linear-gradient(135deg,${C.green},${C.green})`,color:"white"}} className="w-full py-3 rounded-xl text-sm font-extrabold flex items-center justify-center gap-2">
              <RefreshCw size={14}/> Reiniciar e instalar
            </button>
          </div>
        )}

        {status === "erro" && (
          <div style={{background:`${C.red}15`,border:`1px solid ${C.red}30`,color:C.red}} className="rounded-xl p-4 text-center text-sm">
            ❌ Erro ao verificar atualizações. Verifique sua conexão.
          </div>
        )}
      </div>

      {versao && (
        <div style={{background:C.card2,border:`1px solid ${C.border}`}} className="rounded-2xl p-5 space-y-3">
          <div style={{color:C.text}} className="font-bold text-sm">Informações do sistema</div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            {[
              ["Versão", versao.versao],
              ["Node.js", versao.node || "-"],
              ["Plataforma", versao.plataforma || "-"],
              ["Memória", versao.memoria ? `${Math.round(versao.memoria.heapUsed / 1024 / 1024)}MB / ${Math.round(versao.memoria.heapTotal / 1024 / 1024)}MB` : "-"],
              ["Ativo há", versao.uptime ? `${Math.round(versao.uptime / 60)} min` : "-"],
            ].map(([l, v]) => (
              <div key={l}>
                <span style={{color:C.muted}}>{l}</span>
                <div style={{color:C.text,fontWeight:700}}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SenhaForm({ api, toast }) {
  const [form,setForm]=useState({senhaAtual:"",novaSenha:"",confirmar:""});
  const save=async()=>{
    if(form.novaSenha!==form.confirmar) return toast("Senhas não conferem","error");
    if(form.novaSenha.length<6) return toast("Mínimo 6 caracteres","error");
    const r=await api("/api/auth/senha",{method:"PUT",body:JSON.stringify({senhaAtual:form.senhaAtual,novaSenha:form.novaSenha})});
    const d=await r.json();
    if(d.ok){ toast("Senha alterada!","success"); setForm({senhaAtual:"",novaSenha:"",confirmar:""}); }
    else toast(d.error||"Erro","error");
  };
  return (
    <div className="space-y-3">
      {[["Senha Atual","senhaAtual"],["Nova Senha","novaSenha"],["Confirmar Nova Senha","confirmar"]].map(([l,k])=>(
        <div key={k}><label style={{color:C.sub}} className="text-xs font-bold mb-1 block uppercase tracking-wider">{l}</label>
        <input type="password" value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} style={{background:C.surface,border:`1px solid ${C.border}`,color:C.text,width:"100%",borderRadius:12,padding:"10px 14px",fontSize:13,outline:"none"}}/></div>
      ))}
      <button onClick={save} style={{background:`linear-gradient(135deg,${C.amber},#d97706)`,color:"white"}} className="w-full py-2.5 rounded-xl font-extrabold text-sm hover:opacity-90"><Shield size={14} className="inline mr-1"/>Alterar Senha</button>
    </div>
  );
}

// Default exports para roteamento
export default Kanban;
