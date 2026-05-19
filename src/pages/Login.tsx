import { useState } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { Zap, Eye, EyeOff, AlertCircle, Sparkles } from "lucide-react";
export default function Login() {
  const { login } = useAuth();
  const [email,  setEmail]  = useState("admin@aciapa.com");
  const [senha,  setSenha]  = useState("nexus123");
  const [show,   setShow]   = useState(false);
  const [loading,setLoading]= useState(false);
  const [error,  setError]  = useState("");
  const handleSubmit=async e=>{ e.preventDefault(); setError(""); setLoading(true); try { await login(email,senha); } catch(err){ setError((err as Error).message); } finally { setLoading(false); } };
  const inp={width:"100%",background:"rgba(6,11,20,0.8)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:12,padding:"12px 16px",color:"#f1f5f9",fontSize:14,outline:"none",transition:"border-color 0.15s",fontFamily:"'DM Sans',sans-serif",boxSizing:"border-box" as const};
  return (
    <div style={{background:"#020408",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:"20%",left:"25%",width:600,height:600,background:"rgba(99,102,241,0.07)",borderRadius:"50%",filter:"blur(120px)",pointerEvents:"none"}}/>
      <div style={{position:"absolute",bottom:"20%",right:"25%",width:400,height:400,background:"rgba(139,92,246,0.05)",borderRadius:"50%",filter:"blur(100px)",pointerEvents:"none"}}/>
      <div style={{width:"100%",maxWidth:440,padding:24,position:"relative",zIndex:1}}>
        <div style={{background:"rgba(10,16,32,0.92)",backdropFilter:"blur(20px)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:24,padding:40,boxShadow:"0 32px 80px rgba(0,0,0,0.5)"}}>
          <div style={{textAlign:"center",marginBottom:32}}>
            <div style={{width:64,height:64,borderRadius:20,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",boxShadow:"0 0 48px rgba(99,102,241,0.35)"}}><Zap size={28} color="white"/></div>
            <h1 style={{color:"#f1f5f9",fontSize:26,fontWeight:800,letterSpacing:-0.5,margin:0}}>ACIAPA</h1>
            <p style={{color:"#475569",fontSize:11,marginTop:6,letterSpacing:2,textTransform:"uppercase"}}><Sparkles size={10} style={{display:"inline",marginRight:4}}/>Gestão Empresarial Inteligente</p>
          </div>
          <form onSubmit={handleSubmit}>
            {error&&<div style={{background:"rgba(244,63,94,0.1)",border:"1px solid rgba(244,63,94,0.3)",borderRadius:12,padding:"10px 14px",marginBottom:20,display:"flex",alignItems:"center",gap:8}}><AlertCircle size={14} style={{color:"#f43f5e",flexShrink:0}}/><span style={{color:"#f43f5e",fontSize:13}}>{error}</span></div>}
            <div style={{marginBottom:16}}>
              <label style={{color:"#94a3b8",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",display:"block",marginBottom:8}}>E-mail</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="seu@email.com" style={inp} onFocus={e=>e.target.style.borderColor="rgba(99,102,241,0.5)"} onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.1)"}/>
            </div>
            <div style={{marginBottom:24}}>
              <label style={{color:"#94a3b8",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",display:"block",marginBottom:8}}>Senha</label>
              <div style={{position:"relative"}}>
                <input type={show?"text":"password"} value={senha} onChange={e=>setSenha(e.target.value)} required placeholder="••••••••" style={{...inp,paddingRight:48}} onFocus={e=>e.target.style.borderColor="rgba(99,102,241,0.5)"} onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.1)"}/>
                <button type="button" onClick={()=>setShow(!show)} style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",color:"#475569",background:"none",border:"none",cursor:"pointer",padding:0,display:"flex"}}>{show?<EyeOff size={15}/>:<Eye size={15}/>}</button>
              </div>
            </div>
            <button type="submit" disabled={loading} style={{width:"100%",padding:"13px",borderRadius:12,border:"none",background:loading?"rgba(99,102,241,0.5)":"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"white",fontSize:14,fontWeight:800,cursor:loading?"wait":"pointer",boxShadow:loading?"none":"0 0 24px rgba(99,102,241,0.3)",transition:"all 0.2s",fontFamily:"'DM Sans',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
              {loading?<><div style={{width:16,height:16,border:"2px solid rgba(255,255,255,0.3)",borderTop:"2px solid white",borderRadius:"50%",animation:"spin 1s linear infinite"}}/>Entrando...</>:"Entrar no ACIAPA"}
            </button>
          </form>
          <div style={{marginTop:28,borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:20}}>
            <div style={{color:"#475569",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",textAlign:"center",marginBottom:12}}>Contas de demonstração</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
              {[{l:"Admin",e:"admin@aciapa.com",c:"#6366f1"},{l:"Financeiro",e:"financeiro@aciapa.com",c:"#22c55e"},{l:"Atendimento",e:"atendimento@aciapa.com",c:"#06b6d4"}].map(a=>(
                <button key={a.l} onClick={()=>{setEmail(a.e);setSenha("nexus123");}} style={{background:`${a.c}12`,border:`1px solid ${a.c}30`,borderRadius:10,padding:"8px 6px",cursor:"pointer",textAlign:"center",transition:"all 0.15s"}} onMouseEnter={e=>e.currentTarget.style.borderColor=a.c+"60"} onMouseLeave={e=>e.currentTarget.style.borderColor=a.c+"30"}>
                  <div style={{color:a.c,fontSize:10,fontWeight:800}}>{a.l}</div>
                  <div style={{color:"#475569",fontSize:9,marginTop:2}}>nexus123</div>
                </button>
              ))}
            </div>
          </div>
        </div>
        <p style={{color:"#1e293b",fontSize:11,textAlign:"center",marginTop:16}}>© 2025 ACIAPA — Todos os direitos reservados</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
