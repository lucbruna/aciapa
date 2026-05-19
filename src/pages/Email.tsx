import { useState, useEffect } from "react";
import { C } from "../constants.js";
import { Mail, Send, Plus, Search, Trash2, X, RefreshCw, Inbox, SendHorizonal, Star, Archive, ChevronRight } from "lucide-react";

export default function Email({ toast, api }) {
  const [emails, setEmails] = useState<any[]>([]);
  const [pasta, setPasta] = useState("inbox");
  const [search, setSearch] = useState("");
  const [showCompose, setShowCompose] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [naoLidos, setNaoLidos] = useState(0);

  const pastas = [
    { id: "inbox", label: "Recebidos", icon: Inbox },
    { id: "enviados", label: "Enviados", icon: SendHorizonal },
    { id: "arquivados", label: "Arquivados", icon: Archive },
  ];

  const load = async () => {
    const params = new URLSearchParams({ pasta });
    if (search) params.set("search", search);
    const r = await api(`/api/emails?${params}`);
    setEmails(await r.json());
    const nr = await api("/api/emails/nao-lidos");
    const nd = await nr.json();
    setNaoLidos(nd.total || 0);
  };

  useEffect(() => { load(); }, [pasta, search]);

  const sendEmail = async (form) => {
    if (!form.para || !form.assunto) return toast("Destinatário e assunto obrigatórios", "error");
    await api("/api/emails", { method: "POST", body: JSON.stringify({ ...form, pasta: "enviados", de: "eu@aciapa.com", lido: true }) });
    toast("E-mail enviado!", "success");
    setShowCompose(false);
    if (pasta === "enviados") load();
  };

  const del = async (id) => {
    if (!confirm("Excluir e-mail?")) return;
    await api(`/api/emails/${id}`, { method: "DELETE" });
    toast("E-mail excluído!", "success");
    if (selected?.id === id) setSelected(null);
    load();
  };

  const marcarLido = async (email) => {
    if (!email.lido) {
      await api(`/api/emails/${email.id}`, { method: "PUT", body: JSON.stringify({ lido: true }) });
      load();
    }
    setSelected(email);
  };

  const arquivar = async (email) => {
    const novaPasta = email.pasta === "arquivados" ? "inbox" : "arquivados";
    await api(`/api/emails/${email.id}`, { method: "PUT", body: JSON.stringify({ pasta: novaPasta }) });
    toast(novaPasta === "arquivados" ? "Arquivado!" : "Restaurado!", "success");
    setSelected(null); load();
  };

  const ComposeForm = ({ onSend, onCancel }) => {
    const [f, setF] = useState({ para: "", assunto: "", corpo: "" });
    return (
      <div style={{ background: C.card2, border: `1px solid ${C.indigoBorder}`, borderRadius: 16, padding: 16 }} className="space-y-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold" style={{ color: C.text }}>Novo E-mail</span>
          <button onClick={onCancel} style={{ color: C.muted }}><X size={16} /></button>
        </div>
        <div><label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color: C.sub }}>Para</label>
          <input value={f.para} onChange={e => setF({ ...f, para: e.target.value })} placeholder="email@exemplo.com" style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, width: "100%", borderRadius: 12, padding: "10px 14px", fontSize: 13, outline: "none" }} /></div>
        <div><label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color: C.sub }}>Assunto</label>
          <input value={f.assunto} onChange={e => setF({ ...f, assunto: e.target.value })} placeholder="Assunto do e-mail" style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, width: "100%", borderRadius: 12, padding: "10px 14px", fontSize: 13, outline: "none" }} /></div>
        <div><label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color: C.sub }}>Mensagem</label>
          <textarea value={f.corpo} onChange={e => setF({ ...f, corpo: e.target.value })} rows={6} placeholder="Digite sua mensagem..." style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, width: "100%", borderRadius: 12, padding: "10px 14px", fontSize: 13, outline: "none", resize: "vertical" }} /></div>
        <button onClick={() => onSend(f)} style={{ background: `linear-gradient(135deg,${C.indigo},${C.purple})`, color: "white" }}
          className="w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90"><Send size={14} />Enviar</button>
      </div>
    );
  };

  return (
    <div className="flex gap-4 h-[calc(100vh-8rem)]">
      <div style={{ width: 200, flexShrink: 0 }} className="space-y-2">
        <button onClick={() => { setShowCompose(true); setSelected(null) }} style={{ background: `linear-gradient(135deg,${C.indigo},${C.purple})`, color: "white", width: "100%" }}
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold hover:opacity-90"><Plus size={15} />Novo E-mail</button>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 8 }} className="space-y-1">
          {pastas.map(p => (
            <button key={p.id} onClick={() => { setPasta(p.id); setSelected(null) }}
              style={{ background: pasta === p.id ? C.indigoDim : "transparent", color: pasta === p.id ? C.indigo : C.muted, borderLeft: `2px solid ${pasta === p.id ? C.indigo : "transparent"}` }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all hover:text-white">
              <p.icon size={15} />
              <span className="flex-1 text-left">{p.label}</span>
              {p.id === "inbox" && naoLidos > 0 && <span style={{ background: C.red, color: "white", fontSize: 9, fontWeight: 800, padding: "1px 5px", borderRadius: 8 }}>{naoLidos}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex gap-4 min-w-0">
        <div style={{ flex: selected ? "0 0 380px" : 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden" }} className="flex flex-col">
          <div style={{ borderBottom: `1px solid ${C.border}`, padding: "10px 14px" }} className="flex items-center gap-3">
            <div style={{ flex: 1, position: "relative" }}>
              <Search size={14} style={{ color: C.muted, position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, width: "100%", borderRadius: 10, padding: "8px 12px 8px 34px", fontSize: 12, outline: "none" }} />
            </div>
            <button onClick={load} style={{ color: C.muted }} className="p-1.5 rounded-lg hover:bg-white/5"><RefreshCw size={14} /></button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {emails.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16" style={{ color: C.muted }}>
                <Mail size={32} style={{ opacity: 0.3 }} />
                <span className="text-sm mt-2">Nenhum e-mail nesta pasta</span>
              </div>
            ) : emails.map(e => (
              <div key={e.id} onClick={() => marcarLido(e)}
                style={{ borderBottom: `1px solid ${C.border}`, background: selected?.id === e.id ? C.indigoDim : "transparent", cursor: "pointer", borderLeft: e.lido ? "transparent" : `2px solid ${C.indigo}` }}
                className="px-4 py-3 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold truncate" style={{ color: e.lido ? C.sub : C.text }}>{e.de || e.para}</span>
                  <span className="text-[10px]" style={{ color: C.muted }}>{e.data ? new Date(e.data).toLocaleDateString("pt-BR") : ""}</span>
                </div>
                <div className="text-sm font-medium truncate mt-0.5" style={{ color: e.lido ? C.muted : C.text }}>{e.assunto}</div>
                <div className="text-xs truncate mt-0.5" style={{ color: C.muted }}>{(e.corpo || "").substring(0, 80)}</div>
              </div>
            ))}
          </div>
        </div>

        {selected && (
          <div style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden" }} className="flex flex-col">
            <div style={{ borderBottom: `1px solid ${C.border}`, padding: "14px 18px" }} className="flex items-center justify-between">
              <span className="text-sm font-bold" style={{ color: C.text }}>{selected.assunto}</span>
              <div className="flex gap-1">
                <button onClick={() => arquivar(selected)} style={{ color: C.muted, border: `1px solid ${C.border}` }} className="w-7 h-7 rounded-lg flex items-center justify-center hover:text-white"><Archive size={11} /></button>
                <button onClick={() => { setShowCompose(true) }} style={{ color: C.muted, border: `1px solid ${C.border}` }} className="w-7 h-7 rounded-lg flex items-center justify-center hover:text-white"><Send size={11} /></button>
                <button onClick={() => del(selected.id)} style={{ color: C.red }} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-500/10"><Trash2 size={11} /></button>
              </div>
            </div>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}` }} className="space-y-1">
              <div className="text-xs"><span style={{ color: C.muted }}>De: </span><span style={{ color: C.text, fontWeight: 600 }}>{selected.de}</span></div>
              <div className="text-xs"><span style={{ color: C.muted }}>Para: </span><span style={{ color: C.text }}>{selected.para}</span></div>
              <div className="text-xs"><span style={{ color: C.muted }}>Data: </span><span style={{ color: C.sub }}>{selected.data ? new Date(selected.data).toLocaleString("pt-BR") : ""}</span></div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="text-sm whitespace-pre-wrap" style={{ color: C.text, lineHeight: 1.6 }}>{selected.corpo || "Sem conteúdo"}</div>
            </div>
          </div>
        )}
      </div>

      {showCompose && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(2,4,8,0.8)", backdropFilter: "blur(4px)" }} className="flex items-center justify-center p-4">
          <div style={{ width: "100%", maxWidth: 540, maxHeight: "90vh", overflow: "auto" }}>
            <ComposeForm onSend={sendEmail} onCancel={() => setShowCompose(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
