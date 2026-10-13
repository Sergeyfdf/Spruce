import { app, BrowserWindow, ipcMain, Menu, dialog, shell } from 'electron';
import net from 'net';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import * as serverManager from './services/serverManager.js';
import * as versionService from './services/versionService.js';
import * as networkManager from './services/networkManager.js';
import * as modService from './services/modService.js';
import * as playerManager from './services/playerManager.js';
import * as bluemapService from './services/bluemapService.js';
import * as pathManager from './services/pathManager.js';
import * as modpackService from './services/modpackService.js';
import * as xmclService from './services/xmclService.js';
import { startSpruceHttpBridge, stopSpruceHttpBridge } from './services/spruceBridge.js';
import { initUpdater } from '@marzipan/updater/main';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const k = trimmed.slice(0, eqIdx).trim();
          const v = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
          process.env[k] = v;
        }
      }
    });
  } catch (e) {
  }
}

let mainWindow = null;

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  Menu.setApplicationMenu(null);

  const iconPath = process.platform === 'win32' && fs.existsSync(path.join(__dirname, 'icon.ico'))
    ? path.join(__dirname, 'icon.ico')
    : path.join(__dirname, 'icon.png');

  mainWindow = new BrowserWindow({
    width: 1300,
    height: 860,
    minWidth: 1050,
    minHeight: 700,
    backgroundColor: '#0e0e0e',
    show: false,
    title: 'Spruce',
    icon: iconPath,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  }, 1200);

  mainWindow.setMenuBarVisibility(false);

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  const distIndex = path.join(__dirname, '../dist/index.html');

  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl).catch(() => {
      mainWindow.loadFile(distIndex);
    });
  } else {
    mainWindow.loadFile(distIndex);
  }
}

app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.spruce.minecraft');
  }

  const pkgPath = path.join(__dirname, '../package.json');
  let appVersion = '1.0.0';
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.version) appVersion = pkg.version;
    } catch (e) {
    }
  }
  app.setName('Spruce');
  app.setVersion(appVersion);

  app.setAsDefaultProtocolClient('spruce');
  startSpruceHttpBridge();

  setupIpc();
  createWindow();

  initUpdater({
    repo: process.env.GITHUB_REPO || 'Sergeyfdf/Spruce',
    customFeedUrl: process.env.UPDATE_FEED_URL || undefined,
    currentVersion: appVersion,
    getMainWindow: () => mainWindow
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  stopSpruceHttpBridge();
  networkManager.stopPlayit();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function setupIpc() {
  ipcMain.handle('server:list', () => {
    return serverManager.listServers();
  });

  ipcMain.handle('server:create', async (_event, data) => {
    return await serverManager.createServer(data, (percent) => {
      if (mainWindow) {
        mainWindow.webContents.send('server:create-progress', percent);
      }
    });
  });

  ipcMain.handle('server:start', async (_event, id) => {
    return await serverManager.startServer(
      id,
      (serverId, line) => {
        if (mainWindow) {
          mainWindow.webContents.send('server:log-event', { serverId, line });
        }
      },
      (serverId, status) => {
        if (mainWindow) {
          mainWindow.webContents.send('server:status-change', { serverId, status });
        }
      }
    );
  });

  ipcMain.handle('server:stop', (_event, id) => {
    return serverManager.stopServer(id);
  });

  ipcMain.handle('server:kill', (_event, id) => {
    return serverManager.killServer(id);
  });

  ipcMain.handle('server:delete', (_event, id) => {
    return serverManager.deleteServer(id);
  });

  ipcMain.handle('server:command', (_event, { id, cmd }) => {
    return serverManager.sendCommand(id, cmd);
  });

  ipcMain.handle('server:logs', (_event, id) => {
    return serverManager.getServerLogs(id);
  });

  ipcMain.handle('server:getProps', (_event, id) => {
    return serverManager.getServerProperties(id);
  });

  ipcMain.handle('server:saveProps', (_event, { id, props }) => {
    return serverManager.saveServerProperties(id, props);
  });

  ipcMain.handle('version:minecraft', async () => {
    return await versionService.getMinecraftVersions();
  });

  ipcMain.handle('version:fabric', async (_event, ver) => {
    return await versionService.getFabricLoaders(ver);
  });

  ipcMain.handle('version:forge', async (_event, ver) => {
    return await versionService.getForgeVersion(ver);
  });

  ipcMain.handle('version:neoforge', async (_event, ver) => {
    return await versionService.getNeoForgeVersion(ver);
  });

  ipcMain.handle('players:all', async (_event, id) => {
    const servers = serverManager.listServers();
    const s = servers.find((item) => item.id === id);
    if (!s) return [];
    const online = serverManager.getOnlinePlayers(id);
    return await playerManager.getAllPlayers(s.path, online);
  });

  ipcMain.handle('players:online', (_event, id) => {
    return serverManager.getOnlinePlayers(id);
  });

  ipcMain.handle('network:localIp', () => {
    return networkManager.getLocalIp();
  });

  ipcMain.handle('network:upnp', async (_event, { port, enable }) => {
    return await networkManager.toggleUpnp(port, enable);
  });

  networkManager.onPlayitStatus((status) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('network:playit:update', status);
    }
  });

  ipcMain.handle('network:playit:start', async (_event, port = 25565) => {
    return await networkManager.startPlayit(null, port);
  });

  ipcMain.handle('network:playit:stop', () => {
    return networkManager.stopPlayit();
  });

  ipcMain.handle('network:playit:status', async (_event, port) => {
    return await networkManager.getPlayitStatus(port);
  });

  ipcMain.handle('network:playit:setSecret', (_event, secret) => {
    return networkManager.setCustomPlayitSecret(secret);
  });

  ipcMain.handle('app:storage:get', () => {
    return {
      dataDir: pathManager.getDataDirectory(),
      defaultDir: pathManager.USER_DATA_DIR,
      isSetupCompleted: pathManager.isSetupCompleted()
    };
  });

  ipcMain.handle('app:storage:selectDirectory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Выбери папку для серверов и рантаймов Spruce',
      properties: ['openDirectory', 'createDirectory']
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  ipcMain.handle('app:storage:setDirectory', async (_event, newPath) => {
    return pathManager.setDataDirectory(newPath);
  });

  ipcMain.handle('app:storage:openDirectory', async (_event, targetPath) => {
    const dirToOpen = targetPath || pathManager.getDataDirectory();
    if (fs.existsSync(dirToOpen)) {
      await shell.openPath(dirToOpen);
      return true;
    }
    return false;
  });

  ipcMain.handle('app:storage:completeSetup', async (_event, dirPath) => {
    return pathManager.completeInitialSetup(dirPath);
  });

  ipcMain.handle('mods:modrinth:search', async (_event, params) => {
    return await modService.searchModrinth(params);
  });

  ipcMain.handle('mods:modrinth:project', async (_event, idOrSlug) => {
    return await modService.getModrinthProject(idOrSlug);
  });

  ipcMain.handle('mods:modrinth:versions', async (_event, idOrSlug) => {
    return await modService.getModrinthVersions(idOrSlug);
  });

  ipcMain.handle('mods:modrinth:install', async (_event, params) => {
    return await modService.installModrinthMod(params);
  });

  ipcMain.handle('mods:curseforge:search', async (_event, params) => {
    return await modService.searchCurseForge(params);
  });

  ipcMain.handle('mods:curseforge:project', async (_event, params) => {
    return await modService.getCurseForgeProject(params);
  });

  ipcMain.handle('mods:curseforge:versions', async (_event, params) => {
    return await modService.getCurseForgeVersions(params);
  });

  ipcMain.handle('mods:curseforge:install', async (_event, params) => {
    return await modService.installCurseForgeMod(params);
  });

  ipcMain.handle('mods:installFile', async (_event, params) => {
    return await modService.installModFile(params);
  });

  ipcMain.handle('mods:list', (_event, serverPath) => {
    return modService.listInstalledMods(serverPath);
  });

  ipcMain.handle('mods:toggle', (_event, { serverPath, filename }) => {
    return modService.toggleModState(serverPath, filename);
  });

  ipcMain.handle('mods:delete', (_event, { serverPath, filename }) => {
    return modService.deleteModFile(serverPath, filename);
  });

  ipcMain.handle('mods:openFolder', async (_event, serverPath) => {
    const modsDir = path.join(serverPath, 'mods');
    if (!fs.existsSync(modsDir)) {
      fs.mkdirSync(modsDir, { recursive: true });
    }
    await shell.openPath(modsDir);
    return { success: true };
  });

  ipcMain.handle('mods:import', async (_event, serverPath) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Выберите файлы модов (.jar)',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Minecraft Mods', extensions: ['jar'] }]
    });
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }
    const modsDir = path.join(serverPath, 'mods');
    if (!fs.existsSync(modsDir)) {
      fs.mkdirSync(modsDir, { recursive: true });
    }
    let count = 0;
    for (const src of result.filePaths) {
      const dest = path.join(modsDir, path.basename(src));
      fs.copyFileSync(src, dest);
      count++;
    }
    return { success: true, count };
  });

  ipcMain.handle('bluemap:check', (_event, args) => {
    const serverPath = typeof args === 'string' ? args : (args?.serverPath || '');
    const port = typeof args === 'object' ? (args?.port || 25565) : 25565;
    return bluemapService.isBlueMapInstalled(serverPath, port);
  });

  ipcMain.handle('bluemap:install', async (_event, { serverPath, loader, mcVer, port = 25565 }) => {
    return await bluemapService.installBlueMap(serverPath, loader, mcVer, port);
  });

  ipcMain.handle('bluemap:purgeMap', async (_event, serverPath) => {
    return bluemapService.purgeBlueMap(serverPath);
  });

  ipcMain.handle('bluemap:clearCache', async () => {
    try {
      const { session } = await import('electron');
      await session.defaultSession.clearCache();
      await session.defaultSession.clearStorageData();
      return true;
    } catch (e) {
      return false;
    }
  });

  ipcMain.handle('bluemap:isReady', async (_event, port = 8100) => {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(800);
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });
      socket.connect(port, '127.0.0.1');
    });
  });

  ipcMain.handle('modpacks:search', async (_event, params) => {
    return await modpackService.searchModrinthModpacks(params || {});
  });

  ipcMain.handle('modpacks:versions', async (_event, slugOrId) => {
    return await modpackService.getModrinthModpackVersions(slugOrId);
  });

  ipcMain.handle('modpacks:download', async (_event, params) => {
    return await modpackService.downloadModrinthModpack(params, (p) => {
      if (mainWindow) mainWindow.webContents.send('modpacks:download-progress', p);
    });
  });

  ipcMain.handle('modpacks:list', () => {
    return modpackService.listLocalModpacks();
  });

  ipcMain.handle('modpacks:create', (_event, data) => {
    return modpackService.createLocalModpack(data);
  });

  ipcMain.handle('modpacks:delete', (_event, id) => {
    return modpackService.deleteLocalModpack(id);
  });

  ipcMain.handle('version:loaderVersions', async (_event, { loader, mcVersion }) => {
    return await versionService.getLoaderVersions(loader, mcVersion);
  });

  ipcMain.handle('xmcl:export', async (_event, server) => {
    return await xmclService.exportServerToXmcl(server);
  });

  ipcMain.handle('xmcl:isInstalled', () => {
    return xmclService.isXmclInstalled();
  });
}
