/**
 * ACIAPA — Database Layer (SQLite)
 * better-sqlite3 com mesma API do JSON anterior
 * Migração automática na primeira execução
 */
"use strict";
const fs   = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");

const isPkg = typeof process.pkg !== "undefined";
const basePath = isPkg ? path.dirname(process.execPath) : __dirname;
// Permite sobrescrever o diretorio de dados via env var (usado pelo Electron para evitar Program Files)
const DATA_DIR = process.env.ACIAPA_DATA_DIR || path.join(basePath, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_FILE = path.join(DATA_DIR, "nexuspro.db");
const db = new Database(DB_FILE);
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    name TEXT NOT NULL,
    id TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    data TEXT NOT NULL DEFAULT '{}',
    PRIMARY KEY (name, id)
  );
  CREATE INDEX IF NOT EXISTS idx_items_name ON items(name);
`);

const stmts = {
  insert:    db.prepare("INSERT OR REPLACE INTO items (name, id, createdAt, updatedAt, data) VALUES (?, ?, ?, ?, ?)"),
  getById:   db.prepare("SELECT * FROM items WHERE name = ? AND id = ?"),
  getAll:    db.prepare("SELECT * FROM items WHERE name = ? ORDER BY rowid DESC"),
  count:     db.prepare("SELECT COUNT(*) as n FROM items WHERE name = ?"),
  delete:    db.prepare("DELETE FROM items WHERE name = ? AND id = ?"),
  deleteAll: db.prepare("DELETE FROM items WHERE name = ?"),
};

function _uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function _now() {
  return new Date().toISOString();
}

// Constrói SQL WHERE dinâmico para queries $gte, $lte, $like, $in
function _bindSafe(val) {
  if (typeof val === "boolean") return val ? 1 : 0;
  if (val === undefined || val === null) return null;
  if (typeof val === "number" || typeof val === "string" || typeof val === "bigint") return val;
  if (Buffer.isBuffer(val)) return val;
  return String(val);
}

function _buildWhere(query) {
  const clauses = [];
  const params = [];
  for (const [key, val] of Object.entries(query)) {
    if (val === undefined || val === null) continue;
    if (typeof val === "object" && !Buffer.isBuffer(val)) {
      if (val.$gte !== undefined) { clauses.push(`CAST(json_extract(data, '$.${key}') AS REAL) >= ?`); params.push(_bindSafe(val.$gte)); }
      if (val.$lte !== undefined) { clauses.push(`CAST(json_extract(data, '$.${key}') AS REAL) <= ?`); params.push(_bindSafe(val.$lte)); }
      if (val.$like !== undefined) { clauses.push(`json_extract(data, '$.${key}') LIKE ?`); params.push(`%${val.$like}%`); }
      if (val.$in !== undefined) {
        const items = val.$in.map(v => _bindSafe(v));
        const ph = items.map(() => "?").join(",");
        clauses.push(`json_extract(data, '$.${key}') IN (${ph})`);
        params.push(...items);
      }
    } else {
      clauses.push(`json_extract(data, '$.${key}') = ?`);
      params.push(_bindSafe(val));
    }
  }
  return { sql: clauses.join(" AND "), params };
}

class Collection {
  constructor(name) {
    this.name = name;
  }

  _rowToDoc(row) {
    if (!row) return null;
    return { id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt, ...JSON.parse(row.data) };
  }

  find(query = {}) {
    if (Object.keys(query).length === 0) {
      return stmts.getAll.all(this.name).map(r => this._rowToDoc(r));
    }
    const { sql, params } = _buildWhere(query);
    if (!sql) return stmts.getAll.all(this.name).map(r => this._rowToDoc(r));
    try {
      const rows = db.prepare(`SELECT * FROM items WHERE name = ? AND ${sql} ORDER BY rowid DESC`).all(this.name, ...params);
      return rows.map(r => this._rowToDoc(r));
    } catch (e) {
      console.error(`[DB] find error on ${this.name}:`, e.message, { sql, params });
      return [];
    }
  }

  findOne(query) {
    const docs = this.find(query);
    return docs[0] || null;
  }

  findById(id) {
    return this._rowToDoc(stmts.getById.get(this.name, id));
  }

  insert(doc) {
    const id = _uid();
    const now = _now();
    const { ...rest } = doc;
    stmts.insert.run(this.name, id, now, now, JSON.stringify(rest));
    return { id, createdAt: now, updatedAt: now, ...rest };
  }

  update(id, changes) {
    const row = stmts.getById.get(this.name, id);
    if (!row) return null;
    const existing = JSON.parse(row.data);
    const merged = { ...existing, ...changes };
    const now = _now();
    stmts.insert.run(this.name, id, row.createdAt, now, JSON.stringify(merged));
    return { id, createdAt: row.createdAt, updatedAt: now, ...merged };
  }

  delete(id) {
    const info = stmts.delete.run(this.name, id);
    return info.changes > 0;
  }

  deleteMany(query) {
    const docs = this.find(query);
    const del = db.transaction(ids => {
      const stmt = db.prepare("DELETE FROM items WHERE name = ? AND id = ?");
      for (const id of ids) stmt.run(this.name, id);
    });
    const ids = docs.map(d => d.id);
    if (ids.length > 0) del(ids);
    return ids.length;
  }

  count(query = {}) {
    if (Object.keys(query).length === 0) {
      return stmts.count.get(this.name).n;
    }
    const docs = this.find(query);
    return docs.length;
  }

  get all() {
    return stmts.getAll.all(this.name).map(r => this._rowToDoc(r));
  }

  get length() {
    return stmts.count.get(this.name).n;
  }
}

// ── Migração de JSON para SQLite ─────────────────────────────────────────
function migrateFromJson(collectionName) {
  const file = path.join(DATA_DIR, `${collectionName}.json`);
  if (!fs.existsSync(file)) return;
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!Array.isArray(data) || data.length === 0) return;
    const col = new Collection(collectionName);
    if (col.length > 0) return; // já migrado
    const insert = db.transaction(docs => {
      const stmt = db.prepare("INSERT OR IGNORE INTO items (name, id, createdAt, updatedAt, data) VALUES (?, ?, ?, ?, ?)");
      for (const d of docs) {
        const { id = _uid(), createdAt = _now(), updatedAt = _now(), ...rest } = d;
        stmt.run(collectionName, id, createdAt, updatedAt, JSON.stringify(rest));
      }
    });
    insert(data);
    console.log(`[DB] Migrado ${collectionName}: ${data.length} registros`);
  } catch (e) {
    console.error(`[DB] Erro migrando ${collectionName}:`, e.message);
  }
}

// ── Database ──────────────────────────────────────────────────────────────
class AppDatabase {
  constructor() {
    // Migrar dados existentes
    const collections = ["users","clientes","transacoes","mensagens","campanhas","kanban","atividades","notificacoes","templates","settings","chat_ia","planilhas","tarefas","produtos","rh","emails","contabilidade","notas_fiscais","advocacia","agenda","associados","email_subscribers","aniversariantes"];
    for (const name of collections) migrateFromJson(name);

    this.users       = new Collection("users");
    this.clientes    = new Collection("clientes");
    this.transacoes  = new Collection("transacoes");
    this.mensagens   = new Collection("mensagens");
    this.campanhas   = new Collection("campanhas");
    this.kanban      = new Collection("kanban");
    this.atividades  = new Collection("atividades");
    this.notificacoes= new Collection("notificacoes");
    this.templates   = new Collection("templates");
    this.settings    = new Collection("settings");
    this.chatIA      = new Collection("chat_ia");
    this.planilhas   = new Collection("planilhas");
    this.tarefas     = new Collection("tarefas");
    this.produtos    = new Collection("produtos");
    this.rh          = new Collection("rh");
    this.emails      = new Collection("emails");
    this.contabilidade= new Collection("contabilidade");
    this.notas_fiscais=new Collection("notas_fiscais");
    this.advocacia   = new Collection("advocacia");
    this.agenda      = new Collection("agenda");
    this.associados  = new Collection("associados");
    this.aniversariantes = new Collection("aniversariantes");
    this.email_subscribers = new Collection("email_subscribers");

    this._seed();
  }

  log(userId, tipo, descricao, dados = {}) {
    this.atividades.insert({ userId, tipo, descricao, dados });
  }

  async _seed() {
    if (this.users.count() === 0) {
      const h = await bcrypt.hash("nexus123", 10);
      this.users.insert({ nome: "Administrador",     email: "admin@aciapa.com",        senha: h, role: "super_admin", ativo: true, avatar: "AD", cor: "#6366f1" });
      this.users.insert({ nome: "João Financeiro",   email: "financeiro@aciapa.com",   senha: h, role: "financeiro",  ativo: true, avatar: "JF", cor: "#22c55e" });
      this.users.insert({ nome: "Maria Atendimento", email: "atendimento@aciapa.com",  senha: h, role: "atendimento", ativo: true, avatar: "MA", cor: "#06b6d4" });
    }
    if (this.settings.count() === 0) {
      this.settings.insert({ key: "empresa", nomeEmpresa: "ACIAPA Gestão", cnpj: "00.000.000/0001-00", email: "contato@aciapa.com", telefone: "11900000000", endereco: "Av. Paulista, 1000 — São Paulo/SP", anthropicKey: "", openaiKey: "", minDelay: 3, maxDelay: 8, whatsappAtivo: false });
    }
    if (this.clientes.count() === 0) {
      const hoje = new Date();
      [
        ["Alpha Ltda", "11999991111", "alpha@mail.com", "Pro", 1500, "ativo", "em_dia", "São Paulo", "Tecnologia"],
        ["Beta ME", "21988882222", "beta@mail.com", "Basic", 800, "ativo", "atrasado", "Rio de Janeiro", "Comércio"],
        ["Gamma S/A", "31977773333", "gamma@mail.com", "Premium", 3000, "ativo", "em_dia", "BH", "Serviços"],
        ["Delta Ltda", "41966664444", "delta@mail.com", "Pro", 1500, "ativo", "vencendo", "Curitiba", "Indústria"],
        ["Epsilon Tech", "51955555555", "eps@mail.com", "Basic", 800, "inativo", "em_dia", "POA", "Tecnologia"],
        ["Zeta Consult", "61944446666", "zeta@mail.com", "Premium", 3000, "ativo", "em_dia", "Brasília", "Consultoria"],
        ["Eta Varejo", "71933337777", "eta@mail.com", "Pro", 1500, "ativo", "atrasado", "Salvador", "Comércio"],
        ["Theta Saúde", "81922228888", "theta@mail.com", "Premium", 3000, "ativo", "em_dia", "Recife", "Saúde"],
      ].forEach(([nome, tel, email, plano, valor, status, sit, cidade, seg]) => {
        const venc = new Date(hoje);
        venc.setDate(Math.floor(Math.random() * 28) + 1);
        if (sit === "atrasado") venc.setMonth(venc.getMonth() - 1);
        this.clientes.insert({ nome, telefone: tel, email, cpfCnpj: "", plano, valor, status, dataVencimento: venc.toISOString().split("T")[0], dataCadastro: new Date(hoje - Math.random() * 365 * 86400000).toISOString().split("T")[0], cidade, segmento: seg, pagamentos: [], tags: [], score: Math.floor(Math.random() * 40 + 60) });
      });
    }
    if (this.transacoes.count() === 0) {
      const hoje = new Date();
      for (let m = 0; m < 6; m++) {
        const d = new Date(hoje);
        d.setMonth(d.getMonth() - m);
        const ano = d.getFullYear(), mes = String(d.getMonth() + 1).padStart(2, "0");
        [1500, 3000, 800, 1500, 3000, 800].forEach((v, i) => this.transacoes.insert({ tipo: "entrada", categoria: "Mensalidade", descricao: `Mensalidade Cliente ${i + 1}`, valor: v, data: `${ano}-${mes}-${String(Math.floor(Math.random() * 25) + 1).padStart(2, "0")}`, status: "pago", clienteId: "" }));
        [{ v: 3500, c: "Aluguel" }, { v: 1200, c: "Folha" }, { v: 300, c: "Internet" }, { v: 200, c: "Energia" }].forEach(({ v, c }) => this.transacoes.insert({ tipo: "saida", categoria: c, descricao: c, valor: v, data: `${ano}-${mes}-05`, status: "pago", clienteId: "" }));
      }
    }
    if (this.kanban.count() === 0) {
      [
        { titulo: "Empresa XYZ — Software", valor: 5000, coluna: "prospeccao", responsavel: "João Silva", prioridade: "alta", prazo: "2025-03-15" },
        { titulo: "ABC Corp — Consultoria", valor: 12000, coluna: "qualificacao", responsavel: "Ana Costa", prioridade: "media", prazo: "2025-03-20" },
        { titulo: "Startup Beta — Licença", valor: 8500, coluna: "proposta", responsavel: "Carlos Lima", prioridade: "alta", prazo: "2025-03-10" },
        { titulo: "Industrial SA — Suporte", valor: 3000, coluna: "negociacao", responsavel: "João Silva", prioridade: "baixa", prazo: "2025-04-01" },
        { titulo: "Clínica Saúde — Sistema", valor: 15000, coluna: "fechado_ganho", responsavel: "Ana Costa", prioridade: "alta", prazo: "2025-02-28" },
      ].forEach(c => this.kanban.insert({ ...c, descricao: "", contato: "", empresa: "", tags: [] }));
    }
    if (this.templates.count() === 0) {
      [
        { nome: "Boas-vindas", categoria: "onboarding", conteudo: "Olá {{nome}}! Bem-vindo(a) à nossa empresa! 🎉" },
        { nome: "Cobrança Amigável", categoria: "cobranca", conteudo: "Olá {{nome}}, sua mensalidade de {{valor}} está em aberto. Podemos ajudar? 😊" },
        { nome: "Cobrança Urgente", categoria: "cobranca", conteudo: "⚠️ {{nome}}, sua mensalidade de {{valor}} está {{diasAtraso}} dias em atraso." },
        { nome: "Lembrete Vencimento", categoria: "lembrete", conteudo: "Lembrete: sua mensalidade de {{valor}} vence em {{vencimento}}. 📅" },
        { nome: "Pesquisa NPS", categoria: "satisfacao", conteudo: "{{nome}}, de 0 a 10, quanto nos recomendaria? Sua opinião é valiosa! ⭐" },
      ].forEach(t => this.templates.insert(t));
    }
    if (this.produtos.count() === 0) {
      [
        { nome: "Notebook Dell", codigo: "NB-001", categoria: "Informática", quantidade: 15, preco: 4500, validade: "" },
        { nome: "Monitor 27\"", codigo: "MN-001", categoria: "Informática", quantidade: 8, preco: 1800, validade: "" },
        { nome: "Cadeira Ergonômica", codigo: "CD-001", categoria: "Mobiliário", quantidade: 5, preco: 2500, validade: "" },
        { nome: "Mouse Sem Fio", codigo: "MS-001", categoria: "Informática", quantidade: 30, preco: 120, validade: "" },
        { nome: "Papel A4 (cx)", codigo: "PP-001", categoria: "Papelaria", quantidade: 50, preco: 180, validade: "" },
      ].forEach(p => this.produtos.insert(p));
    }
    if (this.rh.count() === 0) {
      [
        { nome: "Ana Silva", cargo: "Analista Financeiro", departamento: "Financeiro", salario: 5200, admissao: "2024-03-15", telefone: "11988887777", email: "ana@aciapa.com", documentos: "CPF,RG" },
        { nome: "Carlos Oliveira", cargo: "Desenvolvedor", departamento: "TI", salario: 7800, admissao: "2024-01-10", telefone: "11977776666", email: "carlos@aciapa.com", documentos: "CPF,RG,CNH" },
        { nome: "Mariana Costa", cargo: "Analista de RH", departamento: "RH", salario: 4800, admissao: "2024-06-01", telefone: "11966665555", email: "mariana@aciapa.com", documentos: "CPF,RG" },
      ].forEach(f => this.rh.insert(f));
    }
    if (this.contabilidade.count() === 0) {
      [
        { tipo: "receita", descricao: "Prestação de Serviços", valor: 25000, data: "2026-05-10", categoria: "Serviços", conta: "Banco Itaú" },
        { tipo: "despesa", descricao: "Aluguel", valor: 3500, data: "2026-05-05", categoria: "Imóvel", conta: "Conta Corrente" },
        { tipo: "despesa", descricao: "Folha de Pagamento", valor: 15000, data: "2026-05-01", categoria: "Pessoal", conta: "Conta Corrente" },
      ].forEach(c => this.contabilidade.insert(c));
    }
    if (this.advocacia.count() === 0) {
      this.advocacia.insert({
        categoria: "processo", numero: "0001234-56.2026.8.26.0100", cliente: "Cliente Exemplo Ltda",
        parteContraria: "Fornecedor Alfa", area: "Civel", classe: "Acao de cobranca",
        tribunal: "TJSP", comarca: "Sao Paulo", vara: "1 Vara Civel", fase: "Conhecimento",
        status: "andamento", rito: "Comum", valorCausa: 25000, prazo: "2026-06-10",
        responsavel: "Advogado responsavel", objeto: "Cobranca contratual com documentos anexos.",
        estrategia: "Consolidar provas documentais, calcular saldo e propor acordo antes da audiencia.",
        risco: "medio", proximaAcao: "Protocolar manifestacao e conferir documentos faltantes.",
        documentos: "Contrato, notas fiscais, comprovantes e e-mails.",
        andamento: "Processo distribuido e aguardando citacao.",
      });
      this.advocacia.insert({
        categoria: "peticao", titulo: "Peticao inicial - cobranca", modelo: "inicial",
        cliente: "Cliente Exemplo Ltda", parteContraria: "Fornecedor Alfa",
        conteudo: "EXCELENTISSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A)\n\nMinuta inicial de cobranca contratual.",
        status: "rascunho",
      });
    }
  }
}

module.exports = new AppDatabase();
