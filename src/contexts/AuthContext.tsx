import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface AuthValue {
  user: any;
  token: string | null;
  loading: boolean;
  login: (email: string, senha: string) => Promise<any>;
  logout: () => void;
  can: (...roles: string[]) => boolean;
}

const AuthContext = createContext<AuthValue>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,   setUser]   = useState<any>(null);
  const [token,  setToken]  = useState(localStorage.getItem("aciapa_token")||null);
  const [loading,setLoading]= useState(true);
  useEffect(()=>{
    if (token) {
      fetch("/api/auth/me",{headers:{Authorization:`Bearer ${token}`}})
        .then(r=>r.ok?r.json():null).then(u=>{ if(u) setUser(u); else logout(); }).catch(()=>logout()).finally(()=>setLoading(false));
    } else setLoading(false);
  },[]);
  const login=async(email:string,senha:string)=>{
    const r=await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,senha})});
    const d=await r.json(); if(!r.ok) throw new Error(d.error||"Erro ao fazer login");
    localStorage.setItem("aciapa_token",d.token); setToken(d.token); setUser(d.user); return d;
  };
  const logout=()=>{ localStorage.removeItem("aciapa_token"); setToken(null); setUser(null); };
  const can=(...roles:string[])=>{ if(!user) return false; if(user.role==="super_admin") return true; return roles.includes(user.role); };
  return <AuthContext.Provider value={{user,token,loading,login,logout,can}}>{children}</AuthContext.Provider>;
}
export const useAuth=()=>useContext(AuthContext);
