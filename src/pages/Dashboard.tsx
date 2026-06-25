import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { C, fmt, fmtN } from "../constants.js";
import { AreaChart, Area, BarChart, Bar, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Users, DollarSign, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Clock, Wallet, Target, Activity, Zap, MessageSquare, RefreshCw, Sparkles, ChevronRight, Gift } from "lucide-react";

export default function Dashboard({ stats, reload, toast, api }) {
  const navigate = useNavigate();
  const [mensal,  setMensal]  = useState<any[]>([]);
  const [forecast,setForecast]= useState<any>(null);
  const [ano,     setAno]     = useState(new Date().getFullYear());
  const [insight, setInsight] = useState<any>(null);
  const [loadIA,  setLoadIA]  = useState(false);

  useEffect(()=>{
    api(`/api/analytics/mensal?ano=${ano}`).then(r=>r.json()).then(setMensal).catch(()=>{});
    api("/api/analytics/forecast").then(r=>r.json()).then(setForecast).catch(()=>{});
  },[ano]);

  const gerarInsight=async()=>{
    setLoadIA(true);
    try { const r=await api("/api/ia/chat",{method:"POST",body:JSON.stringify({mensagem:"Analise os dados atuais e me dê os 3 principais insights e ações prioritárias."})}); const d=await r.json(); setInsight(d); }
    catch(e){ toast("Erro ao gerar insight","error"); } finally { setLoadIA(false); }
  };

  if (!stats) return <div className="flex items-center justify-center h-64"><RefreshCw size={24} style={{color:C.indigo}} className="animate-spin"/></div>;

  const KPIS=[
    {label:"Total Clientes",    val:fmtN(stats.totalClientes), icon:Users,        grad:"from-blue-700 to-blue-900",   glow:"#3b82f6", delta:`${stats.ativos} ativos`},
    {label:"Em Dia",            val:fmtN(stats.emDia),         icon:CheckCircle,  grad:"from-emerald-700 to-teal-900",glow:C.green,  delta:`${stats.percentualAdimplencia}%`},
    {label:"Inadimplentes",     val:fmtN(stats.atrasados),     icon:AlertTriangle,grad:"from-rose-700 to-red-900",   glow:C.red,    delta:fmt(stats.inadimplencia)},
    {label:"Receita Potencial", val:fmt(stats.receitaPotencial),icon:Target,      grad:"from-indigo-700 to-violet-900",glow:C.indigo,delta:"/mês"},
    {label:"Receita do Mês",    val:fmt(stats.receitaMes),     icon:TrendingUp,   grad:"from-emerald-700 to-green-900",glow:C.green, delta:null},
    {label:"Despesas do Mês",   val:fmt(stats.despesasMes),    icon:TrendingDown, grad:"from-rose-700 to-red-900",    glow:C.red,   delta:null},
    {label:"Saldo do Mês",      val:fmt(stats.saldoMes),       icon:Wallet,       grad:stats.saldoMes>=0?"from-emerald-700 to-teal-900":"from-rose-700 to-red-900",glow:stats.saldoMes>=0?C.green:C.red,delta:null},
    {label:"Pipeline Kanban",   val:fmtN(stats.kanbanTotal),   icon:Activity,     grad:"from-purple-700 to-violet-900",glow:C.purple,delta:"negócios"},
  ];

  const pieData=[
    {name:"Em Dia",value:stats.emDia,color:C.green},{name:"Atrasado",value:stats.atrasados,color:C.red},
    {name:"Vencendo",value:stats.vencendo,color:C.amber},{name:"A Vencer",value:stats.aVencer,color:C.cyan},
    {name:"Inativos",value:stats.inativos,color:C.muted},
  ].filter(d=>d.value>0);

  return (
    <div className="space-y-5">
      {stats.atrasados>0&&(
        <div style={{background:C.redDim,border:"1px solid rgba(244,63,94,0.3)"}} className="flex items-center justify-between rounded-2xl px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div style={{background:"rgba(244,63,94,0.2)"}} className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"><AlertTriangle size={18} style={{color:C.red}} className="animate-pulse"/></div>
            <div>
              <div style={{color:C.red}} className="font-bold text-sm">{stats.atrasados} cliente{stats.atrasados!==1?"s":""} com pagamento em atraso — {fmt(stats.inadimplencia)} em aberto</div>
              <div style={{color:"rgba(244,63,94,0.65)"}} className="text-xs">Use o Chat IA para estratégias de cobrança</div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={()=>navigate("/chatia")} style={{background:"rgba(244,63,94,0.12)",color:C.red,border:"1px solid rgba(244,63,94,0.3)"}} className="px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-500/20">Chat IA</button>
            <button onClick={()=>navigate("/crm")} style={{background:C.red,color:"white"}} className="px-3 py-1.5 rounded-lg text-xs font-bold hover:opacity-90">Ver Clientes</button>
          </div>
        </div>
      )}
      {stats.aniversariantesHoje?.length>0&&(
        <div style={{background:"#ec489915",border:"1px solid rgba(236,72,153,0.3)"}} className="flex items-center justify-between rounded-2xl px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div style={{background:"rgba(236,72,153,0.2)"}} className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"><Gift size={18} style={{color:"#ec4899"}} className="animate-bounce"/></div>
            <div>
              <div style={{color:"#ec4899"}} className="font-bold text-sm">Aniversariantes do Dia! 🎉</div>
              <div className="flex gap-2 mt-1 flex-wrap">
                {stats.aniversariantesHoje.map(a=>(
                  <span key={a.id} style={{background:"rgba(236,72,153,0.12)",color:"#ec4899",border:"1px solid rgba(236,72,153,0.25)"}} className="text-xs font-bold px-2 py-1 rounded-lg">{a.nome}</span>
                ))}
              </div>
            </div>
          </div>
          <button onClick={()=>navigate("/aniversariantes")} style={{background:"#ec4899",color:"white"}} className="px-3 py-1.5 rounded-lg text-xs font-bold hover:opacity-90">Ver Todos</button>
        </div>
      )}
      {stats.aniversariantesProximos?.length>0&&(
        <div style={{background:C.redDim,border:"1px solid rgba(244,63,94,0.3)"}} className="flex items-center justify-between rounded-2xl px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div style={{background:"rgba(244,63,94,0.2)"}} className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"><Gift size={18} style={{color:C.red}}/></div>
            <div>
              <div style={{color:C.red}} className="font-bold text-sm">Aniversariantes Próximos</div>
              <div className="flex gap-2 mt-1 flex-wrap">
                {stats.aniversariantesProximos.map(a=>(
                  <span key={a.id} style={{background:C.redDim,color:C.red,border:"1px solid rgba(244,63,94,0.25)"}} className="text-xs font-bold px-2 py-1 rounded-lg">{a.nome}</span>
                ))}
              </div>
            </div>
          </div>
          <button onClick={()=>navigate("/aniversariantes")} style={{background:C.red,color:"white"}} className="px-3 py-1.5 rounded-lg text-xs font-bold hover:opacity-90">Ver Todos</button>
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        {KPIS.map(({label,val,icon:Icon,grad,glow,delta})=>(
          <div key={label} style={{background:C.card,border:`1px solid ${C.border}`}} className="rounded-2xl p-5 hover:border-white/12 transition-all">
            <div className="flex items-start justify-between mb-4">
              <div style={{boxShadow:`0 6px 20px ${glow}25`}} className={`w-10 h-10 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center`}><Icon size={17} color="white"/></div>
              {delta&&<span style={{color:C.muted}} className="text-[10px]">{delta}</span>}
            </div>
            <div style={{color:C.text,fontFamily:"'JetBrains Mono',monospace"}} className="text-xl font-extrabold tabular-nums mb-1">{val}</div>
            <div style={{color:C.muted}} className="text-[11px]">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div style={{background:C.card,border:`1px solid ${C.border}`}} className="col-span-2 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div><div style={{color:C.text}} className="font-bold text-sm">Fluxo de Caixa — {ano}</div><div style={{color:C.muted}} className="text-[11px] mt-0.5">Entradas, saídas e saldo</div></div>
            <div className="flex gap-1">
              {[ano-1,ano,ano+1].map(y=><button key={y} onClick={()=>setAno(y)} style={{background:ano===y?C.indigoDim:"transparent",color:ano===y?C.indigo:C.muted,border:`1px solid ${ano===y?C.indigoBorder:C.border}`}} className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all">{y}</button>)}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={mensal}>
              <defs><linearGradient id="gEC" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.green} stopOpacity={0.3}/><stop offset="95%" stopColor={C.green} stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
              <XAxis dataKey="nome" tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis tickFormatter={v=>`${(v/1000).toFixed(0)}k`} tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/>
              <Tooltip formatter={v=>fmt(v)} contentStyle={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,fontSize:12,color:C.text}}/>
              <Area type="monotone" dataKey="entradas" stroke={C.green} strokeWidth={2} fill="url(#gEC)" name="Entradas"/>
              <Bar dataKey="saidas" fill={C.red} opacity={0.5} radius={[3,3,0,0]} name="Saídas" barSize={10}/>
              <Line type="monotone" dataKey="saldo" stroke={C.indigo} strokeWidth={2.5} dot={false} name="Saldo"/>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div style={{background:C.card,border:`1px solid ${C.border}`}} className="rounded-2xl p-5">
          <div style={{color:C.text}} className="font-bold text-sm mb-1">Status dos Clientes</div>
          <div style={{color:C.muted}} className="text-[11px] mb-3">{stats.totalClientes} total</div>
          <ResponsiveContainer width="100%" height={165}>
            <PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={42} outerRadius={68} paddingAngle={3} dataKey="value">{pieData.map((e,i)=><Cell key={i} fill={e.color}/>)}</Pie><Tooltip contentStyle={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,fontSize:11}}/></PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {pieData.map(d=><div key={d.name} className="flex items-center justify-between text-[11px]"><span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{background:d.color}}/><span style={{color:C.sub}}>{d.name}</span></span><span style={{color:C.text,fontFamily:"monospace"}} className="font-bold">{d.value}</span></div>)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {forecast&&(
          <div style={{background:C.card,border:`1px solid ${C.border}`}} className="rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4"><Sparkles size={14} style={{color:C.purple}}/><div style={{color:C.text}} className="font-bold text-sm">Previsão Receita</div><span style={{background:C.purpleDim,color:C.purple,border:"1px solid rgba(139,92,246,0.3)"}} className="text-[9px] font-extrabold px-2 py-0.5 rounded-full ml-auto">IA</span></div>
            <ResponsiveContainer width="100%" height={150}>
              <AreaChart data={forecast.previsao}>
                <defs><linearGradient id="gFP2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.purple} stopOpacity={0.3}/><stop offset="95%" stopColor={C.purple} stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                <XAxis dataKey="nome" tick={{fill:C.muted,fontSize:9}} axisLine={false} tickLine={false}/>
                <YAxis tickFormatter={v=>`${(v/1000).toFixed(0)}k`} tick={{fill:C.muted,fontSize:9}} axisLine={false} tickLine={false}/>
                <Tooltip formatter={v=>fmt(v)} contentStyle={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,fontSize:11,color:C.text}}/>
                <Area type="monotone" dataKey="previsto" stroke={C.purple} strokeWidth={2} fill="url(#gFP2)" name="Previsto"/>
                <Line type="monotone" dataKey="otimista" stroke={C.green} strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="Otimista"/>
                <Line type="monotone" dataKey="pessimista" stroke={C.red} strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="Pessimista"/>
              </AreaChart>
            </ResponsiveContainer>
            <div style={{color:C.muted}} className="text-[10px] mt-2 text-center">Média histórica: {fmt(forecast.media)}/mês</div>
          </div>
        )}
        <div style={{background:C.card,border:`1px solid ${C.indigoBorder}`}} className="rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><div style={{background:C.indigoDim}} className="w-8 h-8 rounded-xl flex items-center justify-center"><Zap size={14} style={{color:C.indigo}}/></div><div style={{color:C.text}} className="font-bold text-sm">Insights IA</div></div>
            <button onClick={gerarInsight} disabled={loadIA} style={{background:C.indigoDim,color:C.indigo,border:`1px solid ${C.indigoBorder}`}} className="text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 hover:bg-indigo-500/20 disabled:opacity-50">
              {loadIA?<RefreshCw size={10} className="animate-spin"/>:<Sparkles size={10}/>}{loadIA?"Analisando...":"Gerar"}
            </button>
          </div>
          {insight?(<div className="space-y-2"><p style={{color:C.sub}} className="text-xs leading-relaxed">{insight.resposta}</p>{insight.alertas?.map((a,i)=><div key={i} style={{background:C.amberDim,border:"1px solid rgba(245,158,11,0.25)",color:C.amber}} className="text-[11px] px-2.5 py-1.5 rounded-lg flex items-center gap-1.5"><AlertTriangle size={10}/>{a}</div>)}{insight.acoes?.slice(0,3).map((a,i)=><div key={i} style={{color:C.indigo}} className="text-[11px] flex items-center gap-1.5"><ChevronRight size={10}/>{a}</div>)}</div>):(
            <div className="flex flex-col items-center justify-center h-32 gap-2"><Sparkles size={28} style={{color:C.indigo}} className="opacity-30"/><p style={{color:C.muted}} className="text-xs text-center">Clique em "Gerar" para insights automáticos</p></div>
          )}
        </div>
        <div style={{background:C.card,border:"1px solid rgba(244,63,94,0.15)"}} className="rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3"><div style={{color:C.red}} className="font-bold text-sm flex items-center gap-2"><AlertTriangle size={14}/>Cobranças Urgentes</div><button onClick={()=>navigate("/crm")} style={{color:C.red}} className="text-[10px] hover:underline">Ver todos</button></div>
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {stats.listAtrasados?.slice(0,5).map(c=>(
              <div key={c.id} style={{background:"rgba(244,63,94,0.05)",border:"1px solid rgba(244,63,94,0.1)"}} className="rounded-xl p-2.5 flex items-center gap-2">
                <div style={{background:"rgba(244,63,94,0.15)",color:C.red}} className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-extrabold flex-shrink-0">{c.nome.split(" ").map(w=>w[0]).join("").slice(0,2)}</div>
                <div className="flex-1 min-w-0"><div style={{color:C.text}} className="text-xs font-semibold truncate">{c.nome}</div><div style={{color:C.red}} className="text-[10px]">{c._diasAtraso}d · {fmt(c.valor)}</div></div>
                {c.telefone&&<a href={`https://wa.me/55${c.telefone.replace(/\D/g,"")}?text=${encodeURIComponent(`Olá ${c.nome.split(" ")[0]}, sua mensalidade de ${fmt(c.valor)} está em atraso.`)}`} target="_blank" rel="noopener noreferrer" style={{background:"rgba(37,211,102,0.12)",border:"1px solid rgba(37,211,102,0.25)",color:"#25d366"}} className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-green-500/20 flex-shrink-0"><MessageSquare size={11}/></a>}
              </div>
            ))}
            {!stats.listAtrasados?.length&&<div style={{color:C.muted}} className="text-xs text-center py-6">Nenhum inadimplente 🎉</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
