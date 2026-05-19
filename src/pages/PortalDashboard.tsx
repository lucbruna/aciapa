import { useState, useEffect, useRef } from "react";
import { C, fmt } from "../constants.js";
import {
  CreditCard, CalendarDays, CheckCircle, AlertTriangle,
  LogOut, MessageSquare, Zap, DollarSign, QrCode, Copy, ExternalLink,
  X, Loader, Smartphone, Banknote,
} from "lucide-react";

function PaymentModal({ data, onClose, api, onPaid }) {
  const [metodo, setMetodo] = useState("pix");
  const [loading, setLoading] = useState(false);
  const [pagamento, setPagamento] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<number | null>(null);

  const gerar = async () => {
    setLoading(true);
    const r = await api("/api/mercado-pago/gerar-pagamento", {
      method: "POST",
      body: JSON.stringify({
        mes: data.mes,
        ano: data.ano,
        valor: data.valor,
        metodo,
      }),
    });
    const j = await r.json();
    setLoading(false);
    if (!r.ok) return alert(j.error || "Erro ao gerar pagamento");
    setPagamento(j.pagamento);
    // Poll PIX status
    if (metodo === "pix") {
      pollRef.current = setInterval(async () => {
        const r2 = await api(`/api/mercado-pago/status/${j.pagamento.id}`);
        const j2 = await r2.json();
        if (j2.status === "approved") {
          clearInterval(pollRef.current!);
          onPaid({ mes: data.mes, ano: data.ano });
          onClose();
        }
      }, 3000);
    }
  };

  useEffect(() => {
    return () => { if(pollRef.current !== null) clearInterval(pollRef.current); };
  }, []);

  const copiar = text => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (pagamento && metodo === "pix") {
    return (
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 24 }} className="max-w-sm mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div style={{ color: C.text }} className="font-bold text-sm">Pagar com PIX</div>
          <button onClick={onClose} style={{ color: C.muted }} className="hover:text-red-400 transition-colors"><X size={18}/></button>
        </div>
        <div style={{ color: C.sub }} className="text-xs mb-4">Escaneie o QR Code abaixo com seu banco:</div>
        {pagamento.qrCodeBase64 && (
          <div className="flex justify-center mb-4">
            <img src={`data:image/png;base64,${pagamento.qrCodeBase64}`} alt="QR Code PIX" style={{ width: 200, height: 200, borderRadius: 12 }} />
          </div>
        )}
        {pagamento.qrCode && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12 }} className="mb-4">
            <div style={{ color: C.muted, fontSize: 10, fontWeight: 700, marginBottom: 6 }}>Código PIX Copia e Cola</div>
            <div style={{ color: C.text, fontSize: 11, wordBreak: "break-all", fontFamily: "monospace", lineHeight: 1.4, marginBottom: 8 }}>{pagamento.qrCode}</div>
            <button
              onClick={() => copiar(pagamento.qrCode)}
              style={{ background: "rgba(99,102,241,0.12)", color: C.indigo, border: `1px solid ${C.indigoBorder}` }}
              className="flex items-center justify-center gap-2 w-full py-2 rounded-lg text-xs font-bold hover:bg-indigo-500/20 transition-colors"
            >
              <Copy size={13}/> {copied ? "Copiado!" : "Copiar código"}
            </button>
          </div>
        )}
        <div style={{ background: `${C.amber}12`, border: `1px solid ${C.amber}30`, borderRadius: 10, padding: 10 }} className="flex items-center gap-2 mb-3">
          <Loader size={14} style={{ color: C.amber }} className="animate-spin shrink-0"/>
          <div style={{ color: C.amber, fontSize: 11 }}>Aguardando pagamento...</div>
        </div>
        <button onClick={() => { if(pollRef.current !== null) clearInterval(pollRef.current); setPagamento(null); }} style={{ color: C.muted }} className="w-full text-center text-xs font-bold py-2 hover:text-red-400 transition-colors">Cancelar</button>
      </div>
    );
  }

  if (pagamento && metodo !== "pix") {
    return (
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 24 }} className="max-w-sm mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div style={{ color: C.text }} className="font-bold text-sm">Pagamento via {metodo === "bolbradesco" ? "Boleto" : "Cartão"}</div>
          <button onClick={onClose} style={{ color: C.muted }} className="hover:text-red-400 transition-colors"><X size={18}/></button>
        </div>
        <div style={{ color: C.sub }} className="text-xs mb-4">Clique no link abaixo para finalizar o pagamento:</div>
        {pagamento.linkPagamento && (
          <a
            href={pagamento.linkPagamento}
            target="_blank"
            rel="noopener noreferrer"
            style={{ background: "rgba(99,102,241,0.12)", color: C.indigo, border: `1px solid ${C.indigoBorder}` }}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold hover:bg-indigo-500/20 transition-colors"
          >
            <ExternalLink size={15}/> Ir para pagamento
          </a>
        )}
        <button onClick={onClose} style={{ color: C.muted }} className="w-full text-center text-xs font-bold py-2 mt-3 hover:text-red-400 transition-colors">Fechar</button>
      </div>
    );
  }

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 24 }} className="max-w-sm mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div style={{ color: C.text }} className="font-bold text-sm">Pagamento</div>
        <button onClick={onClose} style={{ color: C.muted }} className="hover:text-red-400 transition-colors"><X size={18}/></button>
      </div>
      <div style={{ color: C.text }} className="text-xl font-extrabold mb-1">{fmt(data.valor)}</div>
      <div style={{ color: C.sub }} className="text-xs mb-4">
        {data.mes}/{data.ano} — {data.nome}
      </div>
      <div className="space-y-2 mb-4">
        {[
          { id: "pix", label: "PIX", icon: QrCode, desc: "Pagamento instantâneo via QR Code" },
          { id: "credit_card", label: "Cartão de Crédito", icon: CreditCard, desc: "Parcelado em até 12x" },
          { id: "bolbradesco", label: "Boleto Bancário", icon: Banknote, desc: "Vence em 3 dias úteis" },
        ].map(m => (
          <button
            key={m.id}
            onClick={() => setMetodo(m.id)}
            style={{
              background: metodo === m.id ? `${C.indigo}15` : C.surface,
              border: `1px solid ${metodo === m.id ? C.indigoBorder : C.border}`,
              borderRadius: 12, padding: "12px 14px", width: "100%", textAlign: "left",
            }}
            className="flex items-center gap-3 hover:border-indigo-500/40 transition-colors"
          >
            <div style={{
              background: metodo === m.id ? `${C.indigo}20` : C.card,
              width: 36, height: 36, borderRadius: 10,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <m.icon size={16} style={{ color: metodo === m.id ? C.indigo : C.muted }} />
            </div>
            <div className="flex-1">
              <div style={{ color: C.text }} className="text-sm font-bold">{m.label}</div>
              <div style={{ color: C.muted }} className="text-[10px]">{m.desc}</div>
            </div>
            {metodo === m.id && <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.indigo, boxShadow: `0 0 8px ${C.indigo}` }} />}
          </button>
        ))}
      </div>
      <button
        onClick={gerar}
        disabled={loading}
        style={{
          background: `linear-gradient(135deg,${C.indigo},${C.purple})`,
          color: "white", opacity: loading ? 0.7 : 1,
          boxShadow: `0 0 20px ${C.indigo}20`,
        }}
        className="w-full py-3 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 hover:opacity-90"
      >
        {loading ? <Loader size={15} className="animate-spin"/> : <Smartphone size={15}/>}
        {loading ? "Gerando..." : "Pagar Agora"}
      </button>
    </div>
  );
}

export default function PortalDashboard({ cliente, onLogout }) {
  const [data, setData] = useState<any>(null);
  const [extrato, setExtrato] = useState<any>(null);
  const [payData, setPayData] = useState<any>(null);
  const [mpOk, setMpOk] = useState<any>(null);
  const token = localStorage.getItem("aciapa_portal_token");

  const api = (url, opts: any = {}) =>
    fetch(url, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(opts.headers || {}),
      },
    });

  const load = () => {
    api("/api/portal/me").then(r => r.json()).then(setData).catch(() => {});
    api("/api/portal/extrato").then(r => r.json()).then(setExtrato).catch(() => {});
    api("/api/mercado-pago/config").then(r => r.json()).then(setMpOk).catch(() => setMpOk({ configured: false }));
  };

  useEffect(() => { load(); }, []);

  const handlePaid = ({ mes, ano }) => {
    load();
  };

  if (!data) {
    return (
      <div style={{ background: C.bg, minHeight: "100vh" }} className="flex items-center justify-center">
        <span style={{ width: 28, height: 28, borderRadius: "50%", border: "3px solid #6366f1", borderTopColor: "transparent", display: "inline-block", animation: "spin 0.6s linear infinite" }} />
      </div>
    );
  }

  const situacao = data._situacao;
  const corSit =
    situacao === "em_dia" ? C.green :
    situacao === "atrasado" ? C.red :
    situacao === "vencendo" ? C.amber : C.cyan;
  const labelSit =
    situacao === "em_dia" ? "Em Dia" :
    situacao === "atrasado" ? "Em Atraso" :
    situacao === "vencendo" ? "Vencendo" : "A Vencer";

  const pagar = (h) => {
    setPayData({ mes: h.mesNum, ano: h.ano || new Date().getFullYear(), valor: data.valor, nome: data.nome });
  };

  return (
    <div style={{ background: C.bg, minHeight: "100vh" }} className="p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div
              style={{
                background: "linear-gradient(135deg,#6366f1,#8b5cf6)", width: 40, height: 40,
                borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 0 24px rgba(99,102,241,0.3)",
              }}
            >
              <Zap size={20} color="white" />
            </div>
            <div>
              <div style={{ color: C.text }} className="font-extrabold text-lg">ACIAPA</div>
              <div style={{ color: C.indigo }} className="text-[10px] font-bold uppercase tracking-wider">Portal do Cliente</div>
            </div>
          </div>
          <button
            onClick={onLogout}
            style={{ color: C.muted, border: `1px solid ${C.border}` }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold hover:border-red-500/40 hover:text-red-400 transition-all"
          >
            <LogOut size={13} /> Sair
          </button>
        </div>

        {/* Welcome Card */}
        <div
          style={{
            background: `linear-gradient(135deg,${corSit}15,${C.card})`,
            border: `1px solid ${corSit}30`,
            borderRadius: 20, padding: 24,
          }}
          className="mb-4"
        >
          <div className="flex items-start justify-between">
            <div>
              <div style={{ color: C.text }} className="font-bold text-xl">{data.nome}</div>
              <div style={{ color: C.sub }} className="text-sm mt-0.5">{data.plano}</div>
            </div>
            <span
              style={{
                background: `${corSit}18`, color: corSit,
                border: `1px solid ${corSit}30`, fontSize: 11,
                fontWeight: 800, padding: "4px 12px", borderRadius: 8,
              }}
            >
              {labelSit}
            </span>
          </div>
          <div style={{ color: C.text }} className="text-3xl font-extrabold mt-4 tabular-nums">
            {fmt(data.valor)}
            <span style={{ color: C.muted, fontSize: 14, fontWeight: 500 }}>/mês</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: "Total Pago", value: fmt(data.totalPago || 0), icon: DollarSign, color: C.green },
            { label: "Meses Pagos", value: data.mesesPagos || 0, icon: CheckCircle, color: C.cyan },
            { label: data._diasAtraso > 0 ? "Dias Atraso" : "Status", value: data._diasAtraso > 0 ? `${data._diasAtraso}d` : "OK", icon: data._diasAtraso > 0 ? AlertTriangle : CheckCircle, color: data._diasAtraso > 0 ? C.red : C.green },
          ].map(({ label, value, icon: Icon, color }) => (
            <div
              key={label}
              style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14 }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div style={{ background: `${color}15` }} className="w-7 h-7 rounded-lg flex items-center justify-center">
                  <Icon size={13} style={{ color }} />
                </div>
              </div>
              <div style={{ color, fontFamily: "monospace" }} className="font-extrabold text-lg tabular-nums">{value}</div>
              <div style={{ color: C.muted }} className="text-[10px] font-bold uppercase tracking-wider mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Payment History */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, overflow: "hidden" }} className="mb-4">
          <div style={{ borderBottom: `1px solid ${C.border}`, padding: "16px 20px" }}>
            <div style={{ color: C.text }} className="font-bold text-sm flex items-center gap-2">
              <CalendarDays size={14} style={{ color: C.indigo }} />
              Histórico de Pagamentos — {new Date().getFullYear()}
            </div>
          </div>
          {extrato ? (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 p-4">
              {extrato.historico.map(h => {
                const isPastDue = h.mesNum < new Date().getMonth() + 1 && !h.pago;
                const isCurrent = h.mesNum === new Date().getMonth() + 1;
                const canPay = !h.pago && h.mesNum <= new Date().getMonth() + 1;
                return (
                  <div
                    key={h.mesNum}
                    style={{
                      background: h.pago ? C.greenDim : isPastDue ? C.redDim : C.card,
                      border: `1px solid ${h.pago ? "rgba(34,197,94,0.25)" : isPastDue ? "rgba(244,63,94,0.2)" : C.border}`,
                      borderRadius: 10, padding: 10, textAlign: "center",
                      opacity: h.mesNum > new Date().getMonth() + 1 ? 0.3 : 1,
                    }}
                  >
                    <div style={{ color: h.pago ? C.green : isPastDue ? C.red : C.muted, fontSize: 10, fontWeight: 800 }}>
                      {h.mes}
                    </div>
                    <div style={{ color: h.pago ? C.green : isPastDue ? C.red : C.muted, fontSize: 16, fontWeight: 900, margin: "4px 0" }}>
                      {h.pago ? "✓" : isPastDue ? "!" : "—"}
                    </div>
                    <div style={{ color: h.pago ? C.green : C.muted, fontSize: 9, fontWeight: 700, marginBottom: canPay && mpOk?.configured ? 6 : 0 }}>
                      {h.pago ? "Pago" : h.mesNum > new Date().getMonth() + 1 ? "Futuro" : "Pendente"}
                    </div>
                    {canPay && mpOk?.configured && (
                      <button
                        onClick={() => pagar(h)}
                        style={{
                          background: C.indigo, color: "white", fontSize: 9,
                          fontWeight: 800, borderRadius: 6, padding: "3px 8px",
                          width: "100%",
                        }}
                        className="hover:opacity-80 transition-opacity"
                      >
                        Pagar
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 text-center" style={{ color: C.muted }}>
              Carregando histórico...
            </div>
          )}
        </div>

        {/* Payment Modal */}
        {payData && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", zIndex: 1000 }} className="flex items-center justify-center p-4">
            <PaymentModal
              data={payData}
              onClose={() => setPayData(null)}
              api={api}
              onPaid={handlePaid}
            />
          </div>
        )}

        {/* Contact / Actions */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 20 }} className="mb-6">
          <div style={{ color: C.text }} className="font-bold text-sm mb-3">Precisa de ajuda?</div>
          <div className="flex gap-3">
            {data.telefone && (
              <a
                href={`https://wa.me/55${data.telefone.replace(/\D/g, "")}?text=Olá! Tenho dúvidas sobre minha mensalidade.`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: "rgba(37,211,102,0.12)", border: "1px solid rgba(37,211,102,0.25)",
                  color: "#25d366", flex: 1,
                }}
                className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold hover:bg-green-500/20 transition-colors"
              >
                <MessageSquare size={15} /> Falar no WhatsApp
              </a>
            )}
          </div>
        </div>

        <div style={{ color: C.muted, fontSize: 11, textAlign: "center" }}>
          ACIAPA © {new Date().getFullYear()} — Gestão Empresarial Inteligente
        </div>
      </div>
    </div>
  );
}
