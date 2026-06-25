import { io, Socket } from "socket.io-client";

let _baseUrl = "";
let _socket: Socket | null = null;

export function getBaseUrl(): string {
  return _baseUrl || window.location.origin;
}

export function setBaseUrl(url: string) {
  const normalized = url.replace(/\/+$/, "");
  if (normalized === _baseUrl) return;
  _baseUrl = normalized;
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
  localStorage.setItem("aciapa_server_url", normalized);
}

export function loadSavedUrl(): string | null {
  return localStorage.getItem("aciapa_server_url");
}

export function clearSavedUrl() {
  localStorage.removeItem("aciapa_server_url");
}

export function apiFetch(path: string, opts: RequestInit = {}): Promise<Response> {
  const url = `${getBaseUrl()}${path}`;
  return fetch(url, opts);
}

export function getSocket(): Socket {
  if (!_socket) {
    _socket = io(getBaseUrl(), { autoConnect: true });
  }
  return _socket;
}

export function reconnectSocket() {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
  getSocket();
}

// ── Network discovery ──

function localIpParts(): string[] | null {
  try {
    const rtc = new RTCPeerConnection({ iceServers: [] });
    return new Promise((resolve) => {
      rtc.createDataChannel("");
      rtc.createOffer().then((offer) => rtc.setLocalDescription(offer)).catch(() => {});
      rtc.onicecandidate = (e) => {
        if (!e.candidate) { rtc.close(); resolve(null); return; }
        const match = e.candidate.candidate.match(/(\d+\.\d+\.\d+)\.\d+/);
        if (match) { rtc.close(); resolve(match[1].split(".")); }
      };
      setTimeout(() => { rtc.close(); resolve(null); }, 3000);
    });
  } catch {
    return null;
  }
}

async function checkServer(ip: string, port: number, signal: AbortSignal): Promise<{ url: string; data: any } | null> {
  try {
    const res = await fetch(`http://${ip}:${port}/api/discover`, { signal, cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return { url: `http://${ip}:${port}`, data };
  } catch {
    return null;
  }
}

const COMMON_PORTS = [3001];
const COMMON_SUBNETS = [
  "192.168.0", "192.168.1", "192.168.2", "192.168.3", "192.168.5",
  "192.168.10", "192.168.15", "192.168.20",
  "10.0.0", "10.0.1", "10.0.2",
  "172.16.0", "172.17.0",
];

export async function scanNetwork(
  onProgress?: (ip: string, found: boolean) => void,
  signal?: AbortSignal,
): Promise<{ url: string; data: any }[]> {
  const results: { url: string; data: any }[] = [];

  // 1) Try mDNS / aciapa.local first
  for (const port of COMMON_PORTS) {
    const mdnsResult = await checkServer("aciapa.local", port, signal || new AbortController().signal);
    if (mdnsResult) {
      results.push(mdnsResult);
      onProgress?.(`aciapa.local:${port}`, true);
    }
  }

  if (signal?.aborted) return results;

  // 2) Determine subnets to scan
  const parts = await localIpParts();
  const subnets = new Set<string>(COMMON_SUBNETS);
  if (parts) subnets.add(parts.join("."));

  // 3) Scan IPs 1-254 on each subnet
  const ips = new Set<string>();
  for (const subnet of subnets) {
    for (let i = 1; i <= 254; i++) {
      ips.add(`${subnet}.${i}`);
    }
  }

  const controllers: AbortController[] = [];
  const BATCH_SIZE = 50;
  const ipList = [...ips];

  for (let start = 0; start < ipList.length && !signal?.aborted; start += BATCH_SIZE) {
    const batch = ipList.slice(start, start + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (ip) => {
        if (signal?.aborted) return null;
        const ctrl = new AbortController();
        controllers.push(ctrl);
        const timeout = setTimeout(() => ctrl.abort(), 1500);
        let result: { url: string; data: any } | null = null;
        for (const port of COMMON_PORTS) {
          result = await checkServer(ip, port, ctrl.signal);
          if (result) break;
        }
        clearTimeout(timeout);
        if (signal?.aborted) return null;
        onProgress?.(ip, !!result);
        return result;
      }),
    );

    for (const r of batchResults) {
      if (r) results.push(r);
    }
  }

  return results;
}
