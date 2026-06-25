import { useState, useEffect } from "react";
import { useConnection } from "../contexts/ConnectionContext.js";
import { Zap, Wifi, Search, ArrowRight, Server, RefreshCw, AlertCircle, Monitor, Smartphone } from "lucide-react";

export default function ConnectScreen() {
  const { isScanning, discoveredServers, scanProgress, error, connect, startDiscovery, statusMessage } = useConnection();
  const [manualIp, setManualIp] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState("");

  useEffect(() => {
    startDiscovery();
  }, []);

  const handleConnect = async (url: string) => {
    setConnecting(true);
    setConnectError("");
    const ok = await connect(url);
    if (!ok) setConnectError(`Falha ao conectar em ${url}`);
    setConnecting(false);
  };

  const handleManualConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualIp.trim()) return;
    let url = manualIp.trim();
    if (!url.startsWith("http")) url = `http://${url}`;
    if (!url.includes(":")) url = `${url}:3001`;
    await handleConnect(url);
  };

  const inpStyle: React.CSSProperties = {
    width: "100%",
    background: "rgba(6,11,20,0.8)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: "12px 16px",
    color: "#f1f5f9",
    fontSize: 14,
    outline: "none",
    fontFamily: "'DM Sans',sans-serif",
    boxSizing: "border-box" as const,
  };

  return (
    <div style={{ background: "#020408", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans',sans-serif", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "20%", left: "25%", width: 600, height: 600, background: "rgba(99,102,241,0.07)", borderRadius: "50%", filter: "blur(120px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "20%", right: "25%", width: 400, height: 400, background: "rgba(139,92,246,0.05)", borderRadius: "50%", filter: "blur(100px)", pointerEvents: "none" }} />

      <div style={{ width: "100%", maxWidth: 480, padding: 24, position: "relative", zIndex: 1 }}>
        <div style={{ background: "rgba(10,16,32,0.92)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 24, padding: 40, boxShadow: "0 32px 80px rgba(0,0,0,0.5)" }}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", boxShadow: "0 0 48px rgba(99,102,241,0.35)" }}>
              <Zap size={28} color="white" />
            </div>
            <h1 style={{ color: "#f1f5f9", fontSize: 26, fontWeight: 800, letterSpacing: -0.5, margin: 0 }}>Conectar ao ACIAPA</h1>
            <p style={{ color: "#475569", fontSize: 11, marginTop: 6, letterSpacing: 2, textTransform: "uppercase" }}>
              <Wifi size={10} style={{ display: "inline", marginRight: 4 }} />
              {statusMessage}
            </p>
          </div>

          {/* Status / Error */}
          {error && (
            <div style={{ background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.3)", borderRadius: 12, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <AlertCircle size={14} style={{ color: "#f43f5e", flexShrink: 0 }} />
              <span style={{ color: "#f43f5e", fontSize: 13 }}>{error}</span>
            </div>
          )}
          {connectError && (
            <div style={{ background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.3)", borderRadius: 12, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <AlertCircle size={14} style={{ color: "#f43f5e", flexShrink: 0 }} />
              <span style={{ color: "#f43f5e", fontSize: 13 }}>{connectError}</span>
            </div>
          )}

          {/* Scanning indicator */}
          {isScanning && (
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ width: 48, height: 48, border: "3px solid rgba(99,102,241,0.2)", borderTop: "3px solid #6366f1", borderRadius: "50%", animation: "scanSpin 1s linear infinite", margin: "0 auto 12px" }} />
              <p style={{ color: "#94a3b8", fontSize: 13 }}>Escaneando a rede local...</p>
              <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 8, height: 4, marginTop: 12, overflow: "hidden" }}>
                <div style={{ width: `${Math.min((scanProgress / 500) * 100, 100)}%`, height: "100%", background: "linear-gradient(90deg,#6366f1,#8b5cf6)", borderRadius: 8, transition: "width 0.3s" }} />
              </div>
            </div>
          )}

          {/* Discovered servers */}
          {!isScanning && discoveredServers.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
                <Server size={12} style={{ display: "inline", marginRight: 6 }} />
                Servidores encontrados
              </h3>
              {discoveredServers.map((srv, i) => (
                <button
                  key={i}
                  onClick={() => handleConnect(srv.url)}
                  disabled={connecting}
                  style={{
                    width: "100%",
                    background: "rgba(99,102,241,0.08)",
                    border: "1px solid rgba(99,102,241,0.25)",
                    borderRadius: 14,
                    padding: "14px 18px",
                    marginBottom: 8,
                    cursor: connecting ? "wait" : "pointer",
                    textAlign: "left" as const,
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    transition: "all 0.15s",
                    fontFamily: "'DM Sans',sans-serif",
                  }}
                  onMouseEnter={(e) => { if (!connecting) e.currentTarget.style.background = "rgba(99,102,241,0.15)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(99,102,241,0.08)"; }}
                >
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Monitor size={18} color="white" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 700 }}>{srv.nome}</div>
                    <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 2 }}>
                      {srv.hostname} — {srv.ip}
                    </div>
                  </div>
                  <ArrowRight size={16} style={{ color: "#6366f1", flexShrink: 0 }} />
                </button>
              ))}
            </div>
          )}

          {/* No servers found */}
          {!isScanning && discoveredServers.length === 0 && (
            <div style={{ textAlign: "center", marginBottom: 24, padding: "24px 0" }}>
              <Search size={32} style={{ color: "#475569", marginBottom: 12 }} />
              <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 4 }}>Nenhum servidor encontrado na rede</p>
              <p style={{ color: "#475569", fontSize: 11 }}>Verifique se o ACIAPA está rodando no PC e tente novamente</p>
              <button
                onClick={startDiscovery}
                style={{
                  marginTop: 16,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 10,
                  padding: "10px 20px",
                  color: "#94a3b8",
                  cursor: "pointer",
                  fontSize: 13,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontFamily: "'DM Sans',sans-serif",
                }}
              >
                <RefreshCw size={14} /> Escanear novamente
              </button>
            </div>
          )}

          {/* Manual IP entry */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 20, marginTop: 4 }}>
            <label style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 8 }}>
              <Smartphone size={12} style={{ display: "inline", marginRight: 6 }} />
              Ou digite o IP do servidor manualmente
            </label>
            <form onSubmit={handleManualConnect} style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                value={manualIp}
                onChange={(e) => setManualIp(e.target.value)}
                placeholder="192.168.1.100"
                style={{ ...inpStyle, flex: 1 }}
                onFocus={(e) => e.target.style.borderColor = "rgba(99,102,241,0.5)"}
                onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
              />
              <button
                type="submit"
                disabled={connecting || !manualIp.trim()}
                style={{
                  padding: "12px 20px",
                  borderRadius: 12,
                  border: "none",
                  background: connecting ? "rgba(99,102,241,0.5)" : "linear-gradient(135deg,#6366f1,#8b5cf6)",
                  color: "white",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: connecting || !manualIp.trim() ? "wait" : "pointer",
                  fontFamily: "'DM Sans',sans-serif",
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {connecting ? "Conectando..." : "Conectar"}
              </button>
            </form>
            <p style={{ color: "#475569", fontSize: 10, marginTop: 8 }}>
              No PC, descubra o IP com o comando <code style={{ color: "#6366f1" }}>ipconfig</code> no terminal
            </p>
          </div>
        </div>

        <p style={{ color: "#1e293b", fontSize: 11, textAlign: "center", marginTop: 16 }}>
          O servidor precisa estar rodando na mesma rede Wi-Fi
        </p>
      </div>

      <style>{`
        @keyframes scanSpin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
