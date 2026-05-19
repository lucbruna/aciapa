import { useEffect, useMemo, useRef, useState } from "react";
import { C, fmt } from "../constants.js";
import {
  Briefcase,
  FileText,
  FolderOpen,
  Scale,
  Plus,
  Search,
  Save,
  Trash2,
  Upload,
  Download,
  Printer,
  Clock,
  CheckCircle,
  AlertTriangle,
  Gavel,
  Bot,
  Sparkles,
  Wand2,
} from "lucide-react";
import jsPDF from "jspdf";

const STATUS = [
  ["andamento", "Em andamento", C.cyan],
  ["julgado", "Julgado", C.amber],
  ["finalizado", "Finalizado", C.green],
  ["suspenso", "Suspenso", C.red],
];

const AREAS = ["Civel", "Trabalhista", "Familia", "Tributario", "Empresarial", "Consumidor", "Previdenciario", "Criminal"];

const MODELOS = {
  inicial:
    "EXCELENTISSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO\n\nProcesso/Distribuicao: {{numero}}\nParte autora: {{cliente}}\nParte contraria: {{parteContraria}}\n\nDOS FATOS\n{{objeto}}\n\nDO DIREITO\nExpor fundamentos legais, jurisprudencia e provas documentais.\n\nDOS PEDIDOS\n1. Recebimento da presente peticao;\n2. Citacao da parte contraria;\n3. Producao de provas;\n4. Procedencia dos pedidos.\n\nValor da causa: {{valorCausa}}.",
  contestacao:
    "EXCELENTISSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A)\n\nProcesso: {{numero}}\nRequerente: {{parteContraria}}\nRequerido: {{cliente}}\n\nCONTESTACAO\n\nSINTese DA DEMANDA\n{{objeto}}\n\nPRELIMINARES\nApontar preliminares cabiveis.\n\nMERITO\nImpugnar fatos, documentos e fundamentos.\n\nPEDIDOS\nRequer improcedencia, producao de provas e demais medidas cabiveis.",
  recurso:
    "RAZOES RECURSAIS\n\nProcesso: {{numero}}\nRecorrente: {{cliente}}\nRecorrido: {{parteContraria}}\n\nTEMPESTIVIDADE\nDemonstrar prazo e preparo quando aplicavel.\n\nSINTese DA DECISAO\nIndicar pontos da decisao recorrida.\n\nFUNDAMENTOS RECURSAIS\n{{estrategia}}\n\nPEDIDOS\nConhecimento e provimento do recurso.",
};

const TIPOS_IA = [
  "Peticao inicial",
  "Contestacao",
  "Recurso",
  "Manifestacao",
  "Carta",
  "Notificacao extrajudicial",
  "Contrato",
  "Parecer",
  "Acordo",
  "Outro documento juridico",
];

const processoVazio = {
  numero: "",
  cliente: "",
  parteContraria: "",
  area: "Civel",
  classe: "",
  tribunal: "",
  comarca: "",
  vara: "",
  fase: "Conhecimento",
  status: "andamento",
  rito: "",
  valorCausa: 0,
  prazo: "",
  responsavel: "",
  objeto: "",
  estrategia: "",
  risco: "medio",
  proximaAcao: "",
  documentos: "",
  andamento: "",
};

const peticaoVazia = {
  titulo: "",
  modelo: "inicial",
  processoId: "",
  cliente: "",
  parteContraria: "",
  conteudo: MODELOS.inicial,
  status: "rascunho",
};

function statusMeta(status) {
  return STATUS.find(([id]) => id === status) || STATUS[0];
}

function applyTemplate(template: string, processo: any = {}) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (key === "valorCausa") return fmt(processo.valorCausa || 0);
    return processo[key] || "";
  });
}

function Campo({ label, value, onChange, type = "text", children }: any) {
  return (
    <div>
      <label style={{ color: C.sub }} className="text-xs font-bold uppercase tracking-wider mb-1 block">{label}</label>
      {children || (
        <input
          type={type}
          value={value || ""}
          onChange={e => onChange(type === "number" ? +e.target.value : e.target.value)}
          style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, width: "100%", borderRadius: 10, padding: "9px 12px", fontSize: 13, outline: "none" }}
        />
      )}
    </div>
  );
}

export default function Advocacia({ toast, api }) {
  const [tab, setTab] = useState("processos");
  const [processos, setProcessos] = useState<any[]>([]);
  const [peticoes, setPeticoes] = useState<any[]>([]);
  const [arquivos, setArquivos] = useState<any[]>([]);
  const [resumo, setResumo] = useState<any>({});
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("todos");
  const [editProcesso, setEditProcesso] = useState<any>(null);
  const [editPeticao, setEditPeticao] = useState<any>(null);
  const [iaLoading, setIaLoading] = useState(false);
  const [iaForm, setIaForm] = useState({
    tipo: "Peticao inicial",
    processoId: "",
    titulo: "",
    orientacao: "",
  });
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const [p, pe, a, r] = await Promise.all([
      api("/api/advocacia/processos").then(x => x.json()).catch(() => []),
      api("/api/advocacia/peticoes").then(x => x.json()).catch(() => []),
      api("/api/advocacia/arquivos").then(x => x.json()).catch(() => []),
      api("/api/advocacia/resumo").then(x => x.json()).catch(() => ({})),
    ]);
    setProcessos(Array.isArray(p) ? p : []);
    setPeticoes(Array.isArray(pe) ? pe : []);
    setArquivos(Array.isArray(a) ? a : []);
    setResumo(r || {});
  };

  useEffect(() => { load(); }, []);

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase();
    return processos.filter(p => {
      if (status !== "todos" && p.status !== status) return false;
      if (!q) return true;
      return [p.numero, p.cliente, p.parteContraria, p.area, p.classe, p.responsavel]
        .some(v => String(v || "").toLowerCase().includes(q));
    });
  }, [processos, busca, status]);

  const salvarProcesso = async () => {
    if (!editProcesso?.cliente) return toast("Informe o cliente do processo", "error");
    const method = editProcesso.id ? "PUT" : "POST";
    const url = editProcesso.id ? `/api/advocacia/processos/${editProcesso.id}` : "/api/advocacia/processos";
    const r = await api(url, { method, body: JSON.stringify(editProcesso) });
    const d = await r.json();
    if (!d.ok) return toast(d.error || "Erro ao salvar", "error");
    toast("Processo salvo", "success");
    setEditProcesso(null);
    load();
  };

  const excluirProcesso = async id => {
    if (!confirm("Excluir este processo?")) return;
    await api(`/api/advocacia/processos/${id}`, { method: "DELETE" });
    toast("Processo excluido", "info");
    load();
  };

  const escolherProcessoPeticao = processoId => {
    const p = processos.find(x => x.id === processoId) || {};
    setEditPeticao(ep => ({
      ...ep,
      processoId,
      cliente: p.cliente || ep?.cliente || "",
      parteContraria: p.parteContraria || ep?.parteContraria || "",
      conteudo: applyTemplate(MODELOS[ep?.modelo || "inicial"], p),
    }));
  };

  const escolherProcessoIA = processoId => {
    const p = processos.find(x => x.id === processoId);
    setIaForm(f => ({
      ...f,
      processoId,
      titulo: f.titulo || (p ? `${f.tipo} - ${p.cliente || "cliente"}` : ""),
    }));
  };

  const gerarDocumentoIA = async () => {
    if (iaLoading) return;
    const processo = processos.find(p => p.id === iaForm.processoId);
    const prompt = [
      "Atue como assistente juridico para elaborar uma minuta de documento.",
      `Tipo de documento: ${iaForm.tipo}.`,
      "Escreva em portugues do Brasil, com linguagem juridica clara, humana e natural.",
      "Evite frases artificiais, repetitivas ou genericas. Mantenha tom profissional, persuasivo e revisavel por advogado.",
      "Nao invente fatos, jurisprudencia, numeros de processo, datas, artigos de lei ou provas que nao tenham sido informados.",
      "Quando faltar informacao, use campos entre colchetes para o advogado completar.",
      processo ? `Dados do processo: ${JSON.stringify({
        numero: processo.numero,
        cliente: processo.cliente,
        parteContraria: processo.parteContraria,
        area: processo.area,
        classe: processo.classe,
        tribunal: processo.tribunal,
        comarca: processo.comarca,
        vara: processo.vara,
        fase: processo.fase,
        valorCausa: processo.valorCausa,
        objeto: processo.objeto,
        estrategia: processo.estrategia,
        documentos: processo.documentos,
        andamento: processo.andamento,
      })}` : "Nao ha processo vinculado; use apenas as orientacoes informadas.",
      iaForm.orientacao ? `Orientacoes adicionais: ${iaForm.orientacao}` : "Orientacoes adicionais: criar uma minuta completa, organizada e pronta para revisao.",
      "Entregue somente o texto do documento, sem tabela, grafico ou explicacoes sobre como usar.",
      "Inclua um aviso discreto ao final: Minuta sujeita a revisao tecnica do advogado responsavel.",
    ].join("\n");

    setIaLoading(true);
    try {
      const r = await api("/api/ia/chat", { method: "POST", body: JSON.stringify({ mensagem: prompt }) });
      const d = await r.json();
      if (!r.ok) return toast(d.error || "Erro ao gerar documento com IA", "error");
      const conteudo = d.resposta || "";
      if (!conteudo.trim()) return toast("A IA nao retornou texto para a minuta", "warning");
      const titulo = iaForm.titulo || `${iaForm.tipo}${processo?.cliente ? ` - ${processo.cliente}` : ""}`;
      setEditPeticao({
        ...peticaoVazia,
        titulo,
        modelo: "inicial",
        processoId: processo?.id || "",
        cliente: processo?.cliente || "",
        parteContraria: processo?.parteContraria || "",
        conteudo,
        status: "rascunho",
      });
      setTab("peticoes");
      toast("Minuta gerada no editor de peticoes", "success");
    } catch (_) {
      toast("Erro ao consultar IA juridica", "error");
    } finally {
      setIaLoading(false);
    }
  };

  const salvarPeticao = async () => {
    if (!editPeticao?.titulo) return toast("Informe o titulo da peticao", "error");
    const method = editPeticao.id ? "PUT" : "POST";
    const url = editPeticao.id ? `/api/advocacia/peticoes/${editPeticao.id}` : "/api/advocacia/peticoes";
    const r = await api(url, { method, body: JSON.stringify(editPeticao) });
    const d = await r.json();
    if (!d.ok) return toast(d.error || "Erro ao salvar", "error");
    toast("Peticao salva", "success");
    setEditPeticao(null);
    load();
  };

  const excluirPeticao = async id => {
    if (!confirm("Excluir esta peticao?")) return;
    await api(`/api/advocacia/peticoes/${id}`, { method: "DELETE" });
    toast("Peticao excluida", "info");
    load();
  };

  const uploadArquivo = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("processoId", editProcesso?.id || "");
    const r = await fetch("/api/advocacia/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("aciapa_token")}` },
      body: fd,
    });
    const d = await r.json();
    if (d.ok) {
      toast("Arquivo importado", "success");
      load();
    } else {
      toast(d.error || "Erro ao importar arquivo", "error");
    }
    e.target.value = "";
  };

  const exportarExcel = async () => {
    const r = await fetch("/api/advocacia/export", {
      headers: { Authorization: `Bearer ${localStorage.getItem("aciapa_token")}` },
    });
    if (!r.ok) return toast("Erro ao exportar Excel", "error");
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `advocacia_${Date.now()}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast("Excel exportado", "success");
  };

  const exportarPDFProcesso = processo => {
    const doc = new jsPDF();
    doc.setFillColor(2, 4, 8);
    doc.rect(0, 0, 210, 32, "F");
    doc.setTextColor(99, 102, 241);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Dossie Juridico", 14, 18);
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(10);
    const linhas = [
      `Numero: ${processo.numero || "-"}`,
      `Cliente: ${processo.cliente || "-"}`,
      `Parte contraria: ${processo.parteContraria || "-"}`,
      `Area/classe: ${processo.area || "-"} / ${processo.classe || "-"}`,
      `Tribunal/comarca/vara: ${processo.tribunal || "-"} / ${processo.comarca || "-"} / ${processo.vara || "-"}`,
      `Status: ${statusMeta(processo.status)[1]} | Fase: ${processo.fase || "-"}`,
      `Prazo: ${processo.prazo || "-"} | Responsavel: ${processo.responsavel || "-"}`,
      `Valor da causa: ${fmt(processo.valorCausa || 0)}`,
      "",
      "Objeto:",
      processo.objeto || "-",
      "",
      "Estrategia:",
      processo.estrategia || "-",
      "",
      "Proxima acao:",
      processo.proximaAcao || "-",
    ];
    doc.text(linhas, 14, 45, { maxWidth: 180 });
    doc.save(`processo_${processo.numero || processo.id}.pdf`);
  };

  const exportarPDFPeticao = peticao => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(peticao.titulo || "Peticao", 14, 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(peticao.conteudo || "", 14, 32, { maxWidth: 180 });
    doc.save(`${(peticao.titulo || "peticao").replace(/\W+/g, "_")}.pdf`);
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div style={{ background: C.indigoDim, border: `1px solid ${C.indigoBorder}` }} className="w-10 h-10 rounded-xl flex items-center justify-center">
            <Scale size={19} style={{ color: C.indigo }} />
          </div>
          <div>
            <div style={{ color: C.text }} className="font-bold text-lg">Escritorio Juridico</div>
            <div style={{ color: C.muted }} className="text-xs">Processos, peticoes, documentos, prazos e exportacoes</div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => fileRef.current?.click()} style={{ border: `1px solid ${C.border}`, color: C.muted }} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold hover:border-white/20"><Upload size={13} />Inserir planilha/PDF</button>
          <button onClick={exportarExcel} style={{ background: C.greenDim, border: "1px solid rgba(34,197,94,0.3)", color: C.green }} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold"><Download size={13} />Exportar Excel</button>
          <input ref={fileRef} type="file" accept=".pdf,.xlsx,.xls,.csv,.doc,.docx" className="hidden" onChange={uploadArquivo} />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          ["Processos", resumo.totalProcessos || 0, Briefcase, C.indigo],
          ["Em andamento", resumo.andamento || 0, Clock, C.cyan],
          ["Julgados", resumo.julgado || 0, Gavel, C.amber],
          ["Finalizados", resumo.finalizado || 0, CheckCircle, C.green],
        ].map(([label, value, Icon, color]) => (
          <div key={label} style={{ background: C.card, border: `1px solid ${C.border}` }} className="rounded-2xl p-4 flex items-center gap-3">
            <div style={{ background: `${color}18` }} className="w-9 h-9 rounded-xl flex items-center justify-center"><Icon size={16} style={{ color }} /></div>
            <div><div style={{ color }} className="font-extrabold text-xl tabular-nums">{value}</div><div style={{ color: C.muted }} className="text-[10px] font-bold uppercase tracking-wider">{label}</div></div>
          </div>
        ))}
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}` }} className="rounded-2xl p-1 flex gap-1">
        {([["processos", "Processos", Briefcase], ["peticoes", "Peticoes", FileText], ["ia", "IA Juridica", Bot], ["arquivos", "Arquivos", FolderOpen], ["contextos", "Contextos", Scale]] as const).map(([id, label, Icon]) => (
          <button key={id as string} onClick={() => setTab(id as string)} style={{ background: tab === id ? C.indigoDim : "transparent", color: tab === id ? C.indigo : C.muted, border: `1px solid ${tab === id ? C.indigoBorder : "transparent"}` }} className="flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2">
            <Icon size={13} />{label}
          </button>
        ))}
      </div>

      {tab === "processos" && (
        <div className="grid grid-cols-[1fr_380px] gap-4">
          <div style={{ background: C.card, border: `1px solid ${C.border}` }} className="rounded-2xl overflow-hidden">
            <div style={{ borderBottom: `1px solid ${C.border}` }} className="p-3 flex gap-2">
              <div className="relative flex-1">
                <Search size={14} style={{ color: C.muted, position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar numero, cliente, parte, area..." style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, width: "100%", borderRadius: 12, padding: "9px 12px 9px 34px", fontSize: 13, outline: "none" }} />
              </div>
              <select value={status} onChange={e => setStatus(e.target.value)} style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, borderRadius: 12, padding: "9px 12px", fontSize: 13 }}>
                <option value="todos">Todos</option>
                {STATUS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
              <button onClick={() => setEditProcesso(processoVazio)} style={{ background: `linear-gradient(135deg,${C.indigo},${C.purple})`, color: "white" }} className="px-3 rounded-xl text-xs font-extrabold flex items-center gap-2"><Plus size={13} />Novo</button>
            </div>
            <div className="divide-y" style={{ borderColor: C.border }}>
              {filtrados.map(p => {
                const [, label, color] = statusMeta(p.status);
                return (
                  <div key={p.id} className="p-3 flex items-center gap-3 hover:bg-white/[0.015]">
                    <div style={{ background: `${color}16`, color, border: `1px solid ${color}30` }} className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"><Scale size={17} /></div>
                    <div className="flex-1 min-w-0">
                      <div style={{ color: C.text }} className="font-bold text-sm truncate">{p.numero || "Sem numero"} - {p.cliente}</div>
                      <div style={{ color: C.muted }} className="text-[11px] truncate">{p.area} · {p.classe || "classe nao informada"} · contra {p.parteContraria || "-"}</div>
                      <div style={{ color: C.sub }} className="text-[10px] truncate">Prazo: {p.prazo || "-"} · Acao: {p.proximaAcao || "-"}</div>
                    </div>
                    <span style={{ color, background: `${color}14`, border: `1px solid ${color}28` }} className="text-[10px] font-extrabold px-2 py-1 rounded-lg">{label}</span>
                    <button onClick={() => setEditProcesso(p)} style={{ color: C.indigo, border: `1px solid ${C.indigoBorder}` }} className="px-2 py-1.5 rounded-lg text-xs font-bold">Abrir</button>
                    <button onClick={() => exportarPDFProcesso(p)} style={{ color: C.red, border: "1px solid rgba(244,63,94,0.25)" }} className="w-8 h-8 rounded-lg flex items-center justify-center"><Printer size={12} /></button>
                    <button onClick={() => excluirProcesso(p.id)} style={{ color: C.red }} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-500/10"><Trash2 size={12} /></button>
                  </div>
                );
              })}
              {filtrados.length === 0 && <div style={{ color: C.muted }} className="p-8 text-center text-sm">Nenhum processo encontrado</div>}
            </div>
          </div>

          <div style={{ background: C.card2, border: `1px solid ${editProcesso ? C.indigoBorder : C.border}` }} className="rounded-2xl p-4 space-y-3">
            {editProcesso ? (
              <>
                <div className="flex items-center justify-between">
                  <div style={{ color: C.text }} className="font-bold text-sm">{editProcesso.id ? "Editar processo" : "Novo processo"}</div>
                  <button onClick={() => setEditProcesso(null)} style={{ color: C.muted }} className="text-xs">Fechar</button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Numero" value={editProcesso.numero} onChange={v => setEditProcesso({ ...editProcesso, numero: v })} />
                  <Campo label="Area" value={editProcesso.area} onChange={v => setEditProcesso({ ...editProcesso, area: v })}>
                    <select value={editProcesso.area} onChange={e => setEditProcesso({ ...editProcesso, area: e.target.value })} style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, width: "100%", borderRadius: 10, padding: "9px 12px", fontSize: 13 }}>{AREAS.map(a => <option key={a}>{a}</option>)}</select>
                  </Campo>
                  <Campo label="Cliente" value={editProcesso.cliente} onChange={v => setEditProcesso({ ...editProcesso, cliente: v })} />
                  <Campo label="Parte contraria" value={editProcesso.parteContraria} onChange={v => setEditProcesso({ ...editProcesso, parteContraria: v })} />
                  <Campo label="Classe" value={editProcesso.classe} onChange={v => setEditProcesso({ ...editProcesso, classe: v })} />
                  <Campo label="Status" value={editProcesso.status} onChange={v => setEditProcesso({ ...editProcesso, status: v })}>
                    <select value={editProcesso.status} onChange={e => setEditProcesso({ ...editProcesso, status: e.target.value })} style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, width: "100%", borderRadius: 10, padding: "9px 12px", fontSize: 13 }}>{STATUS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
                  </Campo>
                  <Campo label="Tribunal" value={editProcesso.tribunal} onChange={v => setEditProcesso({ ...editProcesso, tribunal: v })} />
                  <Campo label="Comarca" value={editProcesso.comarca} onChange={v => setEditProcesso({ ...editProcesso, comarca: v })} />
                  <Campo label="Vara" value={editProcesso.vara} onChange={v => setEditProcesso({ ...editProcesso, vara: v })} />
                  <Campo label="Fase" value={editProcesso.fase} onChange={v => setEditProcesso({ ...editProcesso, fase: v })} />
                  <Campo label="Prazo" type="date" value={editProcesso.prazo} onChange={v => setEditProcesso({ ...editProcesso, prazo: v })} />
                  <Campo label="Valor causa" type="number" value={editProcesso.valorCausa} onChange={v => setEditProcesso({ ...editProcesso, valorCausa: v })} />
                </div>
                {["objeto", "estrategia", "proximaAcao", "documentos", "andamento"].map(k => (
                  <div key={k}>
                    <label style={{ color: C.sub }} className="text-xs font-bold uppercase tracking-wider mb-1 block">{k}</label>
                    <textarea value={editProcesso[k] || ""} onChange={e => setEditProcesso({ ...editProcesso, [k]: e.target.value })} rows={k === "objeto" || k === "estrategia" ? 3 : 2} style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, width: "100%", borderRadius: 10, padding: "9px 12px", fontSize: 13, outline: "none", resize: "vertical" }} />
                  </div>
                ))}
                <button onClick={salvarProcesso} style={{ background: `linear-gradient(135deg,${C.indigo},${C.purple})`, color: "white" }} className="w-full py-3 rounded-xl text-sm font-extrabold flex items-center justify-center gap-2"><Save size={14} />Salvar processo</button>
              </>
            ) : (
              <div className="h-full min-h-[320px] flex flex-col items-center justify-center text-center gap-3">
                <Briefcase size={32} style={{ color: C.muted }} />
                <div style={{ color: C.text }} className="font-bold">Selecione ou crie um processo</div>
                <div style={{ color: C.muted }} className="text-xs max-w-xs">O cadastro cobre partes, foro, fase, prazos, estrategia, documentos e andamento.</div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "peticoes" && (
        <div className="grid grid-cols-[360px_1fr] gap-4">
          <div style={{ background: C.card, border: `1px solid ${C.border}` }} className="rounded-2xl p-3 space-y-2">
            <button onClick={() => setEditPeticao(peticaoVazia)} style={{ background: `linear-gradient(135deg,${C.indigo},${C.purple})`, color: "white" }} className="w-full py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2"><Plus size={13} />Nova peticao</button>
            {peticoes.map(p => (
              <div key={p.id} style={{ background: C.card2, border: `1px solid ${C.border}` }} className="rounded-xl p-3">
                <div style={{ color: C.text }} className="text-sm font-bold truncate">{p.titulo}</div>
                <div style={{ color: C.muted }} className="text-[11px] truncate">{p.cliente || "-"} contra {p.parteContraria || "-"}</div>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => setEditPeticao(p)} style={{ color: C.indigo, border: `1px solid ${C.indigoBorder}` }} className="flex-1 py-1.5 rounded-lg text-xs font-bold">Editar</button>
                  <button onClick={() => exportarPDFPeticao(p)} style={{ color: C.red, border: "1px solid rgba(244,63,94,0.25)" }} className="px-2 rounded-lg"><Printer size={12} /></button>
                  <button onClick={() => excluirPeticao(p.id)} style={{ color: C.red }} className="px-2 rounded-lg"><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
          </div>
          <div style={{ background: C.card2, border: `1px solid ${editPeticao ? C.indigoBorder : C.border}` }} className="rounded-2xl p-4 space-y-3">
            {editPeticao ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Titulo" value={editPeticao.titulo} onChange={v => setEditPeticao({ ...editPeticao, titulo: v })} />
                  <Campo label="Processo" value={editPeticao.processoId} onChange={escolherProcessoPeticao}>
                    <select value={editPeticao.processoId || ""} onChange={e => escolherProcessoPeticao(e.target.value)} style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, width: "100%", borderRadius: 10, padding: "9px 12px", fontSize: 13 }}>
                      <option value="">Sem processo vinculado</option>
                      {processos.map(p => <option key={p.id} value={p.id}>{p.numero || "Sem numero"} - {p.cliente}</option>)}
                    </select>
                  </Campo>
                  <Campo label="Modelo" value={editPeticao.modelo} onChange={v => setEditPeticao({ ...editPeticao, modelo: v })}>
                    <select value={editPeticao.modelo} onChange={e => {
                      const proc = processos.find(p => p.id === editPeticao.processoId) || editPeticao;
                      setEditPeticao({ ...editPeticao, modelo: e.target.value, conteudo: applyTemplate(MODELOS[e.target.value], proc) });
                    }} style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, width: "100%", borderRadius: 10, padding: "9px 12px", fontSize: 13 }}>
                      <option value="inicial">Peticao inicial</option>
                      <option value="contestacao">Contestacao</option>
                      <option value="recurso">Recurso</option>
                    </select>
                  </Campo>
                  <Campo label="Status" value={editPeticao.status} onChange={v => setEditPeticao({ ...editPeticao, status: v })}>
                    <select value={editPeticao.status} onChange={e => setEditPeticao({ ...editPeticao, status: e.target.value })} style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, width: "100%", borderRadius: 10, padding: "9px 12px", fontSize: 13 }}>
                      <option value="rascunho">Rascunho</option><option value="revisao">Em revisao</option><option value="protocolada">Protocolada</option>
                    </select>
                  </Campo>
                </div>
                <textarea value={editPeticao.conteudo || ""} onChange={e => setEditPeticao({ ...editPeticao, conteudo: e.target.value })} rows={22} style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, width: "100%", borderRadius: 12, padding: "14px", fontSize: 13, lineHeight: 1.6, outline: "none", resize: "vertical", fontFamily: "JetBrains Mono, monospace" }} />
                <div className="flex gap-2">
                  <button onClick={salvarPeticao} style={{ background: `linear-gradient(135deg,${C.indigo},${C.purple})`, color: "white" }} className="flex-1 py-3 rounded-xl text-sm font-extrabold flex items-center justify-center gap-2"><Save size={14} />Salvar</button>
                  <button onClick={() => exportarPDFPeticao(editPeticao)} style={{ background: C.redDim, border: "1px solid rgba(244,63,94,0.3)", color: C.red }} className="px-4 rounded-xl text-sm font-bold flex items-center gap-2"><Printer size={14} />PDF</button>
                </div>
              </>
            ) : (
              <div className="h-[520px] flex items-center justify-center text-sm" style={{ color: C.muted }}>Selecione uma peticao ou crie um novo rascunho</div>
            )}
          </div>
        </div>
      )}

      {tab === "ia" && (
        <div className="grid grid-cols-[380px_1fr] gap-4">
          <div style={{ background: C.card, border: `1px solid ${C.border}` }} className="rounded-2xl p-4 space-y-4">
            <div className="flex items-center gap-3">
              <div style={{ background: `linear-gradient(135deg,${C.indigo},${C.purple})` }} className="w-10 h-10 rounded-xl flex items-center justify-center">
                <Bot size={18} color="white" />
              </div>
              <div>
                <div style={{ color: C.text }} className="font-bold text-sm">IA Juridica</div>
                <div style={{ color: C.muted }} className="text-xs">Minutas humanizadas para documentos de advocacia</div>
              </div>
            </div>
            <Campo label="Tipo de documento" value={iaForm.tipo} onChange={v => setIaForm({ ...iaForm, tipo: v })}>
              <select value={iaForm.tipo} onChange={e => setIaForm({ ...iaForm, tipo: e.target.value })} style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, width: "100%", borderRadius: 10, padding: "9px 12px", fontSize: 13 }}>
                {TIPOS_IA.map(t => <option key={t}>{t}</option>)}
              </select>
            </Campo>
            <Campo label="Processo vinculado" value={iaForm.processoId} onChange={escolherProcessoIA}>
              <select value={iaForm.processoId || ""} onChange={e => escolherProcessoIA(e.target.value)} style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, width: "100%", borderRadius: 10, padding: "9px 12px", fontSize: 13 }}>
                <option value="">Sem processo vinculado</option>
                {processos.map(p => <option key={p.id} value={p.id}>{p.numero || "Sem numero"} - {p.cliente}</option>)}
              </select>
            </Campo>
            <Campo label="Titulo da minuta" value={iaForm.titulo} onChange={v => setIaForm({ ...iaForm, titulo: v })} />
            <div>
              <label style={{ color: C.sub }} className="text-xs font-bold uppercase tracking-wider mb-1 block">Orientacoes para a IA</label>
              <textarea
                value={iaForm.orientacao}
                onChange={e => setIaForm({ ...iaForm, orientacao: e.target.value })}
                rows={8}
                placeholder="Ex.: redigir uma carta de notificacao extrajudicial com tom firme, mas cordial; incluir historico dos fatos, prazo para resposta e preservar possibilidade de acordo."
                style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, width: "100%", borderRadius: 10, padding: "10px 12px", fontSize: 13, lineHeight: 1.55, outline: "none", resize: "vertical" }}
              />
            </div>
            <button onClick={gerarDocumentoIA} disabled={iaLoading} style={{ background: iaLoading ? "rgba(255,255,255,0.05)" : `linear-gradient(135deg,${C.indigo},${C.purple})`, color: iaLoading ? C.muted : "white" }} className="w-full py-3 rounded-xl text-sm font-extrabold flex items-center justify-center gap-2">
              {iaLoading ? <Sparkles size={14} className="animate-spin" /> : <Wand2 size={14} />}
              {iaLoading ? "Gerando minuta..." : "Gerar documento com IA"}
            </button>
          </div>

          <div style={{ background: C.card2, border: `1px solid ${C.border}` }} className="rounded-2xl p-5">
            <div className="grid grid-cols-2 gap-4">
              {([
                ["Peticões", "Minutas iniciais, contestacoes, recursos e manifestacoes com estrutura juridica clara.", FileText, C.green],
                ["Cartas", "Comunicacoes firmes, respeitosas e naturais para clientes, partes e terceiros.", Gavel, C.amber],
                ["Contratos", "Clausulas objetivas, campos editaveis e linguagem menos robotica.", Briefcase, C.cyan],
                ["Revisao humana", "A IA prepara a base; o advogado responsavel revisa fatos, fundamentos e estrategia.", CheckCircle, C.indigo],
              ] as const).map(([title, text, Icon, color]) => (
                <div key={title} style={{ background: C.card, border: `1px solid ${C.border}` }} className="rounded-2xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div style={{ background: `${color}18` }} className="w-9 h-9 rounded-xl flex items-center justify-center"><Icon size={16} style={{ color }} /></div>
                    <div style={{ color: C.text }} className="font-bold text-sm">{title}</div>
                  </div>
                  <div style={{ color: C.sub }} className="text-sm leading-relaxed">{text}</div>
                </div>
              ))}
            </div>
            <div style={{ color: C.muted, borderTop: `1px solid ${C.border}` }} className="mt-5 pt-4 text-xs leading-relaxed">
              Para melhores resultados, informe fatos, documentos existentes, pedidos desejados, riscos conhecidos e o tom esperado. O texto gerado abre automaticamente como rascunho em Peticoes.
            </div>
          </div>
        </div>
      )}

      {tab === "arquivos" && (
        <div style={{ background: C.card, border: `1px solid ${C.border}` }} className="rounded-2xl overflow-hidden">
          <div className="p-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.border}` }}>
            <div style={{ color: C.text }} className="font-bold text-sm">Arquivos importados</div>
            <button onClick={() => fileRef.current?.click()} style={{ color: C.indigo, border: `1px solid ${C.indigoBorder}` }} className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2"><Upload size={13} />Inserir PDF/planilha</button>
          </div>
          <table className="w-full text-sm">
            <thead><tr style={{ background: C.card2 }}>{["Arquivo", "Tipo", "Linhas", "Data", "Acoes"].map(h => <th key={h} style={{ color: C.muted, padding: "10px 14px", textAlign: "left", fontSize: 10, textTransform: "uppercase" }}>{h}</th>)}</tr></thead>
            <tbody>
              {arquivos.map(a => (
                <tr key={a.id} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={{ color: C.text, padding: "10px 14px", fontWeight: 700 }}>{a.nome}</td>
                  <td style={{ color: C.sub, padding: "10px 14px" }}>{a.tipo}</td>
                  <td style={{ color: C.sub, padding: "10px 14px" }}>{a.linhas || "-"}</td>
                  <td style={{ color: C.sub, padding: "10px 14px" }}>{a.createdAt ? new Date(a.createdAt).toLocaleDateString("pt-BR") : "-"}</td>
                  <td style={{ padding: "10px 14px" }}><button onClick={exportarExcel} style={{ color: C.green }} className="text-xs font-bold">Exportar indice</button></td>
                </tr>
              ))}
              {arquivos.length === 0 && <tr><td colSpan={5} style={{ color: C.muted, padding: 28, textAlign: "center" }}>Nenhum arquivo importado</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "contextos" && (
        <div className="grid grid-cols-3 gap-4">
          {([
            ["Triagem", "Cliente, parte contraria, fatos, provas, documentos faltantes, urgencia e riscos.", AlertTriangle, C.amber],
            ["Processo", "Numero, classe, foro, vara, fase, status, prazos, responsavel, valor da causa e andamento.", Scale, C.indigo],
            ["Pecas", "Peticao inicial, contestacao, recurso, manifestacao, cumprimento, acordo e checklist de protocolo.", FileText, C.green],
            ["Provas", "Contratos, prints, notas, emails, planilhas, PDF, testemunhas e historico de eventos.", FolderOpen, C.cyan],
            ["Gestao", "Agenda de prazos, proximas acoes, produtividade, processos em andamento, julgados e finalizados.", Clock, C.purple],
            ["Exportacao", "Dossie em PDF, peticoes em PDF e planilha Excel com processos, peticoes e arquivos.", Download, C.red],
          ] as const).map(([title, text, Icon, color]) => (
            <div key={title} style={{ background: C.card, border: `1px solid ${C.border}` }} className="rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3"><div style={{ background: `${color}18` }} className="w-9 h-9 rounded-xl flex items-center justify-center"><Icon size={16} style={{ color }} /></div><div style={{ color: C.text }} className="font-bold text-sm">{title}</div></div>
              <div style={{ color: C.sub }} className="text-sm leading-relaxed">{text}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
