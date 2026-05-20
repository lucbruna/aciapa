import { Socket } from "socket.io-client";

declare global {
  interface Window {
    aciapa?: {
      reload?: () => void;
      electron?: boolean;
      versao?: string;
      minimize?: () => void;
      maximize?: () => void;
      close?: () => void;
      checkForUpdates?: () => Promise<{ available: boolean; info?: any }>;
      onUpdateStatus?: (cb: (...args: any[]) => void) => (() => void);
      downloadUpdate?: () => Promise<{ downloaded: boolean }>;
      installUpdate?: () => void;
    };
  }

  interface Cliente {
    id: string;
    nome: string;
    email: string;
    telefone: string;
    cpfCnpj: string;
    plano: string;
    valor: number;
    status: string;
    dataVencimento: string;
    cidade: string;
    segmento: string;
    obs: string;
    pagamentos: Pagamento[];
    cobrancas?: Cobranca[];
    tags: string[];
    score: number;
    createdAt: string;
    updatedAt: string;
    portalAtivo?: boolean;
    portalSenha?: string;
    _situacao?: string;
    _diasAtraso?: number;
    pagoEsteMes?: boolean;
    totalPago?: number;
    mesesPagos?: number;
  }

  interface Pagamento {
    mes: number;
    ano: number;
    pago: boolean;
    dataPagamento: string;
    valor: number;
    formaPagamento?: string;
    transactionId?: string;
    statusPix?: string;
  }

  interface Cobranca {
    id: string | number;
    mes: number;
    ano: number;
    valor: number;
    status: string;
    metodo: string;
    qrCode: string | null;
    qrCodeBase64: string | null;
    linkPagamento: string | null;
    criadoEm: string;
  }

  interface Transacao {
    id: string;
    tipo: string;
    categoria: string;
    descricao: string;
    valor: number;
    data: string;
    status: string;
    clienteId: string;
    createdAt: string;
    updatedAt: string;
  }

  interface Stats {
    totalClientes: number;
    ativos: number;
    inativos: number;
    emDia: number;
    atrasados: number;
    inadimplencia: number;
    receitaMes: number;
    receitaTotal: number;
  }

  interface ExtratoItem {
    mes: string;
    mesNum: number;
    ano: number;
    pago: boolean;
    valor: number;
    dataPagamento: string | null;
  }

  interface ExtratoResponse {
    cliente: string;
    plano: string;
    valor: number;
    historico: ExtratoItem[];
  }
}

export {};
