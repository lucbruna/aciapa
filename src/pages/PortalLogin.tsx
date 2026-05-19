import { useState } from "react";
import { C } from "../constants.js";
import { LogIn, AlertTriangle, Eye, EyeOff, Zap } from "lucide-react";

export default function PortalLogin({ onLogin }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [show, setShow] = useState(false);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async e => {
    e.preventDefault();
    if (!email || !senha) return setErro("Preencha email e senha");
    setLoading(true);
    setErro("");
    try {
      const r = await fetch("/api/portal/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha }),
      });
      const d = await r.json();
      if (!d.ok) return setErro(d.error || "Credenciais inválidas");
      localStorage.setItem("aciapa_portal_token", d.token);
      onLogin(d.cliente);
    } catch {
      setErro("Erro de conexão");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{ background: C.bg, minHeight: "100vh" }}
      className="flex items-center justify-center p-4"
    >
      <div
        style={{
          position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0,
        }}
      >
        <div style={{
          position: "absolute", width: 600, height: 600, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)",
          top: "-10%", right: "-10%",
        }} />
        <div style={{
          position: "absolute", width: 500, height: 500, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)",
          bottom: "-10%", left: "-10%",
        }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 400 }}>
        <div className="text-center mb-8">
          <div
            style={{
              background: "linear-gradient(135deg,#6366f1,#8b5cf6)", width: 56, height: 56,
              borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px", boxShadow: "0 0 40px rgba(99,102,241,0.4)",
            }}
          >
            <Zap size={26} color="white" />
          </div>
          <h1 style={{ color: C.text }} className="font-extrabold text-2xl">
            Portal do Cliente
          </h1>
          <p style={{ color: C.muted }} className="text-sm mt-1">
            Acompanhe suas mensalidades e pagamentos
          </p>
        </div>

        <form
          onSubmit={submit}
          style={{
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 20, padding: 28,
            boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
          }}
          className="space-y-5"
        >
          {erro && (
            <div
              style={{
                background: C.redDim, border: "1px solid rgba(244,63,94,0.3)",
                borderRadius: 12, padding: "12px 14px",
              }}
              className="flex items-center gap-2"
            >
              <AlertTriangle size={14} style={{ color: C.red, flexShrink: 0 }} />
              <span style={{ color: C.red }} className="text-sm font-medium">{erro}</span>
            </div>
          )}

          <div>
            <label style={{ color: C.sub }} className="text-xs font-bold uppercase tracking-wider mb-1.5 block">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              style={{
                background: C.surface, border: `1px solid ${C.border}`, color: C.text,
                width: "100%", borderRadius: 12, padding: "12px 14px", fontSize: 14,
                outline: "none",
              }}
              onFocus={e => e.target.style.borderColor = C.indigoBorder}
              onBlur={e => e.target.style.borderColor = C.border}
            />
          </div>

          <div>
            <label style={{ color: C.sub }} className="text-xs font-bold uppercase tracking-wider mb-1.5 block">
              Senha
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={show ? "text" : "password"}
                value={senha}
                onChange={e => setSenha(e.target.value)}
                placeholder="Sua senha"
                style={{
                  background: C.surface, border: `1px solid ${C.border}`, color: C.text,
                  width: "100%", borderRadius: 12, padding: "12px 40px 12px 14px",
                  fontSize: 14, outline: "none",
                }}
                onFocus={e => e.target.style.borderColor = C.indigoBorder}
                onBlur={e => e.target.style.borderColor = C.border}
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                style={{
                  position: "absolute", right: 12, top: "50%",
                  transform: "translateY(-50%)", color: C.muted, background: "none",
                  border: "none", padding: 0,
                }}
              >
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              background: loading
                ? "rgba(255,255,255,0.05)"
                : "linear-gradient(135deg,#6366f1,#8b5cf6)",
              color: loading ? C.muted : "white",
              width: "100%", padding: "14px", borderRadius: 12, fontSize: 15,
              fontWeight: 800, border: "none",
              opacity: loading ? 0.7 : 1,
            }}
            className="flex items-center justify-center gap-2 hover:opacity-90"
          >
            {loading ? (
              <span style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid currentColor", borderTopColor: "transparent", display: "inline-block", animation: "spin 0.6s linear infinite" }} />
            ) : (
              <LogIn size={16} />
            )}
            {loading ? "Entrando..." : "Entrar"}
          </button>

          <div style={{ textAlign: "center" }}>
            <a
              href="/"
              style={{ color: C.muted, fontSize: 12 }}
              className="hover:text-indigo-400 transition-colors"
            >
              Voltar ao sistema
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
