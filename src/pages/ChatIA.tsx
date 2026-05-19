import { useState, useEffect, useRef } from "react";
import { C, fmt } from "../constants.js";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Bot, Send, RefreshCw, X, Sparkles, Zap, AlertTriangle, ChevronRight, Trash2, Download, Printer } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const SUGESTOES = [
  "Quais clientes estão com pagamento atrasado?","Mostre os 5 maiores devedores","Total de inadimplência este mês",
  "Previsão de receita para os próximos 3 meses","Clientes com vencimento nos próximos 5 dias",
  "Resumo financeiro geral","Quais planos geram mais receita?","Análise do pipeline de vendas",
  "Liste os clientes inativos","Qual o percentual de adimplência?","Explique qualquer assunto em linguagem simples",
  "Crie uma minuta de peticao inicial com tom humano e profissional",
  "Redija uma carta juridica firme, cordial e sem parecer artificial",
];

export default function ChatIA({ toast, api }) {
  const [msgs,    setMsgs]    = useState<any[]>([]);
  const [input,   setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const [planilhas,setPlanilhas]=useState<any[]>([]);
  const [planAtiva,setPlanAtiva]=useState<any>(null);
  const bottomRef = useRef<any>(null);

  useEffect(()=>{
    api("/api/ia/historico").then(r=>r.json()).then((hist:any[])=>{
      const built: any[] = [];
      hist.reverse().forEach((h:any)=>{ built.push({id:h.id+"u",role:"user",text:h.pergunta,ts:h.timestamp}); built.push({id:h.id+"a",role:"assistant",resp:h.resposta,ts:h.timestamp}); });
      setMsgs(built);
    }).catch(()=>{});
    api("/api/planilhas").then(r=>r.json()).then(setPlanilhas).catch(()=>{});
  },[]);

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[msgs]);

  const enviar=async(txt?: string)=>{
    const texto=txt||input.trim(); if(!texto||loading) return;
    setInput(""); setLoading(true);
    setMsgs(m=>[...m,{id:Date.now()+"u",role:"user",text:texto,ts:new Date().toISOString()}]);
    try {
      const r=await api("/api/ia/chat",{method:"POST",body:JSON.stringify({mensagem:texto,planilhaId:planAtiva?.id})});
      const d=await r.json();
      setMsgs(m=>[...m,{id:d.id+"a",role:"assistant",resp:d,ts:d.timestamp||new Date().toISOString()}]);
    } catch(e) { toast("Erro ao consultar IA","error"); setMsgs(m=>[...m,{id:Date.now()+"err",role:"assistant",resp:{resposta:"Erro ao consultar a IA. Verifique sua conexão.",tabela:null,grafico:null},ts:new Date().toISOString()}]); }
    finally { setLoading(false); }
  };

  const clearChat=async()=>{ await api("/api/ia/chat",{method:"DELETE"}); setMsgs([]); toast("Histórico limpo","info"); };

  const exportPDF=(resp)=>{
    if(!resp?.tabela?.length) return;
    const doc=new jsPDF();
    const ind:[number,number,number]=[99,102,241], dark:[number,number,number]=[2,4,8];
    doc.setFillColor(...dark); doc.rect(0,0,210,35,"F");
    doc.setTextColor(...ind); doc.setFontSize(16); doc.setFont("helvetica","bold");
    doc.text("ACIAPA — Resultado IA",14,18);
    doc.setFontSize(9); doc.setTextColor(180,180,180);
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`,14,28);
    if(resp.resumo){ doc.setTextColor(0,0,0); doc.setFontSize(11); doc.text(resp.resumo,14,48); }
    if(resp.resposta){ doc.setFontSize(9); doc.setTextColor(80,80,80); doc.text(resp.resposta,14,60,{maxWidth:180}); }
    autoTable(doc,{ startY:80, head:[Object.keys(resp.tabela[0])], body:resp.tabela.map(r=>Object.values(r)), theme:"grid", headStyles:{fillColor:dark,textColor:ind,fontStyle:"bold"}, bodyStyles:{fontSize:9} });
    doc.save(`ia_resultado_${Date.now()}.pdf`);
    toast("PDF exportado!","success");
  };

  return (
    <div style={{height:"calc(100vh - 160px)"}} className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div style={{background:`linear-gradient(135deg,${C.indigo},${C.purple})`}} className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg"><Bot size={17} color="white"/></div>
          <div>
            <div style={{color:C.text}} className="font-bold text-base">Chat com IA</div>
            <div style={{color:C.muted}} className="text-xs">Pergunte sobre dados internos, direito, gestao ou qualquer assunto</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {planilhas.length>0&&(
            <select value={planAtiva?.id||""} onChange={e=>{ const p=planilhas.find(x=>x.id===e.target.value); setPlanAtiva(p||null); }}
              style={{background:C.card,border:`1px solid ${planAtiva?C.indigoBorder:C.border}`,color:planAtiva?C.indigo:C.muted,borderRadius:12,padding:"6px 12px",fontSize:12,outline:"none"}}>
              <option value="">Sem planilha</option>
              {planilhas.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          )}
          <button onClick={clearChat} style={{border:`1px solid ${C.border}`,color:C.muted}} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs hover:border-white/20 transition-colors"><Trash2 size={11}/>Limpar</button>
        </div>
      </div>

      {/* Messages */}
      <div style={{background:C.surface,border:`1px solid ${C.border}`,flex:1,overflowY:"auto"}} className="rounded-2xl p-4 space-y-4">
        {msgs.length===0&&(
          <div className="flex flex-col items-center justify-center h-full gap-5">
            <div style={{background:C.indigoDim,border:`1px solid ${C.indigoBorder}`}} className="w-16 h-16 rounded-2xl flex items-center justify-center"><Sparkles size={28} style={{color:C.indigo}}/></div>
            <div className="text-center">
              <div style={{color:C.text}} className="font-bold mb-1">Olá! Sou o assistente IA do ACIAPA</div>
              <div style={{color:C.muted}} className="text-sm">Pergunte sobre clientes, receitas, juridico, tecnologia, estudo ou qualquer tema</div>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full max-w-2xl">
              {SUGESTOES.map(s=>(
                <button key={s} onClick={()=>enviar(s)} style={{background:C.card,border:`1px solid ${C.border}`,color:C.sub,textAlign:"left"}} className="text-xs px-3 py-2.5 rounded-xl hover:border-indigo-500/30 hover:text-white transition-all">
                  <Zap size={9} style={{color:C.indigo,display:"inline",marginRight:6}}/>{s}
                </button>
              ))}
            </div>
          </div>
        )}

        {msgs.map(m=>(
          <div key={m.id} className={`flex ${m.role==="user"?"justify-end":"justify-start"}`}>
            {m.role==="user"?(
              <div style={{background:C.indigoDim,border:`1px solid ${C.indigoBorder}`,color:C.text,maxWidth:"70%"}} className="rounded-2xl rounded-tr-sm px-4 py-3 text-sm">{m.text}</div>
            ):(
              <div style={{background:C.card,border:`1px solid ${C.border}`,maxWidth:"92%"}} className="rounded-2xl rounded-tl-sm p-4 space-y-3">
                {m.resp?(
                  <>
                    {m.resp.alertas?.map((a,i)=>(
                      <div key={i} style={{background:C.amberDim,border:"1px solid rgba(245,158,11,0.25)",color:C.amber}} className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"><AlertTriangle size={11}/>{a}</div>
                    ))}
                    <p style={{color:C.text}} className="text-sm leading-relaxed">{m.resp.resposta}</p>
                    {m.resp.resumo&&<div style={{color:C.indigo}} className="text-xs font-bold">{m.resp.resumo}</div>}
                    {m.resp.acoes?.length>0&&(
                      <div className="space-y-1">
                        <div style={{color:C.muted}} className="text-[10px] font-bold uppercase tracking-wider">Ações sugeridas:</div>
                        {m.resp.acoes.map((a,i)=><div key={i} style={{color:C.cyan}} className="text-xs flex items-center gap-1"><ChevronRight size={10}/>{a}</div>)}
                      </div>
                    )}
                    {m.resp.tabela?.length>0&&(
                      <div className="overflow-x-auto rounded-xl" style={{border:`1px solid ${C.border}`}}>
                        <table className="w-full text-xs">
                          <thead><tr style={{background:C.card2}}>
                            {Object.keys(m.resp.tabela[0]).map(k=><th key={k} style={{color:C.muted,padding:"7px 12px",textAlign:"left",borderBottom:`1px solid ${C.border}`,fontWeight:700,fontSize:10,textTransform:"uppercase",letterSpacing:"0.06em"}}>{k}</th>)}
                          </tr></thead>
                          <tbody>
                            {m.resp.tabela.slice(0,15).map((row,i)=>(
                              <tr key={i} style={{borderBottom:i<m.resp.tabela.length-1?`1px solid ${C.border}`:"none"}} className="hover:bg-white/[0.02]">
                                {Object.values(row).map((v,j)=><td key={j} style={{color:C.sub,padding:"7px 12px"}}>{String(v)}</td>)}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {m.resp.tabela.length>15&&<div style={{color:C.muted,padding:"8px 12px",fontSize:11}}>... e mais {m.resp.tabela.length-15} linhas</div>}
                      </div>
                    )}
                    {m.resp.grafico?.dados?.length>0&&(
                      <div style={{background:C.surface,border:`1px solid ${C.border}`}} className="rounded-xl p-3">
                        <div style={{color:C.muted}} className="text-xs font-bold mb-2">{m.resp.grafico.titulo}</div>
                        <ResponsiveContainer width="100%" height={140}>
                          {m.resp.grafico.tipo==="pie"?(
                            <PieChart><Pie data={m.resp.grafico.dados} dataKey="valor" nameKey="nome" cx="50%" cy="50%" outerRadius={55}>{m.resp.grafico.dados.map((_,i)=><Cell key={i} fill={[C.indigo,C.green,C.red,C.amber,C.purple,C.cyan][i%6]}/>)}</Pie><Tooltip contentStyle={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,fontSize:11}}/></PieChart>
                          ):(
                            <BarChart data={m.resp.grafico.dados}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/><XAxis dataKey="nome" tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false}/><YAxis tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false}/><Tooltip contentStyle={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,fontSize:11}}/><Bar dataKey="valor" fill={C.indigo} radius={[3,3,0,0]}/></BarChart>
                          )}
                        </ResponsiveContainer>
                      </div>
                    )}
                    {m.resp.tabela?.length>0&&(
                      <div className="flex gap-2 pt-1">
                        <button onClick={()=>exportPDF(m.resp)} style={{background:C.redDim,border:"1px solid rgba(244,63,94,0.3)",color:C.red}} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-500/20"><Printer size={11}/>PDF</button>
                        <a href="/api/clientes/export" download style={{background:C.greenDim,border:"1px solid rgba(34,197,94,0.3)",color:C.green}} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-500/20"><Download size={11}/>Excel</a>
                      </div>
                    )}
                  </>
                ):(<div className="flex items-center gap-2"><RefreshCw size={14} style={{color:C.indigo}} className="animate-spin"/><span style={{color:C.muted}} className="text-sm">Analisando...</span></div>)}
              </div>
            )}
          </div>
        ))}

        {loading&&(
          <div className="flex justify-start">
            <div style={{background:C.card,border:`1px solid ${C.border}`}} className="rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
              <div className="flex gap-1">{[0,1,2].map(i=><span key={i} className="typing-dot" style={{animationDelay:`${i*0.2}s`}}/>)}</div>
              <span style={{color:C.muted}} className="text-sm ml-1">Analisando seus dados...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Input */}
      <div style={{background:C.card,border:`1px solid ${C.border}`}} className="rounded-2xl p-4 flex-shrink-0">
        <div className="flex gap-3">
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&enviar()}
            placeholder="Pergunte qualquer assunto... ex: clientes inadimplentes, peticao, contrato, estudo, tecnologia"
            style={{background:C.surface,border:`1px solid ${C.border}`,color:C.text,flex:1,borderRadius:12,padding:"12px 16px",fontSize:14,outline:"none"}}
            onFocus={e=>e.target.style.borderColor=C.indigoBorder} onBlur={e=>e.target.style.borderColor=C.border}
          />
          <button onClick={()=>enviar()} disabled={!input.trim()||loading}
            style={{background:input.trim()&&!loading?`linear-gradient(135deg,${C.indigo},${C.purple})`:"rgba(255,255,255,0.05)",color:input.trim()&&!loading?"white":C.muted,boxShadow:input.trim()&&!loading?`0 0 20px ${C.indigo}30`:"none"}}
            className="w-12 h-12 rounded-xl flex items-center justify-center transition-all flex-shrink-0">
            <Send size={17}/>
          </button>
        </div>
        <div className="flex gap-2 mt-2.5 flex-wrap">
          {SUGESTOES.slice(0,5).map(s=>(
            <button key={s} onClick={()=>enviar(s)} style={{color:C.muted,border:`1px solid ${C.border}`}} className="text-[10px] px-2 py-1 rounded-lg hover:border-indigo-500/30 hover:text-indigo-400 transition-colors truncate max-w-[160px]">{s}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
