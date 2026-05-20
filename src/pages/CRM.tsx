import { useState, useEffect } from "react";
import { C, fmt, fmtN } from "../constants.js";
import { Users, Plus, Search, Download, Upload, Edit, Trash2, Eye, X, RefreshCw, CheckCircle, AlertTriangle, MessageSquare, Save, FileSpreadsheet, ExternalLink, Zap as ZapIcon } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useDebounce } from "../hooks/useDebounce.js";
import { Modal } from "../components/ui/Modal.jsx";
import { SkeletonTable } from "../components/ui/Skeleton.jsx";

const SB=({s})=>{ const m={em_dia:[C.green,"Em Dia"],atrasado:[C.red,"Atrasado"],vencendo:[C.amber,"Vencendo"],a_vencer:[C.cyan,"A Vencer"],ativo:[C.green,"Ativo"],inativo:[C.muted,"Inativo"]}; const [color,label]=m[s]||[C.muted,s]; return <span style={{color,background:`${color}18`,border:`1px solid ${color}30`}} className="text-[10px] font-bold px-2 py-0.5 rounded-md inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-current"/>{label}</span>; };
const WA=({tel,nome,msg=""})=>{ const n=tel?.replace(/\D/g,""); if(!n) return null; return <a href={`https://wa.me/55${n}?text=${encodeURIComponent(msg||`Olá ${nome?.split(" ")[0]}!`)}`} target="_blank" rel="noopener noreferrer" style={{background:"rgba(37,211,102,0.12)",border:"1px solid rgba(37,211,102,0.25)",color:"#25d366"}} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold hover:bg-green-500/20 transition-colors whitespace-nowrap"><MessageSquare size={10}/>WA</a>; };

export default function CRM({ toast, api, reload }) {
  const [list,   setList]   = useState<any[]>([]);
  const [loading,setLoading]= useState(true);
  const [search, setSearch] = useState("");
  const searchDeb = useDebounce(search);
  const [fSt,    setFSt]    = useState("todos");
  const [fSit,   setFSit]   = useState("todos");
  const [selected,setSelected]=useState<any[]>([]);
  const [editM,  setEditM]  = useState<any>(null);
  const [detM,   setDetM]   = useState<any>(null);
  const [pagM,   setPagM]   = useState<any>(null);
  const [impM,   setImpM]   = useState(false);
  const [tab,    setTab]    = useState("geral");

  const load=async()=>{ setLoading(true); const p=new URLSearchParams(); if(fSt!=="todos") p.set("status",fSt); if(fSit!=="todos") p.set("situacao",fSit); if(searchDeb) p.set("search",searchDeb); setList(await api(`/api/clientes?${p}`).then(r=>r.json())); setLoading(false); };
  useEffect(()=>{ load(); },[fSt,fSit,searchDeb]);

  const del=async id=>{ if(!confirm("Excluir?")) return; await api(`/api/clientes/${id}`,{method:"DELETE"}); toast("Excluído","info"); load(); reload(); };
  const pagar=async()=>{ await api(`/api/clientes/${pagM.id}/pagar`,{method:"POST",body:JSON.stringify({})}); toast(`Pagamento de ${pagM.nome.split(" ")[0]} registrado!`,"success"); setPagM(null); load(); reload(); };

  const exportPDF=()=>{
    const doc=new jsPDF(); const ind:[number,number,number]=[99,102,241],dark:[number,number,number]=[2,4,8];
    doc.setFillColor(...dark); doc.rect(0,0,210,38,"F");
    doc.setTextColor(...ind); doc.setFontSize(18); doc.setFont("helvetica","bold"); doc.text("ACIAPA — Clientes",14,20);
    doc.setFontSize(9); doc.setTextColor(180,180,180); doc.text(`Gerado: ${new Date().toLocaleDateString("pt-BR")} — ${list.length} clientes`,14,32);
    autoTable(doc,{startY:45,head:[["Nome","Plano","Valor","Status","Situação","Cidade"]],body:list.map(c=>[c.nome,c.plano,fmt(c.valor),c.status,c._situacao||"",c.cidade||""]),theme:"grid",headStyles:{fillColor:dark,textColor:ind,fontStyle:"bold"},bodyStyles:{fontSize:8},alternateRowStyles:{fillColor:[240,245,255]}});
    const pgs=doc.getNumberOfPages(); for(let p=1;p<=pgs;p++){doc.setPage(p);doc.setFillColor(...dark);doc.rect(0,282,210,15,"F");doc.setTextColor(100,100,100);doc.setFontSize(7);doc.text(`ACIAPA CRM — Pág ${p}/${pgs}`,14,290);}
    doc.save(`clientes_${Date.now()}.pdf`); toast("PDF exportado!","success");
  };

  const SIT=[["todos","Todos",C.muted],["em_dia","Em Dia",C.green],["atrasado","Atrasados",C.red],["vencendo","Vencendo",C.amber],["a_vencer","A Vencer",C.cyan]];
  const ST=[["todos","Todos"],["ativo","Ativos"],["inativo","Inativos"]];
  const total=list.length, ativos=list.filter(c=>c.status==="ativo").length, atrasados=list.filter(c=>c._situacao==="atrasado").length, recMes=list.filter(c=>c._situacao==="em_dia").reduce((s,c)=>s+c.valor,0);
  const TABS=[["geral","Geral"],["pagamento","Pagamento"],["plano","Plano"]];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><div style={{color:C.text}} className="font-bold text-lg">CRM — Gestão de Clientes</div><div style={{color:C.muted}} className="text-xs mt-0.5">{list.length} exibidos</div></div>
        <div className="flex gap-2">
          <button onClick={exportPDF} style={{border:`1px solid ${C.border}`,color:C.muted}} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs hover:border-white/20 transition-colors"><Download size={13}/>PDF</button>
          <button onClick={()=>window.open("/api/clientes/export")} style={{border:`1px solid ${C.border}`,color:C.muted}} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs hover:border-white/20 transition-colors"><FileSpreadsheet size={13}/>Excel</button>
          <button onClick={()=>setImpM(true)} style={{border:`1px solid ${C.border}`,color:C.muted}} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs hover:border-white/20 transition-colors"><Upload size={13}/>Importar</button>
          <button onClick={()=>setEditM({})} style={{background:`linear-gradient(135deg,${C.indigo},${C.purple})`,color:"white",boxShadow:`0 0 20px ${C.indigo}30`}} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-extrabold hover:opacity-90"><Plus size={15}/>Novo Cliente</button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[[total,"Total",C.indigo],[ativos,"Ativos",C.green],[atrasados,"Inadimplentes",C.red],[recMes,"Recebido Mês",C.cyan]].map(([v,l,c])=>(
          <div key={l} style={{background:`${c}10`,border:`1px solid ${c}25`}} className="rounded-xl p-3">
            <div style={{color:c,fontFamily:"monospace"}} className="font-extrabold text-xl tabular-nums">{l==="Recebido Mês"?fmt(v):fmtN(v)}</div>
            <div style={{color:C.muted}} className="text-[11px] mt-0.5">{l}</div>
          </div>
        ))}
      </div>

      <div style={{background:C.card,border:`1px solid ${C.border}`}} className="rounded-2xl p-1 flex gap-1">
        {TABS.map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)}
            style={{background:tab===k?C.indigoDim:"transparent",color:tab===k?C.indigo:C.muted,border:`1px solid ${tab===k?C.indigoBorder:"transparent"}`}}
            className="flex-1 py-2 rounded-xl text-xs font-bold transition-all">{l}</button>
        ))}
      </div>

      {tab==="geral"&&<>
      <div style={{background:C.card,border:`1px solid ${C.border}`}} className="rounded-2xl p-4 flex gap-3 flex-wrap items-center">
        <div className="flex-1 min-w-48 flex items-center gap-2" style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"0 12px"}}>
          <Search size={14} style={{color:C.muted}}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar nome, email, telefone..." style={{background:"transparent",color:C.text,flex:1,padding:"10px 0",border:"none",outline:"none",fontSize:13}} className="placeholder-slate-600"/>
          {search&&<button onClick={()=>setSearch("")}><X size={13} style={{color:C.muted}}/></button>}
        </div>
        <div className="flex gap-1">{ST.map(([k,l])=><button key={k} onClick={()=>setFSt(k)} style={{background:fSt===k?C.indigoDim:"transparent",color:fSt===k?C.indigo:C.muted,border:`1px solid ${fSt===k?C.indigoBorder:C.border}`}} className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all">{l}</button>)}</div>
        <div className="flex gap-1 flex-wrap">{SIT.map(([k,l,c])=><button key={k} onClick={()=>setFSit(k)} style={{background:fSit===k?`${c}15`:"transparent",color:fSit===k?c:C.muted,border:`1px solid ${fSit===k?`${c}35`:C.border}`}} className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all">{l}</button>)}</div>
      </div>

      {selected.length>0&&<div style={{background:C.indigoDim,border:`1px solid ${C.indigoBorder}`}} className="flex items-center gap-3 rounded-xl px-4 py-2.5"><span style={{color:C.indigo}} className="text-xs font-bold">{selected.length} selecionados</span><button onClick={()=>setSelected([])} style={{color:C.muted,marginLeft:"auto"}} className="text-xs hover:underline">Limpar</button></div>}

      <div style={{background:C.card,border:`1px solid ${C.border}`}} className="rounded-2xl overflow-hidden">
        {loading?<SkeletonTable rows={6} cols={7}/>:(
          <table className="w-full">
            <thead><tr style={{background:C.card2,borderBottom:`1px solid ${C.border}`}}>{["","Cliente","Contato","Plano","Score","Status","Pagamento","Ações"].map(h=><th key={h} style={{color:C.muted,padding:"10px 14px",textAlign:"left",fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.08em"}}>{h}</th>)}</tr></thead>
            <tbody>
              {list.map((c,i)=>(
                <tr key={c.id} style={{borderBottom:i<list.length-1?`1px solid ${C.border}`:"none",background:selected.includes(c.id)?C.indigoDim:"transparent"}} className="hover:bg-white/[0.015] transition-colors">
                  <td style={{padding:"10px 14px"}}><input type="checkbox" checked={selected.includes(c.id)} onChange={()=>setSelected(s=>s.includes(c.id)?s.filter(x=>x!==c.id):[...s,c.id])} className="accent-indigo-500 w-3.5 h-3.5 cursor-pointer"/></td>
                  <td style={{padding:"10px 14px"}}>
                    <div className="flex items-center gap-2.5">
                      <div style={{background:C.indigoDim,color:C.indigo,border:`1px solid ${C.indigoBorder}`}} className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-extrabold flex-shrink-0">{c.nome.split(" ").map(w=>w[0]).join("").slice(0,2)}</div>
                      <div><div style={{color:C.text}} className="text-sm font-semibold">{c.nome}</div><div style={{color:C.muted}} className="text-[10px]">{c.email}</div></div>
                    </div>
                  </td>
                  <td style={{padding:"10px 14px"}}><div className="flex items-center gap-1.5"><span style={{color:C.sub,fontFamily:"monospace"}} className="text-xs">{c.telefone||"—"}</span>{c.telefone&&<WA tel={c.telefone} nome={c.nome}/>}</div></td>
                  <td style={{padding:"10px 14px"}}><div style={{color:C.text}} className="text-xs font-semibold">{c.plano}</div><div style={{color:C.indigo,fontFamily:"monospace"}} className="text-[11px] font-bold">{fmt(c.valor)}</div></td>
                  <td style={{padding:"10px 14px"}}>
                    <div className="flex items-center gap-1">
                      <div style={{width:28,height:4,background:"rgba(255,255,255,0.1)",borderRadius:2,overflow:"hidden"}}><div style={{width:`${c.score||0}%`,background:c.score>=80?C.green:c.score>=50?C.amber:C.red,height:"100%",borderRadius:2}}/></div>
                      <span style={{color:c.score>=80?C.green:c.score>=50?C.amber:C.red,fontFamily:"monospace"}} className="text-[10px] font-bold">{c.score||0}</span>
                    </div>
                  </td>
                  <td style={{padding:"10px 14px"}}><SB s={c.status}/></td>
                  <td style={{padding:"10px 14px"}}>
                    {c.status==="ativo"?(c._situacao==="em_dia"?<SB s="em_dia"/>:<button onClick={()=>setPagM(c)} style={{background:C.redDim,color:C.red,border:"1px solid rgba(244,63,94,0.3)"}} className="text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 hover:bg-red-500/20"><AlertTriangle size={9}/><SB s={c._situacao||"a_vencer"}/></button>):<span style={{color:C.muted}} className="text-xs">—</span>}
                  </td>
                  <td style={{padding:"10px 14px"}}>
                    <div className="flex items-center gap-1">
                      <button onClick={()=>setDetM(c)} style={{color:C.muted,border:`1px solid ${C.border}`}} className="w-7 h-7 rounded-lg flex items-center justify-center hover:text-white hover:border-white/20 transition-colors"><Eye size={12}/></button>
                      <button onClick={()=>setEditM(c)} style={{color:C.muted,border:`1px solid ${C.border}`}} className="w-7 h-7 rounded-lg flex items-center justify-center hover:text-white hover:border-white/20 transition-colors"><Edit size={12}/></button>
                      <button onClick={()=>del(c.id)} style={{color:C.red,background:C.redDim}} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-500/20 transition-colors"><Trash2 size={12}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading&&list.length===0&&<div className="py-16 text-center"><Users size={36} style={{color:C.muted}} className="mx-auto mb-3 opacity-30"/><p style={{color:C.muted}} className="text-sm">Nenhum cliente encontrado</p></div>}
      </div>

      <Modal open={!!pagM} onClose={()=>setPagM(null)} title="Registrar Pagamento">
        {pagM&&<div className="space-y-4"><div style={{background:C.indigoDim,border:`1px solid ${C.indigoBorder}`}} className="rounded-xl p-4"><div style={{color:C.indigo}} className="font-bold">{pagM.nome}</div><div style={{color:C.muted}} className="text-sm mt-1">{pagM.plano} · {fmt(pagM.valor)}/mês</div></div><p style={{color:C.sub}} className="text-sm">Confirmar pagamento de <strong style={{color:C.green}}>{fmt(pagM.valor)}</strong>?</p><div className="flex gap-3"><button onClick={()=>setPagM(null)} style={{border:`1px solid ${C.border}`,color:C.muted}} className="flex-1 py-2.5 rounded-xl text-sm hover:border-white/20">Cancelar</button><button onClick={pagar} style={{background:`linear-gradient(135deg,${C.green},#16a34a)`,color:"white"}} className="flex-1 py-2.5 rounded-xl text-sm font-extrabold hover:opacity-90"><CheckCircle size={14} className="inline mr-1"/>Confirmar</button></div></div>}
      </Modal>

      <Modal open={!!detM} onClose={()=>setDetM(null)} title="Ficha do Cliente" wide>
        {detM&&<FichaCliente cliente={detM} api={api}/>}
      </Modal>

      <Modal open={editM!==null} onClose={()=>{setEditM(null);load();reload();}} title={editM?.id?"Editar Cliente":"Novo Cliente"} wide>
        {editM!==null&&<FormCliente initial={editM} api={api} onSaved={()=>{setEditM(null);load();reload();toast(editM?.id?"Atualizado!":"Cadastrado!","success");}}/>}
      </Modal>

      <Modal open={impM} onClose={()=>setImpM(false)} title="Importar via Excel">
        <div className="space-y-4">
          <div style={{background:C.indigoDim,border:`1px solid ${C.indigoBorder}`}} className="rounded-xl p-4"><div style={{color:C.indigo}} className="font-bold text-sm mb-2">Colunas esperadas:</div><div className="flex flex-wrap gap-1.5">{["nome","email","telefone","plano","valor","status","dataVencimento","cidade"].map(c=><span key={c} style={{background:"rgba(99,102,241,0.1)",color:C.sub}} className="text-[11px] px-2 py-0.5 rounded font-mono">{c}</span>)}</div></div>
          <label style={{background:C.indigoDim,border:`2px dashed ${C.indigoBorder}`,cursor:"pointer"}} className="flex flex-col items-center justify-center gap-3 py-10 rounded-2xl hover:bg-indigo-500/10 transition-colors">
            <Upload size={28} style={{color:C.indigo}}/><span style={{color:C.indigo}} className="font-bold text-sm">Clique para selecionar .xlsx ou .csv</span>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={async e=>{ const f=e.target.files?.[0]; if(!f) return; const fd=new FormData(); fd.append("file",f); const r=await fetch("/api/clientes/import",{method:"POST",headers:{Authorization:`Bearer ${localStorage.getItem("aciapa_token")}`},body:fd}); const d=await r.json(); if(d.ok){toast(`${d.importados} clientes importados!`,"success");setImpM(false);load();reload();}else toast(d.error||"Erro","error"); e.target.value=""; }}/>
          </label>
        </div>
      </Modal>
      </>}

      {tab==="pagamento"&&(
        <div style={{background:C.card,border:`1px solid ${C.border}`}} className="rounded-2xl p-8 text-center">
          <div style={{color:C.muted}} className="text-sm">Gestão de pagamentos dos clientes</div>
        </div>
      )}

      {tab==="plano"&&(
        <div style={{background:C.card,border:`1px solid ${C.border}`}} className="rounded-2xl p-8 text-center">
          <div style={{color:C.muted}} className="text-sm">Planos disponíveis para clientes</div>
        </div>
      )}
    </div>
  );
}

function FichaCliente({ cliente:c, api }) {
  const [full,setFull]=useState<any>(null);
  const [mpLink,setMpLink]=useState<any>(null);
  useEffect(()=>{ api(`/api/clientes/${c.id}`).then(r=>r.json()).then(setFull); },[c.id]);
  if(!full) return <div className="flex justify-center py-8"><RefreshCw size={20} style={{color:C.indigo}} className="animate-spin"/></div>;
  const totalPago=full.pagamentos?.filter(p=>p.pago).reduce((s,p)=>s+(p.valor||0),0)||0;
  const ano=new Date().getFullYear();
  const gerarCobranca=async()=>{
    try {
      const r=await api("/api/mercado-pago/admin-gerar-cobranca",{method:"POST",body:JSON.stringify({clienteId:full.id,mes:new Date().getMonth()+1,ano,valor:full.valor,metodo:"pix"})});
      const j=await r.json();
      if(!r.ok) return alert(j.error||"Erro");
      if(j.pagamento?.linkPagamento) setMpLink(j.pagamento.linkPagamento);
      else if(j.pagamento?.qrCodeBase64) setMpLink(`data:image/png;base64,${j.pagamento.qrCodeBase64}`);
      else alert("Cobrança gerada! O cliente pode pagar pelo portal.");
    } catch(e){ alert("Erro ao gerar cobrança"); }
  };
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-4">
        <div style={{background:C.indigoDim,color:C.indigo,border:`1px solid ${C.indigoBorder}`}} className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-extrabold flex-shrink-0">{full.nome.split(" ").map(w=>w[0]).join("").slice(0,2)}</div>
        <div className="flex-1"><div style={{color:C.text}} className="font-bold text-xl">{full.nome}</div><div style={{color:C.muted}} className="text-sm mt-0.5">{full.plano} · {fmt(full.valor)}/mês</div><div className="flex items-center gap-2 mt-2"><span style={{color:full.status==="ativo"?C.green:C.muted,background:`${full.status==="ativo"?C.green:C.muted}18`,border:`1px solid ${full.status==="ativo"?C.green:C.muted}30`}} className="text-[10px] font-bold px-2 py-0.5 rounded-md">{full.status}</span></div></div>
        {full.telefone&&<WA tel={full.telefone} nome={full.nome}/>}
      </div>
      <div className="grid grid-cols-3 gap-3">{[[fmt(totalPago),"Total Pago",C.indigo],[full.pagamentos?.filter(p=>p.pago).length||0,"Meses Pagos",C.green],[full._diasAtraso||0,"Dias Atraso",full._diasAtraso>0?C.red:C.green]].map(([v,l,c_])=><div key={l} style={{background:C.card2,border:`1px solid ${C.border}`}} className="rounded-xl p-3 text-center"><div style={{color:c_,fontFamily:"monospace"}} className="font-extrabold text-lg">{typeof v==="number"?`${v}${l.includes("Dias")?"d":""}`:v}</div><div style={{color:C.muted}} className="text-[10px]">{l}</div></div>)}</div>
      <div>
        <div style={{color:C.sub}} className="text-xs font-bold uppercase tracking-wider mb-2">Histórico {ano}</div>
        <div className="grid grid-cols-6 gap-1.5">
          {Array.from({length:12},(_,i)=>i+1).map(m=>{ const p=full.pagamentos?.find(x=>x.mes===m&&x.ano===ano); const passou=m<=new Date().getMonth()+1; return <div key={m} style={{background:p?.pago?C.greenDim:passou?C.redDim:"rgba(255,255,255,0.03)",border:`1px solid ${p?.pago?"rgba(34,197,94,0.25)":passou?"rgba(244,63,94,0.2)":C.border}`,color:p?.pago?C.green:passou?C.red:C.muted}} className="rounded-lg p-2 text-center"><div className="text-[9px] font-bold">{["","Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][m]}</div><div className="text-[10px] font-extrabold mt-0.5">{p?.pago?"✓":passou?"✗":"—"}</div></div>; })}
        </div>
      </div>
      {/* Cobrança Mercado Pago */}
      <button onClick={gerarCobranca} style={{background:`linear-gradient(135deg,${C.indigo},#009ee3)`,color:"white"}} className="w-full py-3 rounded-xl text-sm font-extrabold flex items-center justify-center gap-2 hover:opacity-90">
        <ZapIcon size={15}/> Gerar Cobrança Mercado Pago
      </button>
      {mpLink&&(
        <a href={mpLink} target="_blank" rel="noopener noreferrer" style={{background:"rgba(99,102,241,0.12)",color:C.indigo,border:`1px solid ${C.indigoBorder}`}} className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold hover:bg-indigo-500/20 transition-colors">
          <ExternalLink size={15}/> Link de Pagamento
        </a>
      )}
      {full.obs&&<div style={{background:C.surface,border:`1px solid ${C.border}`}} className="rounded-xl p-3"><div style={{color:C.muted}} className="text-[10px] font-bold mb-1">OBSERVAÇÕES</div><div style={{color:C.sub}} className="text-xs">{full.obs}</div></div>}
    </div>
  );
}

function FormCliente({ initial, api, onSaved }) {
  const blank={nome:"",email:"",telefone:"",cpfCnpj:"",plano:"Basic",valor:0,status:"ativo",dataVencimento:new Date().toISOString().split("T")[0],cidade:"",segmento:"",obs:"",portalAtivo:false,portalSenha:""};
  const [form,setForm]=useState({...blank,...initial}); const [loading,setLoading]=useState(false);
  const submit=async()=>{
    if(!form.nome.trim()) return alert("Nome obrigatório");
    setLoading(true);
    const body={...form};
    if(body.portalSenha&&body.portalSenha.length<6) return alert("Senha do portal deve ter no mínimo 6 caracteres");
    if(!body.portalSenha) delete body.portalSenha;
    if(form.id) await api(`/api/clientes/${form.id}`,{method:"PUT",body:JSON.stringify(body)});
    else await api("/api/clientes",{method:"POST",body:JSON.stringify(body)});
    setLoading(false); onSaved?.();
  };
  const F=(l,k,type="text",ph="")=><div><label style={{color:C.sub}} className="text-xs font-bold mb-1.5 block uppercase tracking-wider">{l}</label><input type={type} value={form[k]||""} onChange={e=>setForm({...form,[k]:type==="number"?+e.target.value:e.target.value})} placeholder={ph} style={{background:C.surface,border:`1px solid ${C.border}`,color:type==="number"?C.indigo:C.text,width:"100%",borderRadius:12,padding:"10px 14px",fontSize:type==="number"?14:13,outline:"none",fontWeight:type==="number"?"bold":"normal",fontFamily:type==="number"?"monospace":"inherit"}} onFocus={e=>e.target.style.borderColor=C.indigoBorder} onBlur={e=>e.target.style.borderColor=C.border}/></div>;
  return (
    <div style={{background:C.card2,border:`1px solid ${C.border}`}} className="rounded-2xl p-5 space-y-4">
      <div className="grid grid-cols-2 gap-4">{F("Nome *","nome","text","Nome completo")}{F("E-mail","email","email","email@empresa.com")}<div><label style={{color:C.sub}} className="text-xs font-bold mb-1.5 block uppercase tracking-wider">Telefone / WhatsApp</label><div className="flex gap-2"><input value={form.telefone||""} onChange={e=>setForm({...form,telefone:e.target.value})} placeholder="11999999999" style={{background:C.surface,border:`1px solid ${C.border}`,color:C.text,flex:1,borderRadius:12,padding:"10px 14px",fontSize:13,outline:"none"}} onFocus={e=>e.target.style.borderColor=C.indigoBorder} onBlur={e=>e.target.style.borderColor=C.border}/>{form.telefone&&<WA tel={form.telefone} nome={form.nome||"Cliente"}/>}</div></div>{F("CPF/CNPJ","cpfCnpj")}</div>
      <div className="grid grid-cols-3 gap-4">
        <div><label style={{color:C.sub}} className="text-xs font-bold mb-1.5 block uppercase tracking-wider">Plano</label><input value={form.plano||""} onChange={e=>setForm({...form,plano:e.target.value})} list="pls" style={{background:C.surface,border:`1px solid ${C.border}`,color:C.text,width:"100%",borderRadius:12,padding:"10px 14px",fontSize:13,outline:"none"}} onFocus={e=>e.target.style.borderColor=C.indigoBorder} onBlur={e=>e.target.style.borderColor=C.border}/><datalist id="pls">{["Basic","Standard","Pro","Premium"].map(p=><option key={p} value={p}/>)}</datalist></div>
        {F("Valor (R$)","valor","number")}
        <div><label style={{color:C.sub}} className="text-xs font-bold mb-1.5 block uppercase tracking-wider">Status</label><select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} style={{background:C.surface,border:`1px solid ${C.border}`,color:C.text,width:"100%",borderRadius:12,padding:"10px 14px",fontSize:13,outline:"none"}}><option value="ativo">Ativo</option><option value="inativo">Inativo</option></select></div>
        {F("Vencimento","dataVencimento","date")}{F("Cidade","cidade","text","São Paulo")}{F("Segmento","segmento","text","Tecnologia")}
      </div>
      {/* Portal do Cliente */}
      <div style={{background:form.portalAtivo?C.indigoDim:"transparent",border:`1px solid ${form.portalAtivo?C.indigoBorder:C.border}`,borderRadius:12,padding:16}} className="space-y-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={form.portalAtivo} onChange={e=>setForm({...form,portalAtivo:e.target.checked})} className="accent-indigo-500 w-4 h-4"/>
          <span style={{color:C.text}} className="text-sm font-bold">Ativar Portal do Cliente</span>
        </label>
        {form.portalAtivo&&(
          <div>
            <label style={{color:C.sub}} className="text-xs font-bold mb-1.5 block uppercase tracking-wider">Senha de acesso</label>
            <input type="text" value={form.portalSenha||""} onChange={e=>setForm({...form,portalSenha:e.target.value})} placeholder={form.id?"Deixe em branco para manter":"Mínimo 6 caracteres"} style={{background:C.surface,border:`1px solid ${C.border}`,color:C.text,width:"100%",borderRadius:12,padding:"10px 14px",fontSize:13,outline:"none"}} onFocus={e=>e.target.style.borderColor=C.indigoBorder} onBlur={e=>e.target.style.borderColor=C.border}/>
            {form.id&&<div style={{color:C.muted}} className="text-[10px] mt-1">Deixe em branco para manter a senha atual</div>}
          </div>
        )}
      </div>
      {F("Observações","obs")}
      <button onClick={submit} disabled={loading} style={{background:`linear-gradient(135deg,${C.indigo},${C.purple})`,color:"white",boxShadow:`0 0 20px ${C.indigo}20`,opacity:loading?0.7:1}} className="w-full py-3 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 hover:opacity-90">
        {loading?<RefreshCw size={15} className="animate-spin"/>:<Save size={15}/>}{loading?"Salvando...":(form.id?"Salvar Alterações":"Cadastrar Cliente")}
      </button>
    </div>
  );
}
