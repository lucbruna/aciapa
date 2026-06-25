import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext.jsx";
import { ConnectionProvider, useConnection } from "./contexts/ConnectionContext.jsx";
import ConnectScreen from "./pages/ConnectScreen.jsx";
import Login from "./pages/Login.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import CRM from "./pages/CRM.jsx";
import Associados from "./pages/Associados.jsx";
import Financeiro from "./pages/Financeiro.jsx";
import WhatsApp from "./pages/WhatsApp.jsx";
import ChatIA from "./pages/ChatIA.jsx";
import Estoque from "./pages/Estoque.jsx";
import Aniversariantes from "./pages/Aniversariantes.jsx";
import RH from "./pages/RH.jsx";
import Email from "./pages/Email.jsx";
import Contabilidade from "./pages/Contabilidade.jsx";
import Advocacia from "./pages/Advocacia.jsx";
import { Kanban, Agenda, Relatorios, Configuracoes } from "./pages/Pages.jsx";
import PortalLogin from "./pages/PortalLogin.jsx";
import PortalDashboard from "./pages/PortalDashboard.jsx";
import { Minus, Square, Bell, LogOut, AlertTriangle, CheckCircle, X, Info, Menu } from "lucide-react";
import { C, socket, fmt, fmtN } from "./constants.js";
import { apiFetch } from "./lib/api.js";
import { ThemeProvider } from "./contexts/ThemeContext.jsx";

export function Toast({ msg, type, onClose }) {
  useEffect(()=>{ const t=setTimeout(onClose,4000); return()=>clearTimeout(t); },[]);
  const colors={success:C.green,error:C.red,info:C.cyan,warning:C.amber};
  const c=colors[type]||C.indigo;
  const Icon=type==="success"?CheckCircle:type==="error"?X:type==="warning"?AlertTriangle:Info;
  return (
    <div style={{background:C.card,border:`1px solid ${c}40`,boxShadow:`0 8px 32px ${c}20`,minWidth:300,zIndex:999,position:"fixed",bottom:20,right:20}} className="flex items-center gap-3 px-4 py-3 rounded-xl">
      <Icon size={16} style={{color:c,flexShrink:0}}/>
      <span style={{color:C.text}} className="text-sm flex-1">{msg}</span>
      <button onClick={onClose} style={{color:C.muted}}><X size={13}/></button>
    </div>
  );
}

function PortalApp() {
  const navigate = useNavigate();
  const location = useLocation();
  const [cliente, setCliente] = useState(() => {
    const saved = sessionStorage.getItem("aciapa_portal_cliente");
    return saved ? JSON.parse(saved) : null;
  });

  const handleLogin = c => {
    setCliente(c);
    sessionStorage.setItem("aciapa_portal_cliente", JSON.stringify(c));
    navigate("/portal/dashboard", { replace: true });
  };

  const handleLogout = () => {
    localStorage.removeItem("aciapa_portal_token");
    sessionStorage.removeItem("aciapa_portal_cliente");
    setCliente(null);
    navigate("/portal/login", { replace: true });
  };

  // se não logado, mostra login para qualquer rota /portal/*
  if (!cliente && !location.pathname.includes("/login")) {
    navigate("/portal/login", { replace: true });
    return null;
  }

  return (
    <Routes>
      <Route path="/portal/login" element={<PortalLogin onLogin={handleLogin} />} />
      <Route path="/portal/dashboard" element={<PortalDashboard cliente={cliente} onLogout={handleLogout} />} />
      <Route path="/portal/*" element={cliente ? <PortalDashboard cliente={cliente} onLogout={handleLogout} /> : <Navigate to="/portal/login" replace />} />
    </Routes>
  );
}

function AppInner() {
  const { user, logout, token } = useAuth();
  const { isConnected, isScanning, discoveredServers, startDiscovery } = useConnection();
  const navigate = useNavigate();
  const location = useLocation();
  const [stats,   setStats]  = useState<any>(null);
  const [toasts,  setToasts] = useState<any[]>([]);
  const [notifs,  setNotifs] = useState<any[]>([]);
  const [showN,   setShowN]  = useState(false);
  const [waStatus,setWaStatus]=useState("disconnected");
  const [mobileMenu, setMobileMenu] = useState(false);

  // Se for Capacitor (file://) e não conectado, mostra tela de descoberta
  const isCapacitor = typeof window !== "undefined" && window.location.protocol === "file:";
  if (isCapacitor && !isConnected && !location.pathname.startsWith("/portal")) {
    return <ConnectScreen />;
  }

  // Portal routes — render sem layout admin
  if (location.pathname.startsWith("/portal")) {
    return <PortalApp />;
  }

  const toast=(msg,type="info")=>setToasts(t=>[...t,{id:Date.now()+Math.random(),msg,type}]);
  const api=(url,opts:any={})=>apiFetch(url,{...opts,headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`,...(opts.headers||{})}});
  const loadStats=async()=>{ try{ const s=await api("/api/stats").then(r=>r.json()); setStats(s); }catch(_){} };
  const setPage = p => navigate(`/${p}`);

  const page = location.pathname.slice(1) || "dashboard";

  useEffect(()=>{
    if(!user) return;
    loadStats();
    api("/api/notificacoes").then(r=>r.json()).then(n=>setNotifs(n.filter(x=>!x.lida))).catch(()=>{});
    socket.on("stats_update", setStats);
    socket.on("data_update",  loadStats);
    socket.on("wa_status",    d=>setWaStatus(d.status));
    socket.on("alerta",       d=>toast(d.mensagem||"Alerta","warning"));
    return()=>{ socket.off("stats_update"); socket.off("data_update"); socket.off("wa_status"); socket.off("alerta"); };
  },[user]);

  // Keyboard shortcuts
  useEffect(()=>{
    if(!user) return;
    const handler=e=>{
      if(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA"||e.target.tagName==="SELECT") return;
      if(e.ctrlKey&&e.key==="n"){ e.preventDefault(); navigate("/crm"); }
      if(e.ctrlKey&&e.key==="f"){ e.preventDefault(); const inp=document.querySelector("input[placeholder*='Buscar'],input[placeholder*='busca'],input[placeholder*='search']"); (inp as HTMLElement)?.focus(); }
      if(e.ctrlKey&&e.key==="d"){ e.preventDefault(); navigate("/dashboard"); }
      if(e.ctrlKey&&e.key==="1"){ e.preventDefault(); navigate("/crm"); }
      if(e.ctrlKey&&e.key==="2"){ e.preventDefault(); navigate("/financeiro"); }
      if(e.ctrlKey&&e.key==="3"){ e.preventDefault(); navigate("/kanban"); }
      if(e.ctrlKey&&e.key==="4"){ e.preventDefault(); navigate("/whatsapp"); }
      if(e.key==="Escape"){ setShowN(false); }
    };
    window.addEventListener("keydown", handler);
    return()=>window.removeEventListener("keydown", handler);
  },[user]);

  if (!user) return <Login/>;

  const pageLabel={dashboard:"Dashboard",crm:"CRM — Clientes",associados:"Associados",financeiro:"Financeiro",whatsapp:"WhatsApp",chatia:"Chat com IA",kanban:"Pipeline Kanban",estoque:"Estoque",rh:"RH & Pessoal",email:"E-mail",contabilidade:"Contabilidade",advocacia:"Advocacia",aniversariantes:"Aniversariantes",agenda:"Agenda",relatorios:"Relatórios",configuracoes:"Configurações"};

  return (
    <div style={{background:C.bg,color:C.text,fontFamily:"'DM Sans',sans-serif"}} className="flex h-screen overflow-hidden">
      <Sidebar page={page} setPage={setPage} stats={stats} waStatus={waStatus} mobileOpen={mobileMenu} onToggleMobile={() => setMobileMenu(v => !v)}/>
      <div className="flex-1 flex flex-col overflow-hidden">
        <header style={{background:`${C.surface}e0`,backdropFilter:"blur(20px)",borderBottom:`1px solid ${C.border}`,WebkitAppRegion:"drag"}} className="h-16 flex items-center px-6 gap-4 flex-shrink-0 sticky top-0 z-10">
          <button onClick={() => setMobileMenu(true)} className="lg:hidden w-9 h-9 rounded-xl flex items-center justify-center hover:bg-white/5 transition-colors" style={{color:C.muted,WebkitAppRegion:"no-drag"}}><Menu size={17}/></button>
          <div className="flex-1">
            <h1 style={{color:C.text}} className="font-bold text-[15px]">{pageLabel[page]||page}</h1>
            <p style={{color:C.muted}} className="text-[11px]">{new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</p>
          </div>
          <div onClick={()=>navigate("/whatsapp")} style={{background:waStatus==="connected"?C.greenDim:waStatus==="qr"?C.amberDim:"rgba(255,255,255,0.05)",border:`1px solid ${waStatus==="connected"?"rgba(34,197,94,0.3)":waStatus==="qr"?"rgba(245,158,11,0.3)":"rgba(255,255,255,0.1)"}`,color:waStatus==="connected"?C.green:waStatus==="qr"?C.amber:C.muted,WebkitAppRegion:"no-drag"} } className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer hover:opacity-90 transition-opacity">
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"/>
            WA {waStatus==="connected"?"Online":waStatus==="qr"?"QR":"Offline"}
          </div>
          {stats?.atrasados>0&&<button onClick={()=>navigate("/crm")} style={{background:C.redDim,border:"1px solid rgba(244,63,94,0.3)",color:C.red,WebkitAppRegion:"no-drag"}} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold"><AlertTriangle size={11} className="animate-pulse"/>{stats.atrasados} inadimp.</button>}
          <div className="relative" style={{WebkitAppRegion:"no-drag"}}>
            <button onClick={()=>setShowN(!showN)} style={{background:"rgba(255,255,255,0.05)",border:`1px solid ${C.border}`}} className="relative w-9 h-9 rounded-xl flex items-center justify-center hover:border-white/20 transition-colors">
              <Bell size={15} style={{color:C.muted}}/>
              {notifs.length>0&&<span style={{background:C.red}} className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-extrabold text-white flex items-center justify-center">{notifs.length}</span>}
            </button>
            {showN&&(
              <div style={{background:C.card,border:`1px solid ${C.border2}`,width:300,top:"calc(100% + 8px)",right:0,position:"absolute",borderRadius:16,overflow:"hidden",zIndex:50}}>
                <div style={{borderBottom:`1px solid ${C.border}`}} className="flex items-center justify-between px-4 py-3">
                  <span style={{color:C.text}} className="font-bold text-sm">Notificações</span>
                  <button onClick={async()=>{ await api("/api/notificacoes",{method:"DELETE"}); setNotifs([]); }} style={{color:C.muted}} className="text-xs hover:text-white">Limpar</button>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {notifs.length===0?<div style={{color:C.muted}} className="text-xs text-center py-8">Sem notificações</div>:notifs.map(n=>(
                    <div key={n.id} style={{borderBottom:`1px solid ${C.border}`}} className="px-4 py-3 hover:bg-white/[0.02]">
                      <div style={{color:C.text}} className="text-xs font-semibold">{n.titulo}</div>
                      <div style={{color:C.muted}} className="text-[11px] mt-0.5">{n.mensagem}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2" style={{WebkitAppRegion:"no-drag"}}>
            <div style={{background:`linear-gradient(135deg,${user.cor||C.indigo},${C.purple})`}} className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-extrabold text-white select-none">{user.avatar||user.nome?.slice(0,2).toUpperCase()}</div>
            <div className="hidden md:block">
              <div style={{color:C.text}} className="text-xs font-semibold leading-tight">{user.nome}</div>
              <div style={{color:C.muted}} className="text-[10px] capitalize">{user.role?.replace("_"," ")}</div>
            </div>
            <button onClick={logout} style={{color:C.muted,border:`1px solid ${C.border}`}} className="w-8 h-8 rounded-lg flex items-center justify-center hover:border-red-500/40 hover:text-red-400 transition-colors ml-1"><LogOut size={13}/></button>
          </div>
          {window.aciapa && (
            <div className="flex items-center gap-1 border-l pl-3 ml-1" style={{borderColor:C.border,WebkitAppRegion:"no-drag"}}>
              <button onClick={()=>window.aciapa?.minimize?.()} style={{color:C.muted}} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" title="Minimizar"><Minus size={14}/></button>
              <button onClick={()=>window.aciapa?.maximize?.()} style={{color:C.muted}} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" title="Maximizar"><Square size={12}/></button>
              <button onClick={()=>window.aciapa?.close?.()} style={{color:C.muted}} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-500/20 hover:text-red-400 transition-colors" title="Fechar"><X size={15}/></button>
            </div>
          )}
        </header>
        <main style={{background:C.bg}} className="flex-1 overflow-y-auto p-6">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace/>}/>
            <Route path="/dashboard"     element={<Dashboard     stats={stats} reload={loadStats} toast={toast} api={api}/>}/>
            <Route path="/crm"           element={<CRM           toast={toast} api={api} reload={loadStats}/>}/>
            <Route path="/associados"    element={<Associados    toast={toast} api={api} reload={loadStats}/>}/>
            <Route path="/financeiro"    element={<Financeiro    toast={toast} api={api} reload={loadStats}/>}/>
            <Route path="/whatsapp"      element={<WhatsApp      toast={toast} api={api} waStatus={waStatus}/>}/>
            <Route path="/chatia"        element={<ChatIA        toast={toast} api={api}/>}/>
            <Route path="/kanban"        element={<Kanban        toast={toast} api={api}/>}/>
            <Route path="/estoque"       element={<Estoque       toast={toast} api={api}/>}/>
            <Route path="/rh"            element={<RH            toast={toast} api={api}/>}/>
            <Route path="/email"         element={<Email         toast={toast} api={api}/>}/>
            <Route path="/contabilidade" element={<Contabilidade  toast={toast} api={api}/>}/>
            <Route path="/advocacia"     element={<Advocacia      toast={toast} api={api}/>}/>
            <Route path="/aniversariantes" element={<Aniversariantes toast={toast} api={api}/>}/>
            <Route path="/agenda"        element={<Agenda        toast={toast} api={api}/>}/>
            <Route path="/relatorios"    element={<Relatorios    toast={toast} api={api}/>}/>
            <Route path="/configuracoes" element={<Configuracoes  toast={toast} api={api} reload={loadStats}/>}/>
          </Routes>
        </main>
      </div>
      <div className="pointer-events-none">
        {toasts.map(t=><div key={t.id} className="pointer-events-auto"><Toast msg={t.msg} type={t.type} onClose={()=>setToasts(ts=>ts.filter(x=>x.id!==t.id))}/></div>)}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ConnectionProvider>
        <AuthProvider>
          <ThemeProvider>
            <AppInner/>
          </ThemeProvider>
        </AuthProvider>
      </ConnectionProvider>
    </BrowserRouter>
  );
}
