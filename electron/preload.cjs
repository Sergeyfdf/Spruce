const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('updater', {
  check: () => ipcRenderer.invoke('updater:check'),
  download: () => ipcRenderer.invoke('updater:download'),
  install: () => ipcRenderer.invoke('updater:install'),
  getVersion: () => ipcRenderer.invoke('updater:getVersion'),
  onEvent: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('updater:event', handler);
    return () => ipcRenderer.removeListener('updater:event', handler);
  }
});

contextBridge.exposeInMainWorld('spruceApi', {
  listServers: () => ipcRenderer.invoke('server:list'),
  createServer: (data) => ipcRenderer.invoke('server:create', data),
  startServer: (id) => ipcRenderer.invoke('server:start', id),
  stopServer: (id) => ipcRenderer.invoke('server:stop', id),
  killServer: (id) => ipcRenderer.invoke('server:kill', id),
  deleteServer: (id) => ipcRenderer.invoke('server:delete', id),
  sendCommand: (id, cmd) => ipcRenderer.invoke('server:command', { id, cmd }),
  getServerLogs: (id) => ipcRenderer.invoke('server:logs', id),
  getServerProperties: (id) => ipcRenderer.invoke('server:getProps', id),
  saveServerProperties: (id, props) => ipcRenderer.invoke('server:saveProps', { id, props }),

  getMinecraftVersions: () => ipcRenderer.invoke('version:minecraft'),
  getFabricLoaders: (ver) => ipcRenderer.invoke('version:fabric', ver),
  getForgeVersion: (ver) => ipcRenderer.invoke('version:forge', ver),
  getNeoForgeVersion: (ver) => ipcRenderer.invoke('version:neoforge', ver),

  getAllPlayers: (id) => ipcRenderer.invoke('players:all', id),
  getOnlinePlayers: (id) => ipcRenderer.invoke('players:online', id),

  getLocalIp: () => ipcRenderer.invoke('network:localIp'),
  toggleUpnp: (port, enable) => ipcRenderer.invoke('network:upnp', { port, enable }),
  startPlayit: (port) => ipcRenderer.invoke('network:playit:start', port),
  stopPlayit: () => ipcRenderer.invoke('network:playit:stop'),
  getPlayitStatus: (port) => ipcRenderer.invoke('network:playit:status', port),
  setPlayitSecret: (secret) => ipcRenderer.invoke('network:playit:setSecret', secret),

  getStorageConfig: () => ipcRenderer.invoke('app:storage:get'),
  selectDirectory: () => ipcRenderer.invoke('app:storage:selectDirectory'),
  setStorageDirectory: (dirPath) => ipcRenderer.invoke('app:storage:setDirectory', dirPath),
  openDirectory: (dirPath) => ipcRenderer.invoke('app:storage:openDirectory', dirPath),
  completeInitialSetup: (dirPath) => ipcRenderer.invoke('app:storage:completeSetup', dirPath),

  searchModrinth: (params) => ipcRenderer.invoke('mods:modrinth:search', params),
  getModrinthProject: (idOrSlug) => ipcRenderer.invoke('mods:modrinth:project', idOrSlug),
  getModrinthVersions: (idOrSlug) => ipcRenderer.invoke('mods:modrinth:versions', idOrSlug),
  installModrinthMod: (params) => ipcRenderer.invoke('mods:modrinth:install', params),
  searchCurseForge: (params) => ipcRenderer.invoke('mods:curseforge:search', params),
  getCurseForgeProject: (params) => ipcRenderer.invoke('mods:curseforge:project', params),
  getCurseForgeVersions: (params) => ipcRenderer.invoke('mods:curseforge:versions', params),
  installCurseForgeMod: (params) => ipcRenderer.invoke('mods:curseforge:install', params),
  installModFile: (params) => ipcRenderer.invoke('mods:installFile', params),
  listInstalledMods: (serverPath) => ipcRenderer.invoke('mods:list', serverPath),
  toggleModState: (serverPath, filename) => ipcRenderer.invoke('mods:toggle', { serverPath, filename }),
  deleteModFile: (serverPath, filename) => ipcRenderer.invoke('mods:delete', { serverPath, filename }),
  openModsFolder: (serverPath) => ipcRenderer.invoke('mods:openFolder', serverPath),
  importMods: (serverPath) => ipcRenderer.invoke('mods:import', serverPath),

  isBlueMapInstalled: (serverPath, port) => ipcRenderer.invoke('bluemap:check', { serverPath, port }),
  installBlueMap: (serverPath, loader, mcVer, port) => ipcRenderer.invoke('bluemap:install', { serverPath, loader, mcVer, port }),
  checkBlueMapReady: (port) => ipcRenderer.invoke('bluemap:isReady', port),
  purgeBlueMap: (serverPath) => ipcRenderer.invoke('bluemap:purgeMap', serverPath),
  clearBlueMapCache: () => ipcRenderer.invoke('bluemap:clearCache'),

  onServerLog: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('server:log-event', handler);
    return () => ipcRenderer.removeListener('server:log-event', handler);
  },
  onServerStatusChange: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('server:status-change', handler);
    return () => ipcRenderer.removeListener('server:status-change', handler);
  },
  onPlayitStatusChange: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('network:playit:update', handler);
    return () => ipcRenderer.removeListener('network:playit:update', handler);
  },

  searchModpacks: (params) => ipcRenderer.invoke('modpacks:search', params),
  getModpackVersions: (slugOrId) => ipcRenderer.invoke('modpacks:versions', slugOrId),
  downloadModpack: (params) => ipcRenderer.invoke('modpacks:download', params),
  listLocalModpacks: () => ipcRenderer.invoke('modpacks:list'),
  createLocalModpack: (data) => ipcRenderer.invoke('modpacks:create', data),
  deleteLocalModpack: (id) => ipcRenderer.invoke('modpacks:delete', id),
  onModpackDownloadProgress: (callback) => {
    const handler = (_event, p) => callback(p);
    ipcRenderer.on('modpacks:download-progress', handler);
    return () => ipcRenderer.removeListener('modpacks:download-progress', handler);
  },

  getLoaderVersions: (loader, mcVersion) => ipcRenderer.invoke('version:loaderVersions', { loader, mcVersion }),

  exportServerToXmcl: (server) => ipcRenderer.invoke('xmcl:export', server),
  isXmclInstalled: () => ipcRenderer.invoke('xmcl:isInstalled')
});
