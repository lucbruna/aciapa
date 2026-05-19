import { useState, useEffect } from "react";
import { C, fmt } from "../constants.js";
import { Receipt, Plus, Search, Trash2, X, Save, RefreshCw, TrendingUp, TrendingDown, Wallet, FileText, QrCode, Download, Printer } from "lucide-react";
import jsPDF from "jspdf";

export default function Contabilidade({ toast, api }) {
  const [lancamentos, setLancamentos] = useState<any[]>([]);
  const [notas, setNotas] = useState<any[]>([]);
  const [tab, setTab] = useState("lancamentos");
  const [search, setSearch] = useState("");
  const [tipo, setTipo] = useState("todos");
  const [showForm, setShowForm] = useState(false);
  const [showNF, setShowNF] = useState(false);
  const [showNota, setShowNota] = useState<any>(null);
  const [resumo, setResumo] = useState<any>(null);
  const [categorias, setCategorias] = useState<any[]>([]);

  const TABLES = [["lancamentos", "Lançamentos"], ["notas", "Notas Fiscais"]];

  const loadLanc = async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (tipo !== "todos") params.set("tipo", tipo);
    const r = await api(`/api/contabilidade?${params}`);
    setLancamentos(await r.json());
    const rr = await api("/api/contabilidade/resumo");
    setResumo(await rr.json());
    const rc = await api("/api/contabilidade/categorias");
    setCategorias(await rc.json());
  };

  const loadNFs = async () => {
    const r = await api("/api/notas-fiscais");
    setNotas(await r.json());
  };

  useEffect(() => {
    if (tab === "lancamentos") loadLanc();
    else loadNFs();
  }, [tab, search, tipo]);

  const save = async (form) => {
    if (!form.descricao) return toast("Descrição obrigatória", "error");
    await api("/api/contabilidade", { method: "POST", body: JSON.stringify(form) });
    toast("Lançamento registrado!", "success");
    setShowForm(false); loadLanc();
  };

  const delLanc = async (id) => {
    if (!confirm("Excluir lançamento?")) return;
    await api(`/api/contabilidade/${id}`, { method: "DELETE" });
    toast("Excluído!", "success"); loadLanc();
  };

  const emitirNF = async (form) => {
    if (!form.cliente || !form.valorTotal) return toast("Cliente e valor obrigatórios", "error");
    await api("/api/notas-fiscais", { method: "POST", body: JSON.stringify(form) });
    toast("Nota fiscal emitida!", "success");
    setShowNF(false); loadNFs();
  };

  const chaveFormatada = chave => String(chave || "").replace(/(.{4})/g, "$1 ").trim();

  const imprimirDANFE = nf => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const dark = [20, 24, 34], gray = [90, 96, 110], line = [30, 36, 50], green = [22, 163, 74];
    const data = nf.dataEmissao ? new Date(nf.dataEmissao).toLocaleString("pt-BR") : "";
    const addBox = (x, y, w, h, title, value, size = 9) => {
      doc.setDrawColor(line[0],line[1],line[2]); doc.rect(x, y, w, h);
      doc.setTextColor(gray[0],gray[1],gray[2]); doc.setFont("helvetica", "bold"); doc.setFontSize(6.5);
      doc.text(title, x + 2, y + 4);
      doc.setTextColor(dark[0],dark[1],dark[2]); doc.setFont("helvetica", "normal"); doc.setFontSize(size);
      doc.text(String(value || "-"), x + 2, y + 9, { maxWidth: w - 4 });
    };

    doc.setFillColor(245, 247, 250); doc.rect(0, 0, 210, 297, "F");
    doc.setFillColor(255, 255, 255); doc.rect(8, 8, 194, 281, "F");
    doc.setDrawColor(line[0],line[1],line[2]); doc.rect(10, 10, 190, 24);
    doc.setFont("helvetica", "bold"); doc.setTextColor(dark[0],dark[1],dark[2]); doc.setFontSize(15);
    doc.text(nf.emitente || "ACIAPA Gestao", 14, 19);
    doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.setTextColor(gray[0],gray[1],gray[2]);
    doc.text(`CNPJ: ${nf.emitenteCnpj || "-"}  IE: ISENTO`, 14, 25);
    doc.text(nf.emitenteEndereco || "Endereco nao informado", 14, 30, { maxWidth: 110 });
    doc.setFont("helvetica", "bold"); doc.setTextColor(dark[0],dark[1],dark[2]); doc.setFontSize(13);
    doc.text("DANFE", 153, 18);
    doc.setFontSize(7); doc.text("Documento Auxiliar da Nota Fiscal Eletronica", 126, 24);
    doc.setFont("helvetica", "normal"); doc.text(`NF-e No ${nf.numero || "-"}  Serie ${nf.serie || "001"}`, 140, 30);

    addBox(10, 38, 130, 18, "CHAVE DE ACESSO", chaveFormatada(nf.chaveAcesso), 8);
    addBox(142, 38, 58, 18, "PROTOCOLO DE AUTORIZACAO", `${nf.chaveAcesso?.slice(-15) || "-"} - ${data}`, 7);
    addBox(10, 60, 60, 16, "NATUREZA DA OPERACAO", nf.natureza || "Venda de mercadoria / prestacao de servico", 8);
    addBox(72, 60, 38, 16, "MODELO / SERIE", `${nf.modelo || "55"} / ${nf.serie || "001"}`, 8);
    addBox(112, 60, 42, 16, "DATA DE EMISSAO", data, 8);
    addBox(156, 60, 44, 16, "STATUS", String(nf.status || "autorizada").toUpperCase(), 8);

    doc.setFont("helvetica", "bold"); doc.setTextColor(dark[0],dark[1],dark[2]); doc.setFontSize(8);
    doc.text("DESTINATARIO / REMETENTE", 10, 84);
    addBox(10, 87, 92, 18, "NOME / RAZAO SOCIAL", nf.cliente, 9);
    addBox(104, 87, 48, 18, "CPF / CNPJ", nf.cpfCnpj || "Nao informado", 9);
    addBox(154, 87, 46, 18, "DATA DA OPERACAO", data, 8);

    doc.text("DADOS DO PRODUTO / SERVICO", 10, 114);
    doc.setDrawColor(line[0],line[1],line[2]); doc.rect(10, 118, 190, 46);
    doc.setFillColor(245, 247, 250); doc.rect(10, 118, 190, 8, "F");
    doc.setFontSize(7); doc.setFont("helvetica", "bold"); doc.setTextColor(gray[0],gray[1],gray[2]);
    doc.text("COD", 12, 123); doc.text("DESCRICAO", 28, 123); doc.text("QTD", 132, 123); doc.text("V. UNIT.", 150, 123); doc.text("V. TOTAL", 174, 123);
    doc.setFont("helvetica", "normal"); doc.setTextColor(dark[0],dark[1],dark[2]);
    doc.text("001", 12, 132);
    doc.text(nf.descricao || "Servicos / produtos conforme proposta comercial", 28, 132, { maxWidth: 95 });
    doc.text("1", 134, 132);
    doc.text(fmt(nf.valorTotal || 0), 148, 132);
    doc.text(fmt(nf.valorTotal || 0), 174, 132);

    const base = Number(nf.valorTotal || 0), imposto = base * 0.06;
    addBox(10, 170, 38, 16, "BASE DE CALCULO", fmt(base), 8);
    addBox(50, 170, 38, 16, "ICMS / ISS EST.", fmt(imposto), 8);
    addBox(90, 170, 36, 16, "DESCONTO", fmt(0), 8);
    addBox(128, 170, 36, 16, "OUTRAS DESP.", fmt(0), 8);
    addBox(166, 170, 34, 16, "VALOR TOTAL", fmt(base), 8);

    doc.setFont("helvetica", "bold"); doc.setTextColor(dark[0],dark[1],dark[2]); doc.setFontSize(8);
    doc.text("CONSULTA VIA QR CODE", 10, 196);
    if (nf.qrCode) doc.addImage(nf.qrCode, "PNG", 10, 200, 36, 36);
    doc.setFont("helvetica", "normal"); doc.setTextColor(gray[0],gray[1],gray[2]); doc.setFontSize(7.5);
    doc.text("Aponte a camera para consultar a chave de acesso nos servicos da SEFAZ.", 52, 206, { maxWidth: 86 });
    doc.text(`Ambiente: ${nf.ambiente || "Homologacao"}`, 52, 214);
    doc.text(`Chave: ${chaveFormatada(nf.chaveAcesso)}`, 52, 222, { maxWidth: 86 });
    doc.setDrawColor(green[0],green[1],green[2]); doc.setTextColor(green[0],green[1],green[2]); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text("NF-e AUTORIZADA", 156, 208);
    doc.setFontSize(7); doc.text("Modelo visual padrao Brasil para controle interno.", 139, 216);
    addBox(10, 244, 190, 24, "INFORMACOES COMPLEMENTARES", "Documento gerado pelo ACIAPA. Emissao fiscal real depende de certificado digital, autorizacao SEFAZ/prefeitura e configuracao tributaria do emitente.", 7.5);
    doc.save(`danfe_nfe_${nf.numero || Date.now()}.pdf`);
    toast("DANFE com QR Code gerado", "success");
  };

  const LancForm = ({ onSave, onCancel }) => {
    const [f, setF] = useState({ tipo: "receita", descricao: "", valor: 0, data: new Date().toISOString().split("T")[0], categoria: "", conta: "" });
    const I = (l, k, type = "text") => (
      <div><label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color: C.sub }}>{l}</label>
        <input type={type} value={f[k] ?? ""} onChange={e => setF({ ...f, [k]: type === "number" ? +e.target.value : e.target.value })}
          style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, width: "100%", borderRadius: 12, padding: "8px 12px", fontSize: 13, outline: "none" }} /></div>
    );
    return (
      <div style={{ background: C.card2, border: `1px solid ${C.indigoBorder}`, borderRadius: 16, padding: 16 }} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color: C.sub }}>Tipo</label>
            <select value={f.tipo} onChange={e => setF({ ...f, tipo: e.target.value })}
              style={{ background: C.surface, border: `1px solid ${C.border}`, color: f.tipo === "receita" ? C.green : C.red, width: "100%", borderRadius: 12, padding: "8px 12px", fontSize: 13, outline: "none" }}>
              <option value="receita">Receita</option><option value="despesa">Despesa</option></select></div>
          {I("Valor (R$)", "valor", "number")}
        </div>
        <div className="grid grid-cols-2 gap-3">{I("Descrição", "descricao")}{I("Data", "data", "date")}</div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color: C.sub }}>Categoria</label>
            <select value={f.categoria} onChange={e => setF({ ...f, categoria: e.target.value })}
              style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, width: "100%", borderRadius: 12, padding: "8px 12px", fontSize: 13, outline: "none" }}>
              <option value="">Selecione</option>
              {[...new Set([...categorias, "Serviços", "Produtos", "Imóvel", "Pessoal", "Impostos", "Outros"])].map(c => <option key={c}>{c}</option>)}
            </select></div>
          {I("Conta", "conta")}
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} style={{ border: `1px solid ${C.border}`, color: C.muted }} className="flex-1 py-2.5 rounded-xl text-sm">Cancelar</button>
          <button onClick={() => onSave(f)} style={{ background: `linear-gradient(135deg,${C.indigo},${C.purple})`, color: "white" }} className="flex-1 py-2.5 rounded-xl text-sm font-bold hover:opacity-90"><Save size={14} className="inline mr-1" />Salvar</button>
        </div>
      </div>
    );
  };

  const NFForm = ({ onSave, onCancel }) => {
    const [f, setF] = useState({ cliente: "", cpfCnpj: "", descricao: "", natureza: "Venda de mercadoria / prestacao de servico", valorTotal: 0 });
    return (
      <div style={{ background: C.card2, border: `1px solid ${C.indigoBorder}`, borderRadius: 16, padding: 16 }} className="space-y-3">
        <div className="flex items-center gap-2 mb-2"><FileText size={16} style={{ color: C.indigo }} /><span className="text-sm font-bold" style={{ color: C.text }}>Nova Nota Fiscal</span></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color: C.sub }}>Cliente *</label>
            <input value={f.cliente} onChange={e => setF({ ...f, cliente: e.target.value })} style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, width: "100%", borderRadius: 12, padding: "8px 12px", fontSize: 13, outline: "none" }} /></div>
          <div><label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color: C.sub }}>CPF/CNPJ</label>
            <input value={f.cpfCnpj} onChange={e => setF({ ...f, cpfCnpj: e.target.value })} style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, width: "100%", borderRadius: 12, padding: "8px 12px", fontSize: 13, outline: "none" }} /></div>
        </div>
        <div><label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color: C.sub }}>Descrição</label>
          <input value={f.descricao} onChange={e => setF({ ...f, descricao: e.target.value })} style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, width: "100%", borderRadius: 12, padding: "8px 12px", fontSize: 13, outline: "none" }} /></div>
        <div><label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color: C.sub }}>Natureza da operaÃ§Ã£o</label>
          <input value={f.natureza} onChange={e => setF({ ...f, natureza: e.target.value })} style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, width: "100%", borderRadius: 12, padding: "8px 12px", fontSize: 13, outline: "none" }} /></div>
        <div><label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color: C.sub }}>Valor Total (R$) *</label>
          <input type="number" value={f.valorTotal} onChange={e => setF({ ...f, valorTotal: +e.target.value })} style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.indigo, width: "100%", borderRadius: 12, padding: "8px 12px", fontSize: 13, outline: "none", fontFamily: "monospace", fontWeight: 700 }} /></div>
        <div className="flex gap-2">
          <button onClick={onCancel} style={{ border: `1px solid ${C.border}`, color: C.muted }} className="flex-1 py-2.5 rounded-xl text-sm">Cancelar</button>
          <button onClick={() => onSave(f)} style={{ background: `linear-gradient(135deg,${C.green},${C.cyan})`, color: "white" }} className="flex-1 py-2.5 rounded-xl text-sm font-bold hover:opacity-90"><FileText size={14} className="inline mr-1" />Emitir NF</button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><div className="font-bold text-lg" style={{ color: C.text }}>Contabilidade</div>
          <div className="text-xs mt-0.5" style={{ color: C.muted }}>Gestão contábil, notas fiscais e DRE</div></div>
        <div className="flex gap-2">
          {tab === "lancamentos" && <button onClick={() => setShowForm(true)} style={{ background: `linear-gradient(135deg,${C.indigo},${C.purple})`, color: "white" }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold hover:opacity-90"><Plus size={15} />Novo Lançamento</button>}
          {tab === "notas" && <button onClick={() => setShowNF(true)} style={{ background: `linear-gradient(135deg,${C.green},${C.cyan})`, color: "white" }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold hover:opacity-90"><Plus size={15} />Emitir NF</button>}
        </div>
      </div>

      <div className="flex gap-1 p-1 rounded-xl" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        {TABLES.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ background: tab === k ? C.indigoDim : "transparent", color: tab === k ? C.indigo : C.muted, border: `1px solid ${tab === k ? C.indigoBorder : "transparent"}` }}
            className="flex-1 py-2 rounded-xl text-xs font-bold transition-all">{l}</button>
        ))}
      </div>

      {tab === "lancamentos" && (
        <>
          {resumo && (
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Receitas", value: fmt(resumo.receitas), icon: TrendingUp, color: C.green },
                { label: "Despesas", value: fmt(resumo.despesas), icon: TrendingDown, color: C.red },
                { label: "Saldo", value: fmt(resumo.saldo), icon: Wallet, color: resumo.saldo >= 0 ? C.cyan : C.amber },
              ].map(c => (
                <div key={c.label} style={{ background: C.card, border: `1px solid ${c.color}25`, borderRadius: 16, padding: 16 }}>
                  <div className="flex items-center gap-3 mb-2">
                    <div style={{ background: `${c.color}15` }} className="w-9 h-9 rounded-xl flex items-center justify-center"><c.icon size={16} style={{ color: c.color }} /></div>
                    <span className="text-xs font-bold" style={{ color: C.muted }}>{c.label}</span>
                  </div>
                  <div style={{ color: c.color, fontFamily: "monospace" }} className="text-xl font-extrabold">{c.value}</div>
                </div>
              ))}
            </div>
          )}

          {showForm && <LancForm onSave={save} onCancel={() => setShowForm(false)} />}

          <div className="flex gap-3 items-center">
            <div style={{ flex: 1, position: "relative" }}>
              <Search size={14} style={{ color: C.muted, position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar lançamento..." style={{ background: C.card, border: `1px solid ${C.border}`, color: C.text, width: "100%", borderRadius: 12, padding: "10px 14px 10px 36px", fontSize: 13, outline: "none" }} />
            </div>
            <select value={tipo} onChange={e => setTipo(e.target.value)} style={{ background: C.card, border: `1px solid ${C.border}`, color: C.text, borderRadius: 12, padding: "10px 14px", fontSize: 13, outline: "none" }}>
              <option value="todos">Todos</option><option value="receita">Receitas</option><option value="despesa">Despesas</option>
            </select>
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden" }}>
            <table className="w-full">
              <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {["Tipo", "Descrição", "Categoria", "Valor", "Data", "Conta", "Ações"].map(h => (
                  <th key={h} style={{ color: C.muted, padding: "10px 12px", textAlign: "left", fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {lancamentos.map((l, i) => (
                  <tr key={l.id} style={{ borderBottom: i < lancamentos.length - 1 ? `1px solid ${C.border}` : "none" }} className="hover:bg-white/[0.02]">
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ color: l.tipo === "receita" ? C.green : C.red, fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 6, background: l.tipo === "receita" ? C.greenDim : C.redDim }}>
                        {l.tipo === "receita" ? "RECEITA" : "DESPESA"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", color: C.text, fontSize: 13, fontWeight: 600 }}>{l.descricao}</td>
                    <td style={{ padding: "10px 12px", color: C.sub, fontSize: 12 }}>{l.categoria}</td>
                    <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: l.tipo === "receita" ? C.green : C.red }}>{l.tipo === "receita" ? "+" : "-"}{fmt(l.valor)}</td>
                    <td style={{ padding: "10px 12px", color: C.muted, fontSize: 12 }}>{l.data ? new Date(l.data).toLocaleDateString("pt-BR") : ""}</td>
                    <td style={{ padding: "10px 12px", color: C.muted, fontSize: 12 }}>{l.conta || "—"}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <button onClick={() => delLanc(l.id)} style={{ color: C.red }} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-500/10"><Trash2 size={11} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "notas" && (
        <>
          {showNF && <NFForm onSave={emitirNF} onCancel={() => setShowNF(false)} />}

          <div className="grid gap-3">
            {notas.map(nf => (
              <div key={nf.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16 }}
                className="flex items-center gap-4 hover:border-white/10 transition-colors cursor-pointer"
                onClick={() => setShowNota(nf)}>
                <div style={{ background: `${C.indigo}15` }} className="w-10 h-10 rounded-xl flex items-center justify-center"><FileText size={18} style={{ color: C.indigo }} /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: C.text }}>NF-e #{nf.numero}</span>
                    <span style={{ background: `${C.green}15`, color: C.green, border: `1px solid ${C.green}30`, fontSize: 9, fontWeight: 800, padding: "1px 6px", borderRadius: 4 }}>{nf.status}</span>
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: C.sub }}>{nf.cliente} · {fmt(nf.valorTotal)}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: C.muted }}>Chave: {chaveFormatada(nf.chaveAcesso)}</div>
                </div>
                <div className="flex gap-1">
                  {nf.qrCode && <img src={nf.qrCode} alt="QR" style={{ width: 48, height: 48, borderRadius: 8 }} />}
                </div>
              </div>
            ))}
          </div>

          {showNota && (
            <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(2,4,8,0.92)", backdropFilter: "blur(8px)" }} className="flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setShowNota(null)}>
              <div style={{ background: C.card, border: `1px solid ${C.border2}`, borderRadius: 20, width: "100%", maxWidth: 520, padding: 24 }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2"><FileText size={18} style={{ color: C.indigo }} /><span className="font-bold text-base" style={{ color: C.text }}>Nota Fiscal #{showNota.numero}</span></div>
                  <button onClick={() => setShowNota(null)} style={{ color: C.muted }}><X size={18} /></button>
                </div>
                <div className="space-y-3 text-sm">
                  <div style={{ background: C.surface, borderRadius: 12, padding: 16 }} className="space-y-2">
                    <div className="flex justify-between"><span style={{ color: C.muted }}>Cliente</span><span style={{ color: C.text, fontWeight: 600 }}>{showNota.cliente}</span></div>
                    <div className="flex justify-between"><span style={{ color: C.muted }}>CPF/CNPJ</span><span style={{ color: C.text }}>{showNota.cpfCnpj || "—"}</span></div>
                    <div className="flex justify-between"><span style={{ color: C.muted }}>Valor</span><span style={{ color: C.green, fontFamily: "monospace", fontWeight: 700 }}>{fmt(showNota.valorTotal)}</span></div>
                    <div className="flex justify-between"><span style={{ color: C.muted }}>Data</span><span style={{ color: C.sub }}>{showNota.dataEmissao ? new Date(showNota.dataEmissao).toLocaleString("pt-BR") : ""}</span></div>
                    <div className="flex justify-between"><span style={{ color: C.muted }}>Status</span><span style={{ color: C.green, fontWeight: 700 }}>Autorizada</span></div>
                  </div>
                  <div style={{ background: C.surface, borderRadius: 12, padding: 16 }}>
                    <div className="text-xs font-bold mb-2" style={{ color: C.sub }}>Chave de Acesso</div>
                    <div className="text-xs font-mono font-bold" style={{ color: C.indigo, wordBreak: "break-all" }}>{chaveFormatada(showNota.chaveAcesso)}</div>
                  </div>
                  {showNota.qrCode && (
                    <div className="flex justify-center">
                      <img src={showNota.qrCode} alt="QR Code" style={{ width: 140, height: 140, borderRadius: 12, border: `1px solid ${C.border}` }} />
                    </div>
                  )}
                  <div style={{ background: C.surface, borderRadius: 12, padding: 12 }} className="flex gap-2">
                    <button onClick={() => window.open(showNota.qrCode, "_blank")} style={{ background: C.indigoDim, color: C.indigo, border: `1px solid ${C.indigoBorder}` }} className="flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1"><QrCode size={13} />QR Code</button>
                    <button onClick={() => imprimirDANFE(showNota)} style={{ background: C.greenDim, color: C.green, border: `1px solid rgba(34,197,94,0.3)` }} className="flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1"><Printer size={13} />DANFE PDF</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
