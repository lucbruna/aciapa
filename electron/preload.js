const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("aciapa", {
  minimize: ()        => ipcRenderer.invoke("app:minimize"),
  maximize: ()        => ipcRenderer.invoke("app:maximize"),
  close:    ()        => ipcRenderer.invoke("app:close"),
  openUrl:  url       => ipcRenderer.invoke("app:open-url", url),
  version:  ()        => ipcRenderer.invoke("app:version"),
  checkServer: ()     => ipcRenderer.invoke("server:check"),
  getServerLog: ()    => ipcRenderer.invoke("server:log"),
  redirectToApp: ()   => ipcRenderer.send("server:redirect"),
  checkForUpdates: () => ipcRenderer.invoke("update:check").catch(()=>({available:false})),
  downloadUpdate: ()  => ipcRenderer.invoke("update:download").catch(()=>({downloaded:false})),
  installUpdate: ()   => ipcRenderer.invoke("update:install"),
  onUpdateStatus: (fn)=> {
    const cb = (_, ...a) => fn(...a);
    ipcRenderer.on("update:progress",   cb);
    ipcRenderer.on("update:downloaded", cb);
    ipcRenderer.on("update:error",      cb);
    return () => {
      ipcRenderer.removeListener("update:progress",   cb);
      ipcRenderer.removeListener("update:downloaded", cb);
      ipcRenderer.removeListener("update:error",      cb);
    };
  },
  on:  (ch, fn)       => ipcRenderer.on(ch, (_, ...a) => fn(...a)),
  off: (ch, fn)       => ipcRenderer.removeListener(ch, fn),
});
