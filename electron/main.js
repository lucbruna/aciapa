const { app, BrowserWindow, Tray, Menu, nativeImage, shell, ipcMain, screen } = require("electron");
const { autoUpdater } = require("electron-updater");
const path   = require("path");
const { fork } = require("child_process");
const http   = require("http");

let mainWindow = null, tray = null, serverProc = null;
let serverLog = []; // armazena logs do servidor para diagnostico
const PORT = 3001;
const MAX_WAIT = 30;

function resolvePath(relativePath) {
  if (app.isPackaged) {
    const p = path.join(process.resourcesPath, "app.asar.unpacked", relativePath);
    if (require("fs").existsSync(p)) return p;
    return path.join(process.resourcesPath, relativePath);
  }
  return path.join(__dirname, "..", relativePath);
}

function log(line) {
  serverLog.push(line);
  if (serverLog.length > 200) serverLog.splice(0, 50);
  console.log("[ACIAPA]", line);
}

function logErr(line) {
  serverLog.push("[ERRO] " + line);
  if (serverLog.length > 200) serverLog.splice(0, 50);
  console.error("[srv]", line);
}

function startServer() {
  return new Promise(resolve => {
    // Define diretorios gravaveis antes de qualquer tentativa
    const userData = app.getPath("userData");
    process.env.ACIAPA_DATA_DIR = path.join(userData, "data");
    process.env.ACIAPA_AUTH_DIR = path.join(userData, "auth_info");
    process.env.ACIAPA_UPLOADS_DIR = path.join(userData, "uploads");

    // Tenta carregar in-process primeiro (captura erro exato do require)
    try {
      const entry = resolvePath("server.js");
      // Limpa cache do modulo para evitar estado residual
      delete require.cache[require.resolve(entry)];
      // Define NODE_PATH para o processo atual tambem
      if (app.isPackaged) {
        const asarNM = path.join(process.resourcesPath, "app.asar", "node_modules");
        process.env.NODE_PATH = asarNM + (process.env.NODE_PATH ? ";" + process.env.NODE_PATH : "");
        require("module").Module._initPaths();
      }
      require(entry);
      log("Servidor carregado in-process com sucesso");
      resolve();
      return;
    } catch (e) {
      logErr("In-process falhou: " + e.message + "\n" + e.stack);
      // Continua para tentar via fork como fallback
    }

    // Fallback: fork
    const entry = resolvePath("server.js");
    log("Iniciando servidor via fork: " + entry);
    const asarNodeModules = path.join(process.resourcesPath, "app.asar", "node_modules");
    process.env.NODE_PATH = app.isPackaged ? asarNodeModules : "";
    serverProc  = fork(entry, [], { 
      silent: true, 
      env: { 
        ...process.env, 
        PORT 
      } 
    });
    serverProc.stdout?.on("data", d => {
      const s = d.toString().trim();
      if (s) { log(s); if (s.includes("ACIAPA")) resolve(); }
    });
    serverProc.stderr?.on("data", d => {
      const s = d.toString().trim();
      if (s) logErr(s);
    });
    serverProc.on("error", e => {
      logErr("fork error: " + e.message);
      resolve();
    });
    serverProc.on("exit", code => {
      if (code !== 0 && code !== null) logErr("exit code: " + code);
    });
    setTimeout(resolve, 10000);
  });
}

function waitForServer(n=60) {
  return new Promise((ok,fail) => {
    const check = t => {
      if (t<=0) return fail();
      http.get(`http://localhost:${PORT}/api/status`, r =>
        r.statusCode===200 ? ok() : setTimeout(()=>check(t-1),500)
      ).on("error", ()=>setTimeout(()=>check(t-1),500));
    };
    check(n);
  });
}

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  mainWindow = new BrowserWindow({
    width:   Math.min(1440, width  - 40),
    height:  Math.min(920,  height - 40),
    minWidth:  1150, minHeight: 740, center: true,
    title: "ACIAPA — Gestão Empresarial",
    backgroundColor: "#020408",
    frame: false, titleBarStyle: "hidden",
    trafficLightPosition: { x:16, y:16 },
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    show: true,
  });

  // Carrega página de loading local (não depende do servidor HTTP)
  mainWindow.loadFile(resolvePath("electron/loading.html"));

  mainWindow.on("close", e => {
    if (!app.isQuiting) { e.preventDefault(); mainWindow.hide(); }
  });
  mainWindow.on("closed", () => { mainWindow = null; });
}

function redirectToApp() {
  if (!mainWindow) return;
  const url = `http://localhost:${PORT}`;
  console.log("[ACIAPA] Redirecionando para", url);
  mainWindow.loadURL(url).catch(err => {
    console.error("[ACIAPA] loadURL error:", err);
    // Tenta novamente em 2s
    setTimeout(redirectToApp, 2000);
  });
}

function createTray() {
  tray = new Tray(nativeImage.createEmpty().resize({ width:16, height:16 }));
  tray.setToolTip("ACIAPA — Gestão Empresarial Inteligente");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label:"ACIAPA v2.0", enabled:false },
    { type:"separator" },
    { label:"Abrir Dashboard",  click:()=>{ mainWindow?.show(); mainWindow?.focus(); } },
    { label:"CRM — Clientes",   click:()=>{ mainWindow?.show(); } },
    { label:"Chat com IA",      click:()=>{ mainWindow?.show(); } },
    { label:"WhatsApp",         click:()=>{ mainWindow?.show(); } },
    { type:"separator" },
    { label:"Recarregar",       click:()=>mainWindow?.reload() },
    { label:"DevTools",         click:()=>mainWindow?.webContents.openDevTools({ mode:"detach" }) },
    { type:"separator" },
    { label:"Sair", click:()=>{ app.isQuiting=true; app.quit(); } },
  ]));
  tray.on("double-click", ()=>{ mainWindow?.show(); mainWindow?.focus(); });
}

ipcMain.handle("app:minimize", ()=>mainWindow?.minimize());
ipcMain.handle("app:maximize", ()=>mainWindow?.isMaximized()?mainWindow.restore():mainWindow?.maximize());
ipcMain.handle("app:close",    ()=>mainWindow?.hide());
ipcMain.handle("app:open-url", (_,url)=>shell.openExternal(url));
ipcMain.handle("app:version",  ()=>app.getVersion());

// Server check via IPC (usado pela loading page que roda em file://)
ipcMain.handle("server:check", async () => {
  try {
    await httpGet(`http://localhost:${PORT}/api/status`);
    return { ok: true };
  } catch {
    return { ok: false };
  }
});

// Retorna logs de diagnostico do servidor
ipcMain.handle("server:log", () => {
  return serverLog.slice(-100).join("\n");
});

ipcMain.on("server:redirect", () => {
  redirectToApp();
});

function httpGet(url) {
  return new Promise((ok, fail) => {
    http.get(url, r => r.statusCode === 200 ? ok() : fail())
      .on("error", fail);
  });
}

// ── Auto Update ────────────────────────────────────────────────────────────
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

ipcMain.handle("update:check", async ()=>{
  try {
    const result = await autoUpdater.checkForUpdates();
    return { available: result?.updateInfo?.version !== app.getVersion(), info: result?.updateInfo };
  } catch { return { available: false, error: "Falha ao verificar atualizações" }; }
});

ipcMain.handle("update:download", async ()=>{
  try {
    await autoUpdater.downloadUpdate();
    return { downloaded: true };
  } catch { return { downloaded: false, error: "Falha ao baixar atualização" }; }
});

ipcMain.handle("update:install", ()=>{
  setImmediate(() => autoUpdater.quitAndInstall());
  return { installing: true };
});

autoUpdater.on("download-progress", p => {
  mainWindow?.webContents.send("update:progress", p);
});

autoUpdater.on("update-downloaded", () => {
  mainWindow?.webContents.send("update:downloaded");
});

autoUpdater.on("error", err => {
  mainWindow?.webContents.send("update:error", err.message);
});

function checkUpdateSilent() {
  try {
    autoUpdater.checkForUpdates().catch(()=>{});
  } catch {}
}

app.whenReady().then(async ()=>{
  console.log("[ACIAPA] Iniciando sistema...");
  // Mostra janela com loading imediatamente
  createWindow();
  createTray();
  // Inicia servidor em background
  await startServer();
  try {
    await waitForServer();
    console.log("[ACIAPA] Servidor pronto!");
    redirectToApp();
  } catch(_){
    console.warn("[ACIAPA] Servidor não respondeu após espera máxima");
    // A página loading.html já mostrará o erro após 60 tentativas
  }
  if (app.isPackaged) setTimeout(checkUpdateSilent, 5000);
  app.on("activate", ()=>{ if(!mainWindow) createWindow(); else mainWindow.show(); });
});

app.on("window-all-closed", ()=>{});
app.on("before-quit", ()=>{ serverProc?.kill("SIGTERM"); });

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", ()=>{
    if (mainWindow) { if(mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus(); }
  });
}
