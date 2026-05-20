import { useState, useEffect } from "react";
import { C, fmt, fmtN } from "../constants.js";
import { Users, Plus, Search, Download, Upload, Edit, Trash2, Eye, X, RefreshCw, CheckCircle, AlertTriangle, MessageSquare, Save, FileSpreadsheet } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useDebounce } from "../hooks/useDebounce.js";
import { Modal } from "../components/ui/Modal.jsx";
import { SkeletonTable } from "../components/ui/Skeleton.jsx";

const SB=({s})=>{ const m={em_dia:[C.green,"Em Dia"],atrasado:[C.red,"Atrasado"],vencendo:[C.amber,"Vencendo"],a_vencer:[C.cyan,"A Vencer"],ativo:[C.green,"Ativo"],inativo:[C.muted,"Inativo"]}; const [color,label]=m[s]||[C.muted,s]; return <span style={{color,background:`${color}18`,border:`1px solid ${color}30`}} className="text-[10px] font-bold px-2 py-0.5 rounded-md inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-current"/>{label}</span>; };
const WA=({tel,nome,msg=""})=>{ const n=tel?.replace(/\D/g,""); if(!n) return null; return <a href={`https://wa.me/55${n}?text=${encodeURIComponent(msg||`Olá ${nome?.split(" ")[0]}!`)}`} target="_blank" rel="noopener noreferrer" style={{background:"rgba(37,211,102,0.12)",border:"1px solid rgba(37,211,102,0.25)",color:"#25d366"}} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold hover:bg-green-500/20 transition-colors whitespace-nowrap"><MessageSquare size={10}/>WA</a>; };

export default function Associados({ toast, api, reload }) {
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

  const load=async()=>{ setLoading(true); const p=new URLSearchParams(); if(fSt!=="todos") p.set("status",fSt); if(fSit!=="todos") p.set("situacao",fSit); if(searchDeb) p.set("search",searchDeb); setList(await api(`/api/associados?${p}`).then(r=>r.json())); setLoading(false); };
  useEffect(()=>{ load(); },[fSt,fSit,searchDeb]);

  const del=async id=>{ if(!confirm("Excluir?")) return; await api(`/api/associados/${id}`,{method:"DELETE"}); toast("Excluído","info"); load(); reload(); };
  const pagar=async()=>{ await api(`/api/associados/${pagM.id}/pagar`,{method:"POST",body:JSON.stringify({})}); toast(`Pagamento de ${pagM.nome.split(" ")[0]} registrado!`,"success"); setPagM(null); load(); reload(); };

  const exportPDF=()=>{
    const doc=new jsPDF(); const ind:[number,number,number]=[99,102,241],dark:[number,number,number]=[2,4,8];
    doc.setFillColor(...dark); doc.rect(0,0,210,38,"F");
    doc.setTextColor(...ind); doc.setFontSize(18); doc.setFont("helvetica","bold"); doc.text("ACIAPA — Associados",14,20);
    doc.setFontSize(9); doc.setTextColor(180,180,180); doc.text(`Gerado: ${new Date().toLocaleDateString("pt-BR")} — ${list.length} associados`,14,32);
    autoTable(doc,{startY:45,head:[["Nome","CPF","Status","Telefone","Cidade"]],body:list.map(a=>[a.nome,a.cpf||"—",a.status,a.telefone||"—",a.cidade||""]),theme:"grid",headStyles:{fillColor:dark,textColor:ind,fontStyle:"bold"},bodyStyles:{fontSize:8},alternateRowStyles:{fillColor:[240,245,255]}});
    const pgs=doc.getNumberOfPages(); for(let p=1;p<=pgs;p++){doc.setPage(p);doc.setFillColor(...dark);doc.rect(0,282,210,15,"F");doc.setTextColor(100,100,100);doc.setFontSize(7);doc.text(`ACIAPA Associados — Pág ${p}/${pgs}`,14,290);}
    doc.save(`associados_${Date.now()}.pdf`); toast("PDF exportado!","success");
  };

  const ST=[["todos","Todos"],["ativo","Ativos"],["inativo","Inativos"]];
  const SIT=[["todos","Todos",C.muted],["em_dia","Em Dia",C.green],["atrasado","Atrasados",C.red],["vencendo","Vencendo",C.amber],["a_vencer","A Vencer",C.cyan]];
  const total=list.length, ativos=list.filter(a=>a.status==="ativo").length, inativos=list.filter(a=>a.status==="inativo").length;
  const TABS=[["geral","Geral"],["pagamento","Pagamento"],["plano","Plano"]];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><div style={{color:C.text}} className="font-bold text-lg">Associados</div><div style={{color:C.muted}} className="text-xs mt-0.5">{list.length} exibidos</div></div>
        <div className="flex gap-2">
          <button onClick={exportPDF} style={{border:`1px solid ${C.border}`,color:C.muted}} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs hover:border-white/20 transition-colors"><Download size={13}/>PDF</button>
          <button onClick={()=>window.open("/api/associados/export")} style={{border:`1px solid ${C.border}`,color:C.muted}} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs hover:border-white/20 transition-colors"><FileSpreadsheet size={13}/>Excel</button>
          <button onClick={()=>setImpM(true)} style={{border:`1px solid ${C.border}`,color:C.muted}} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs hover:border-white/20 transition-colors"><Upload size={13}/>Importar</button>
          <button onClick={()=>setEditM({})} style={{background:`linear-gradient(135deg,${C.indigo},${C.purple})`,color:"white",boxShadow:`0 0 20px ${C.indigo}30`}} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-extrabold hover:opacity-90"><Plus size={15}/>Novo Associado</button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[[total,"Total",C.indigo],[ativos,"Ativos",C.green],[list.filter(a=>a._situacao==="atrasado").length,"Inadimplentes",C.red],[list.filter(a=>a._situacao==="em_dia").reduce((s,a)=>s+(a.valor||0),0),"Recebido Mês",C.cyan]].map(([v,l,c])=>(
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
        {loading?<SkeletonTable rows={6} cols={8}/>:(
          <table className="w-full">
            <thead><tr style={{background:C.card2,borderBottom:`1px solid ${C.border}`}}>{["","Cliente","Contato","Plano","Score","Status","Pagamento","Ações"].map(h=><th key={h} style={{color:C.muted,padding:"10px 14px",textAlign:"left",fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.08em"}}>{h}</th>)}</tr></thead>
            <tbody>
              {list.map((a,i)=>(
                <tr key={a.id} style={{borderBottom:i<list.length-1?`1px solid ${C.border}`:"none",background:selected.includes(a.id)?C.indigoDim:"transparent"}} className="hover:bg-white/[0.015] transition-colors">
                  <td style={{padding:"10px 14px"}}><input type="checkbox" checked={selected.includes(a.id)} onChange={()=>setSelected(s=>s.includes(a.id)?s.filter(x=>x!==a.id):[...s,a.id])} className="accent-indigo-500 w-3.5 h-3.5 cursor-pointer"/></td>
                  <td style={{padding:"10px 14px"}}>
                    <div className="flex items-center gap-2.5">
                      <div style={{background:C.indigoDim,color:C.indigo,border:`1px solid ${C.indigoBorder}`}} className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-extrabold flex-shrink-0">{a.nome?.split(" ").map(w=>w[0]).join("").slice(0,2)}</div>
                      <div><div style={{color:C.text}} className="text-sm font-semibold">{a.nome}</div><div style={{color:C.muted}} className="text-[10px]">{a.email}</div></div>
                    </div>
                  </td>
                  <td style={{padding:"10px 14px"}}><div className="flex items-center gap-1.5"><span style={{color:C.sub,fontFamily:"monospace"}} className="text-xs">{a.telefone||"—"}</span>{a.telefone&&<WA tel={a.telefone} nome={a.nome}/>}</div></td>
                  <td style={{padding:"10px 14px"}}><div style={{color:C.text}} className="text-xs font-semibold">{a.plano||"—"}</div><div style={{color:C.indigo,fontFamily:"monospace"}} className="text-[11px] font-bold">{fmt(a.valor||0)}</div></td>
                  <td style={{padding:"10px 14px"}}>
                    <div className="flex items-center gap-1">
                      <div style={{width:28,height:4,background:"rgba(255,255,255,0.1)",borderRadius:2,overflow:"hidden"}}><div style={{width:`${a.score||0}%`,background:a.score>=80?C.green:a.score>=50?C.amber:C.red,height:"100%",borderRadius:2}}/></div>
                      <span style={{color:a.score>=80?C.green:a.score>=50?C.amber:C.red,fontFamily:"monospace"}} className="text-[10px] font-bold">{a.score||0}</span>
                    </div>
                  </td>
                  <td style={{padding:"10px 14px"}}><SB s={a.status}/></td>
                  <td style={{padding:"10px 14px"}}>
                    {a.status==="ativo"?(a._situacao==="em_dia"?<SB s="em_dia"/>:<button onClick={()=>setPagM(a)} style={{background:C.redDim,color:C.red,border:"1px solid rgba(244,63,94,0.3)"}} className="text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 hover:bg-red-500/20"><AlertTriangle size={9}/><SB s={a._situacao||"a_vencer"}/></button>):<span style={{color:C.muted}} className="text-xs">—</span>}
                  </td>
                  <td style={{padding:"10px 14px"}}>
                    <div className="flex items-center gap-1">
                      <button onClick={()=>setDetM(a)} style={{color:C.muted,border:`1px solid ${C.border}`}} className="w-7 h-7 rounded-lg flex items-center justify-center hover:text-white hover:border-white/20 transition-colors"><Eye size={12}/></button>
                      <button onClick={()=>setEditM(a)} style={{color:C.muted,border:`1px solid ${C.border}`}} className="w-7 h-7 rounded-lg flex items-center justify-center hover:text-white hover:border-white/20 transition-colors"><Edit size={12}/></button>
                      <button onClick={()=>del(a.id)} style={{color:C.red,background:C.redDim}} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-500/20 transition-colors"><Trash2 size={12}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading&&list.length===0&&<div className="py-16 text-center"><Users size={36} style={{color:C.muted}} className="mx-auto mb-3 opacity-30"/><p style={{color:C.muted}} className="text-sm">Nenhum associado encontrado</p></div>}
      </div>

      <Modal open={!!detM} onClose={()=>setDetM(null)} title="Ficha do Associado" wide>
        {detM&&<FichaAssociado associado={detM}/>}
      </Modal>

      <Modal open={editM!==null} onClose={()=>{setEditM(null);load();reload();}} title={editM?.id?"Editar Associado":"Novo Associado"} wide>
        {editM!==null&&<FormAssociado initial={editM} api={api} onSaved={()=>{setEditM(null);load();reload();toast(editM?.id?"Atualizado!":"Cadastrado!","success");}}/>}
      </Modal>

      <Modal open={impM} onClose={()=>setImpM(false)} title="Importar via Excel">
        <div className="space-y-4">
          <div style={{background:C.indigoDim,border:`1px solid ${C.indigoBorder}`}} className="rounded-xl p-4"><div style={{color:C.indigo}} className="font-bold text-sm mb-2">Colunas esperadas:</div><div className="flex flex-wrap gap-1.5">{["nome","email","telefone","cpf","status","cidade"].map(c=><span key={c} style={{background:"rgba(99,102,241,0.1)",color:C.sub}} className="text-[11px] px-2 py-0.5 rounded font-mono">{c}</span>)}</div></div>
          <label style={{background:C.indigoDim,border:`2px dashed ${C.indigoBorder}`,cursor:"pointer"}} className="flex flex-col items-center justify-center gap-3 py-10 rounded-2xl hover:bg-indigo-500/10 transition-colors">
            <Upload size={28} style={{color:C.indigo}}/><span style={{color:C.indigo}} className="font-bold text-sm">Clique para selecionar .xlsx ou .csv</span>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={async e=>{ const f=e.target.files?.[0]; if(!f) return; const fd=new FormData(); fd.append("file",f); const r=await fetch("/api/associados/import",{method:"POST",headers:{Authorization:`Bearer ${localStorage.getItem("aciapa_token")}`},body:fd}); const d=await r.json(); if(d.ok){toast(`${d.importados} associados importados!`,"success");setImpM(false);load();reload();}else toast(d.error||"Erro","error"); e.target.value=""; }}/>
          </label>
        </div>
      </Modal>

      <Modal open={!!pagM} onClose={()=>setPagM(null)} title="Registrar Pagamento">
        {pagM&&<div className="space-y-4"><div style={{background:C.indigoDim,border:`1px solid ${C.indigoBorder}`}} className="rounded-xl p-4"><div style={{color:C.indigo}} className="font-bold">{pagM.nome}</div><div style={{color:C.muted}} className="text-sm mt-1">{pagM.plano||"—"} · {fmt(pagM.valor||0)}/mês</div></div><p style={{color:C.sub}} className="text-sm">Confirmar pagamento de <strong style={{color:C.green}}>{fmt(pagM.valor||0)}</strong>?</p><div className="flex gap-3"><button onClick={()=>setPagM(null)} style={{border:`1px solid ${C.border}`,color:C.muted}} className="flex-1 py-2.5 rounded-xl text-sm hover:border-white/20">Cancelar</button><button onClick={pagar} style={{background:`linear-gradient(135deg,${C.green},#16a34a)`,color:"white"}} className="flex-1 py-2.5 rounded-xl text-sm font-extrabold hover:opacity-90"><CheckCircle size={14} className="inline mr-1"/>Confirmar</button></div></div>}
      </Modal>
      </>}

      {tab==="pagamento"&&(
        <div style={{background:C.card,border:`1px solid ${C.border}`}} className="rounded-2xl p-8 text-center">
          <div style={{color:C.muted}} className="text-sm">Gestão de pagamentos dos associados</div>
        </div>
      )}

      {tab==="plano"&&(
        <div style={{background:C.card,border:`1px solid ${C.border}`}} className="rounded-2xl p-8 text-center">
          <div style={{color:C.muted}} className="text-sm">Planos disponíveis para associados</div>
        </div>
      )}
    </div>
  );
}

function FichaAssociado({ associado:a }) {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-4">
        <div style={{background:C.indigoDim,color:C.indigo,border:`1px solid ${C.indigoBorder}`}} className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-extrabold flex-shrink-0">{a.nome?.split(" ").map(w=>w[0]).join("").slice(0,2)}</div>
        <div className="flex-1"><div style={{color:C.text}} className="font-bold text-xl">{a.nome}</div><div style={{color:C.muted}} className="text-sm mt-0.5">{a.email||"—"}</div><div className="flex items-center gap-2 mt-2"><span style={{color:a.status==="ativo"?C.green:C.muted,background:`${a.status==="ativo"?C.green:C.muted}18`,border:`1px solid ${a.status==="ativo"?C.green:C.muted}30`}} className="text-[10px] font-bold px-2 py-0.5 rounded-md">{a.status}</span></div></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {[["CPF",a.cpf||"—"],["Telefone",a.telefone||"—"],["Cidade",a.cidade||"—"],["Data de Entrada",a.dataEntrada?new Date(a.dataEntrada).toLocaleDateString("pt-BR"):"—"]].map(([l,v])=>(
          <div key={l} style={{background:C.card2,border:`1px solid ${C.border}`}} className="rounded-xl p-3"><div style={{color:C.muted}} className="text-[10px] font-bold uppercase tracking-wider">{l}</div><div style={{color:C.text}} className="text-sm font-semibold mt-1">{v}</div></div>
        ))}
      </div>
      {a.observacoes&&<div style={{background:C.surface,border:`1px solid ${C.border}`}} className="rounded-xl p-3"><div style={{color:C.muted}} className="text-[10px] font-bold mb-1">OBSERVAÇÕES</div><div style={{color:C.sub}} className="text-xs">{a.observacoes}</div></div>}
    </div>
  );
}

function FormAssociado({ initial, api, onSaved }) {
  const blank={nome:"",email:"",telefone:"",cpf:"",status:"ativo",dataEntrada:new Date().toISOString().split("T")[0],cidade:"",observacoes:""};
  const [form,setForm]=useState({...blank,...initial}); const [loading,setLoading]=useState(false);
  const submit=async()=>{
    if(!form.nome.trim()) return alert("Nome obrigatório");
    setLoading(true);
    if(form.id) await api(`/api/associados/${form.id}`,{method:"PUT",body:JSON.stringify(form)});
    else await api("/api/associados",{method:"POST",body:JSON.stringify(form)});
    setLoading(false); onSaved?.();
  };
  const F=(l,k,type="text",ph="")=><div><label style={{color:C.sub}} className="text-xs font-bold mb-1.5 block uppercase tracking-wider">{l}</label><input type={type} value={form[k]||""} onChange={e=>setForm({...form,[k]:type==="number"?+e.target.value:e.target.value})} placeholder={ph} style={{background:C.surface,border:`1px solid ${C.border}`,color:C.text,width:"100%",borderRadius:12,padding:"10px 14px",fontSize:13,outline:"none"}} onFocus={e=>e.target.style.borderColor=C.indigoBorder} onBlur={e=>e.target.style.borderColor=C.border}/></div>;
  return (
    <div style={{background:C.card2,border:`1px solid ${C.border}`}} className="rounded-2xl p-5 space-y-4">
      <div className="grid grid-cols-2 gap-4">{F("Nome *","nome","text","Nome completo")}{F("E-mail","email","email","email@provedor.com")}{F("Telefone","telefone","text","11999999999")}{F("CPF","cpf","text","000.000.000-00")}</div>
      <div className="grid grid-cols-3 gap-4">
        <div><label style={{color:C.sub}} className="text-xs font-bold mb-1.5 block uppercase tracking-wider">Status</label><select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} style={{background:C.surface,border:`1px solid ${C.border}`,color:C.text,width:"100%",borderRadius:12,padding:"10px 14px",fontSize:13,outline:"none"}}><option value="ativo">Ativo</option><option value="inativo">Inativo</option></select></div>
        {F("Data de Entrada","dataEntrada","date")}{F("Cidade","cidade","text","São Paulo")}
      </div>
      {F("Observações","obs")}
      <button onClick={submit} disabled={loading} style={{background:`linear-gradient(135deg,${C.indigo},${C.purple})`,color:"white",boxShadow:`0 0 20px ${C.indigo}20`,opacity:loading?0.7:1}} className="w-full py-3 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 hover:opacity-90">
        {loading?<RefreshCw size={15} className="animate-spin"/>:<Save size={15}/>}{loading?"Salvando...":(form.id?"Salvar Alterações":"Cadastrar Associado")}
      </button>
    </div>
  );
}
