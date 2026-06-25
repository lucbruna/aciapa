import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { loadSavedUrl, setBaseUrl, clearSavedUrl, scanNetwork, getBaseUrl } from "../lib/api.js";

interface DiscoveredServer {
  url: string;
  nome: string;
  versao: string;
  hostname: string;
  ip: string;
}

interface ConnectionValue {
  serverUrl: string;
  isConnected: boolean;
  isScanning: boolean;
  discoveredServers: DiscoveredServer[];
  scanProgress: number;
  error: string | null;
  connect: (url: string) => Promise<boolean>;
  disconnect: () => void;
  startDiscovery: () => Promise<void>;
  statusMessage: string;
}

const ConnectionContext = createContext<ConnectionValue>(null!);

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [serverUrl, setServerUrlState] = useState<string>(() => {
    const saved = loadSavedUrl();
    if (saved) { setBaseUrl(saved); return saved; }
    return "";
  });
  const [isConnected, setIsConnected] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredServers, setDiscoveredServers] = useState<DiscoveredServer[]>([]);
  const [scanProgress, setScanProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");

  const checkConnection = useCallback(async (url: string): Promise<boolean> => {
    try {
      const res = await fetch(`${url.replace(/\/+$/, "")}/api/discover`, { cache: "no-store" });
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  const connect = useCallback(async (url: string): Promise<boolean> => {
    const normalized = url.replace(/\/+$/, "");
    setError(null);
    const ok = await checkConnection(normalized);
    if (!ok) {
      setError(`Não foi possível conectar a ${normalized}`);
      return false;
    }
    setBaseUrl(normalized);
    setServerUrlState(normalized);
    setIsConnected(true);
    return true;
  }, [checkConnection]);

  const disconnect = useCallback(() => {
    clearSavedUrl();
    setServerUrlState("");
    setIsConnected(false);
    setDiscoveredServers([]);
  }, []);

  const startDiscovery = useCallback(async () => {
    setIsScanning(true);
    setScanProgress(0);
    setDiscoveredServers([]);
    setError(null);
    setStatusMessage("Procurando servidor ACIAPA na rede...");

    let scanned = 0;
    const results = await scanNetwork((ip, found) => {
      scanned++;
      setScanProgress(Math.min(scanned, 1000));
      if (found) setStatusMessage(`✓ Servidor encontrado em ${ip}`);
    });

    if (results.length > 0) {
      const servers: DiscoveredServer[] = results.map((r) => ({
        url: r.url,
        nome: r.data.nome || "ACIAPA",
        versao: r.data.versao || "",
        hostname: r.data.hostname || "",
        ip: r.data.ip || r.url,
      }));
      setDiscoveredServers(servers);
      setStatusMessage(`${servers.length} servidor(es) encontrado(s)`);
    } else {
      setStatusMessage("Nenhum servidor encontrado. Digite o IP manualmente.");
    }

    setIsScanning(false);
  }, []);

  // Auto-tentar conectar se já tem URL salva
  useEffect(() => {
    if (serverUrl) {
      checkConnection(serverUrl).then((ok) => {
        if (ok) {
          setIsConnected(true);
          setStatusMessage("Conectado ao servidor");
        } else {
          setError("Servidor salvo não está acessível");
          setIsConnected(false);
        }
      });
    }
  }, [serverUrl, checkConnection]);

  return (
    <ConnectionContext.Provider
      value={{
        serverUrl: getBaseUrl(),
        isConnected,
        isScanning,
        discoveredServers,
        scanProgress,
        error,
        connect,
        disconnect,
        startDiscovery,
        statusMessage,
      }}
    >
      {children}
    </ConnectionContext.Provider>
  );
}

export const useConnection = () => useContext(ConnectionContext);
