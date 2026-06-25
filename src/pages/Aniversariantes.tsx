import { useState, useEffect } from "react";
import { C } from "../constants.js";
import { Gift, Plus, Edit, Trash2, Save, RefreshCw, Search, X } from "lucide-react";
import { Modal } from "../components/ui/Modal.jsx";

export default function Aniversariantes({ toast, api }) {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editM, setEditM] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api("/api/aniversariantes");
      const d = await r.json();
      setList(d);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const del = async id => {
    if (!confirm("Excluir?")) return;
    await api(`/api/aniversariantes/${id}`, { method: "DELETE" });
    toast("Excluído", "info");
    load();
  };

  const filtered = list.filter(a =>
    !search || a.nome?.toLowerCase().includes(search.toLowerCase())
  );

  const hoje = new Date();
  const hojeMD = `${hoje.getMonth()}-${hoje.getDate()}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div style={{ color: C.text }} className="font-bold text-lg">Aniversariantes</div>
          <div style={{ color: C.muted }} className="text-xs mt-0.5">{list.length} cadastrados</div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditM({})} style={{ background: `linear-gradient(135deg,#ec4899,#be185d)`, color: "white", boxShadow: `0 0 20px #ec489930` }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-extrabold hover:opacity-90">
            <Plus size={15} />Novo Aniversariante
          </button>
        </div>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}` }} className="rounded-2xl p-4 flex gap-3 flex-wrap items-center">
        <div className="flex-1 min-w-48 flex items-center gap-2" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "0 12px" }}>
          <Search size={14} style={{ color: C.muted }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar nome..." style={{ background: "transparent", color: C.text, flex: 1, padding: "10px 0", border: "none", outline: "none", fontSize: 13 }} className="placeholder-slate-600" />
          {search && <button onClick={() => setSearch("")}><X size={13} style={{ color: C.muted }} /></button>}
        </div>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}` }} className="rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center"><RefreshCw size={24} style={{ color: C.indigo }} className="animate-spin mx-auto" /></div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ background: C.card2, borderBottom: `1px solid ${C.border}` }}>
                {["", "Nome", "Data de Nascimento", "Idade", "Status", "Ações"].map(h =>
                  <th key={h} style={{ color: C.muted, padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => {
                const p = a.dataNascimento?.split("-");
                const dn = p && p.length >= 3 ? { y: +p[0], m: +p[1], d: +p[2] } : null;
                const isHoje = dn ? dn.m === hoje.getMonth() + 1 && dn.d === hoje.getDate() : false;
                const dif = dn ? Math.round((new Date(hoje.getFullYear(), dn.m - 1, dn.d).getTime() - hoje.getTime()) / 86400000) : 99;
                const isProximo = dif >= 0 && dif <= 2 && !isHoje;
                const idade = dn ? hoje.getFullYear() - dn.y - (hoje.getTime() < new Date(hoje.getFullYear(), dn.m - 1, dn.d).getTime() ? 1 : 0) : null;
                return (
                  <tr key={a.id} style={{
                    borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : "none",
                    background: isHoje ? "#ec489915" : isProximo ? `${C.redDim}` : "transparent"
                  }} className="hover:bg-white/[0.015] transition-colors">
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{
                        background: isHoje ? "linear-gradient(135deg,#ec4899,#be185d)" : isProximo ? C.redDim : C.indigoDim,
                        color: isHoje ? "white" : isProximo ? C.red : C.indigo,
                        border: `1px solid ${isHoje ? "#ec4899" : isProximo ? C.red : C.indigoBorder}`
                      }} className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-extrabold flex-shrink-0">
                        {isHoje ? <Gift size={14} /> : a.nome?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{
                        color: isHoje ? "#ec4899" : isProximo ? C.red : C.text,
                        fontWeight: isHoje || isProximo ? 800 : 600
                      }} className="text-sm">
                        {a.nome}
                        {isHoje && <span style={{ color: "#ec4899", fontSize: 10 }} className="ml-2 font-bold">HOJE!</span>}
                        {isProximo && <span style={{ color: C.red, fontSize: 10 }} className="ml-2 font-bold">em {dif} dia{dif !== 1 ? "s" : ""}</span>}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ color: C.sub, fontFamily: "monospace" }} className="text-xs">
                        {dn ? `${String(dn.d).padStart(2,"0")}/${String(dn.m).padStart(2,"0")}/${dn.y}` : "—"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ color: C.muted }} className="text-xs">{idade !== null ? `${idade} anos` : "—"}</span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{
                        color: isHoje ? "#ec4899" : isProximo ? C.amber : C.green,
                        background: `${isHoje ? "#ec4899" : isProximo ? C.amber : C.green}18`,
                        border: `1px solid ${isHoje ? "#ec4899" : isProximo ? C.amber : C.green}30`
                      }} className="text-[10px] font-bold px-2 py-0.5 rounded-md">
                        {isHoje ? "Aniversariando" : isProximo ? "Próximo" : "OK"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setEditM(a)} style={{ color: C.muted, border: `1px solid ${C.border}` }} className="w-7 h-7 rounded-lg flex items-center justify-center hover:text-white hover:border-white/20 transition-colors"><Edit size={12} /></button>
                        <button onClick={() => del(a.id)} style={{ color: C.red, background: C.redDim }} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-500/20 transition-colors"><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {!loading && filtered.length === 0 && (
          <div className="py-16 text-center">
            <Gift size={36} style={{ color: C.muted }} className="mx-auto mb-3 opacity-30" />
            <p style={{ color: C.muted }} className="text-sm">Nenhum aniversariante encontrado</p>
          </div>
        )}
      </div>

      <Modal open={editM !== null} onClose={() => { setEditM(null); load(); }} title={editM?.id ? "Editar Aniversariante" : "Novo Aniversariante"}>
        {editM !== null && <FormAniversariante initial={editM} api={api} onSaved={() => { setEditM(null); load(); toast(editM?.id ? "Atualizado!" : "Cadastrado!", "success"); }} />}
      </Modal>
    </div>
  );
}

function FormAniversariante({ initial, api, onSaved }) {
  const blank = { nome: "", dataNascimento: "" };
  const [form, setForm] = useState({ ...blank, ...initial });
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!form.nome.trim()) return alert("Nome obrigatório");
    if (!form.dataNascimento) return alert("Data de nascimento obrigatória");
    setLoading(true);
    if (form.id) await api(`/api/aniversariantes/${form.id}`, { method: "PUT", body: JSON.stringify(form) });
    else await api("/api/aniversariantes", { method: "POST", body: JSON.stringify(form) });
    setLoading(false);
    onSaved?.();
  };

  const F = (l, k, type = "text", ph = "") => (
    <div>
      <label style={{ color: C.sub }} className="text-xs font-bold mb-1.5 block uppercase tracking-wider">{l}</label>
      <input type={type} value={form[k] || ""} onChange={e => setForm({ ...form, [k]: e.target.value })} placeholder={ph}
        style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, width: "100%", borderRadius: 12, padding: "10px 14px", fontSize: 13, outline: "none" }}
        onFocus={e => e.target.style.borderColor = "#ec4899"} onBlur={e => e.target.style.borderColor = C.border} />
    </div>
  );

  return (
    <div style={{ background: C.card2, border: `1px solid ${C.border}` }} className="rounded-2xl p-5 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {F("Nome *", "nome", "text", "Nome completo")}
        {F("Data de Nascimento *", "dataNascimento", "date")}
      </div>
      <button onClick={submit} disabled={loading}
        style={{ background: `linear-gradient(135deg,#ec4899,#be185d)`, color: "white", boxShadow: `0 0 20px #ec489920`, opacity: loading ? 0.7 : 1 }}
        className="w-full py-3 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 hover:opacity-90">
        {loading ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
        {loading ? "Salvando..." : (form.id ? "Salvar Alterações" : "Cadastrar Aniversariante")}
      </button>
    </div>
  );
}
