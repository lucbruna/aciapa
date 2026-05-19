import { useState, useEffect, createElement } from "react";
import { BarChart3, Users, DollarSign, MessageSquare, Bot, Layers, Calendar, FileText, Settings, ChevronRight, Zap, Star, Package, UserCheck, Mail, Receipt, Scale, Sun, Moon, X as XIcon } from "lucide-react";
import { C } from "../constants.js";
import { useTheme } from "../contexts/ThemeContext.jsx";
export default function Sidebar({ page, setPage, stats, waStatus, mobileOpen, onToggleMobile }) {
  const [open,setOpen]=useState(true);
  const { isDark, toggleTheme } = useTheme();
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1024);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  const sidebarStyle: any = {
    background: `linear-gradient(180deg,${C.surface} 0%,#030710 100%)`,
    borderRight: `1px solid ${C.border}`,
    width: open ? 258 : 66,
  };
  if (isMobile) {
    sidebarStyle.display = mobileOpen ? 'flex' : undefined;
    sidebarStyle.transform = mobileOpen ? 'translateX(0)' : 'translateX(-100%)';
  }
  const NAV=[
    {group:"PRINCIPAL"},
    {id:"dashboard",  icon:BarChart3,    label:"Dashboard",     badge:null},
    {id:"crm",        icon:Users,        label:"CRM & Clientes", badge:stats?.atrasados>0?stats.atrasados:null, bc:"red"},
    {id:"associados", icon:Users,        label:"Associados",     badge:null},
    {id:"kanban",     icon:Layers,       label:"Pipeline Kanban",badge:null},
    {id:"financeiro", icon:DollarSign,   label:"Financeiro",     badge:null},
    {group:"COMUNICAÇÃO"},
    {id:"whatsapp",   icon:MessageSquare,label:"WhatsApp",       badge:waStatus==="connected"?null:waStatus==="qr"?"QR":"OFF", bc:waStatus==="connected"?"green":waStatus==="qr"?"amber":"red"},
    {id:"email",      icon:Mail,         label:"E-mail",         badge:null},
    {id:"chatia",     icon:Bot,          label:"Chat com IA",    badge:"IA",bc:"purple"},
    {group:"ESCRITÓRIO"},
    {id:"estoque",    icon:Package,      label:"Estoque",        badge:null},
    {id:"rh",         icon:UserCheck,    label:"RH & Pessoal",   badge:null},
    {id:"contabilidade",icon:Receipt,    label:"Contabilidade",  badge:null},
    {id:"advocacia",  icon:Scale,        label:"Advocacia",      badge:"Jur",bc:"cyan"},
    {group:"GESTÃO"},
    {id:"agenda",     icon:Calendar,     label:"Agenda",         badge:null},
    {id:"relatorios", icon:FileText,     label:"Relatórios",     badge:null},
    {id:"configuracoes",icon:Settings,   label:"Configurações",  badge:null},
  ];
  const bc={red:C.red,green:C.green,amber:C.amber,purple:C.purple,cyan:C.cyan};
  const fmt=v=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v||0);
  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onToggleMobile}
        />
      )}
      <aside style={sidebarStyle} className="flex-shrink-0 flex-col transition-all duration-300 z-40 lg:flex lg:relative lg:inset-auto lg:translate-x-0 hidden fixed inset-y-0 left-0">
      <div style={{borderBottom:`1px solid ${C.border}`}} className="h-16 flex items-center px-4 gap-3">
        <div style={{background:`linear-gradient(135deg,${C.indigo},${C.purple})`}} className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg"><Zap size={18} color="white"/></div>
        {open&&<div className="flex-1"><div style={{color:C.text}} className="font-extrabold text-[15px] tracking-tight leading-none">ACIAPA</div><div style={{color:C.indigo}} className="text-[10px] font-semibold mt-0.5 flex items-center gap-1"><Star size={9}/>Premium · IA</div></div>}
        <button onClick={onToggleMobile} className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5" style={{color:C.muted}}><XIcon size={16}/></button>
      </div>
      <nav className="flex-1 py-3 px-2 overflow-y-auto space-y-0.5">
        {NAV.map((item,i)=>{
          if(item.group) return open?<div key={i} style={{color:C.muted}} className="text-[9px] font-extrabold uppercase tracking-[0.2em] px-3 pt-4 pb-1">{item.group}</div>:<div key={i} style={{borderBottom:`1px solid ${C.border}`}} className="my-2 mx-2"/>;
          const active=page===item.id; const color=bc[item.bc as keyof typeof bc]||C.indigo;
          const Icon = item.icon as React.ComponentType<any>;
          return (
            <button key={item.id} onClick={()=>{ setPage(item.id); onToggleMobile?.(); }} style={{background:active?C.indigoDim:"transparent",color:active?C.indigo:C.muted,borderLeft:`2px solid ${active?C.indigo:"transparent"}`}} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-r-xl text-[13px] font-medium transition-all hover:text-white relative">
              <Icon size={17} className="flex-shrink-0"/>
              {open&&<><span className="flex-1 text-left">{item.label}</span>{item.badge!==null&&item.badge!==undefined&&<span style={{background:`${color}20`,color,border:`1px solid ${color}35`}} className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full">{item.badge}</span>}</>}
              {!open&&item.badge&&<span style={{background:color}} className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full"/>}
            </button>
          );
        })}
      </nav>
      {open&&stats&&(
        <div style={{borderTop:`1px solid ${C.border}`}} className="p-3">
          <div style={{background:C.card2,border:`1px solid ${C.border}`}} className="rounded-xl p-3 space-y-2">
            <div style={{color:C.muted}} className="text-[9px] font-extrabold uppercase tracking-wider">Resumo Hoje</div>
            {[["Ativos",stats.ativos,C.green],["Atrasados",stats.atrasados,C.red],["Receita",fmt(stats.receitaMes),C.indigo],["Adimpl.",`${stats.percentualAdimplencia||0}%`,stats.percentualAdimplencia>=80?C.green:C.amber]].map(([k,v,c])=>(
              <div key={k} className="flex items-center justify-between">
                <span style={{color:C.muted}} className="text-[11px]">{k}</span>
                <span style={{color:c}} className="text-[11px] font-bold">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{borderTop:`1px solid ${C.border}`,padding:8}} className="flex items-center justify-center gap-2">
        {open&&<div className="flex-1"/>}
        <button onClick={toggleTheme} style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${C.border}`,color:C.sub}} className="w-8 h-8 rounded-lg flex items-center justify-center hover:border-white/20 hover:text-white transition-colors" title={isDark?"Modo claro":"Modo escuro"}>
          {isDark?<Sun size={13}/>:<Moon size={13}/>}
        </button>
        {open&&<span style={{color:C.muted}} className="text-[10px] font-semibold">{isDark?"Claro":"Escuro"}</span>}
      </div>
      <button onClick={()=>setOpen(!open)} style={{background:C.surface,border:`1px solid ${C.border}`,color:C.muted}} className="absolute -right-3 top-[76px] w-6 h-6 rounded-full flex items-center justify-center z-30 hover:border-indigo-500/50 transition-colors">
        <ChevronRight size={11} className={`transition-transform ${open?"rotate-180":""}`}/>
      </button>
    </aside>
    </>
  );
}
