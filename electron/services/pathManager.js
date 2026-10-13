import fs from 'fs';
import path from 'path';
import electron from 'electron';

function getUserDataDir() {
  const app = electron && typeof electron === 'object' ? (electron.app || electron.default?.app) : null;
  if (app && typeof app.getPath === 'function') {
    return app.getPath('userData');
  }
  const base = process.env.APPDATA || (process.platform === 'darwin' ? path.join(process.env.HOME, 'Library', 'Application Support') : path.join(process.env.HOME, '.config'));
  return path.join(base, 'Spruce');
}

export const USER_DATA_DIR = getUserDataDir();
const CONFIG_PATH = path.join(USER_DATA_DIR, 'config.json');

function readConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    }
  } catch (e) {}
  return {};
}

function writeConfig(cfg) {
  try {
    if (!fs.existsSync(USER_DATA_DIR)) {
      fs.mkdirSync(USER_DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
  } catch (e) {}
}

export function getDataDirectory() {
  const cfg = readConfig();
  if (cfg.customDataDir && typeof cfg.customDataDir === 'string') {
    try {
      if (fs.existsSync(cfg.customDataDir)) {
        return path.resolve(cfg.customDataDir);
      }
    } catch (e) {}
  }
  return USER_DATA_DIR;
}

export function getServersDir() {
  return path.join(getDataDirectory(), 'servers');
}

export function getBinDir() {
  return path.join(getDataDirectory(), 'bin');
}

export function getRuntimesDir() {
  return path.join(getDataDirectory(), 'runtimes');
}

export function getModpacksDir() {
  const dir = path.join(getDataDirectory(), 'modpacks');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export const SERVERS_DIR = path.join(USER_DATA_DIR, 'servers');
export const BIN_DIR = path.join(USER_DATA_DIR, 'bin');
export const RUNTIMES_DIR = path.join(USER_DATA_DIR, 'runtimes');

export function isSetupCompleted() {
  const cfg = readConfig();
  if (cfg.setupCompleted === true) return true;
  const sDir = getServersDir();
  if (fs.existsSync(sDir)) {
    try {
      const entries = fs.readdirSync(sDir);
      if (entries.length > 0) return true;
    } catch (e) {}
  }
  return false;
}

export function completeInitialSetup(dirPath) {
  if (dirPath && typeof dirPath === 'string' && dirPath.trim() !== '') {
    return setDataDirectory(dirPath.trim());
  }
  const cfg = readConfig();
  cfg.setupCompleted = true;
  writeConfig(cfg);
  return { success: true, dataDir: getDataDirectory() };
}

export function setDataDirectory(newPath) {
  if (!newPath || typeof newPath !== 'string') {
    return { success: false, error: 'Не указана папка' };
  }

  const targetDir = path.resolve(newPath.trim());
  try {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
  } catch (e) {
    return { success: false, error: e.message };
  }

  const oldServers = getServersDir();
  const oldRuntimes = getRuntimesDir();
  const oldBin = getBinDir();

  const cfg = readConfig();
  cfg.customDataDir = targetDir;
  cfg.setupCompleted = true;
  writeConfig(cfg);

  const newServers = getServersDir();
  const newRuntimes = getRuntimesDir();
  const newBin = getBinDir();

  if (!fs.existsSync(newServers)) fs.mkdirSync(newServers, { recursive: true });
  if (!fs.existsSync(newRuntimes)) fs.mkdirSync(newRuntimes, { recursive: true });
  if (!fs.existsSync(newBin)) fs.mkdirSync(newBin, { recursive: true });

  if (fs.existsSync(oldServers) && path.resolve(oldServers) !== path.resolve(newServers)) {
    try {
      const items = fs.readdirSync(oldServers);
      for (const item of items) {
        const src = path.join(oldServers, item);
        const dst = path.join(newServers, item);
        if (fs.existsSync(src) && fs.statSync(src).isDirectory() && !fs.existsSync(dst)) {
          fs.cpSync(src, dst, { recursive: true });
        }
      }
    } catch (e) {}
  }

  if (fs.existsSync(oldRuntimes) && path.resolve(oldRuntimes) !== path.resolve(newRuntimes)) {
    try {
      const items = fs.readdirSync(oldRuntimes);
      for (const item of items) {
        const src = path.join(oldRuntimes, item);
        const dst = path.join(newRuntimes, item);
        if (fs.existsSync(src) && fs.statSync(src).isDirectory() && !fs.existsSync(dst)) {
          fs.cpSync(src, dst, { recursive: true });
        }
      }
    } catch (e) {}
  }

  if (fs.existsSync(oldBin) && path.resolve(oldBin) !== path.resolve(newBin)) {
    try {
      const items = fs.readdirSync(oldBin);
      for (const item of items) {
        const src = path.join(oldBin, item);
        const dst = path.join(newBin, item);
        if (fs.existsSync(src) && !fs.existsSync(dst)) {
          fs.copyFileSync(src, dst);
        }
      }
    } catch (e) {}
  }

  return { success: true, dataDir: targetDir };
}

let migrationDone = false;

export function migrateLegacyData() {
  if (migrationDone) return;
  migrationDone = true;

  const currentServers = getServersDir();
  const currentBin = getBinDir();
  const currentRuntimes = getRuntimesDir();

  if (!fs.existsSync(currentServers)) fs.mkdirSync(currentServers, { recursive: true });
  if (!fs.existsSync(currentBin)) fs.mkdirSync(currentBin, { recursive: true });
  if (!fs.existsSync(currentRuntimes)) fs.mkdirSync(currentRuntimes, { recursive: true });

  const legacyServerSources = [
    path.resolve(process.cwd(), 'servers'),
    path.resolve('c:/Users/Marzipan/Desktop/Spruce/servers')
  ];

  for (const src of legacyServerSources) {
    if (fs.existsSync(src) && path.resolve(src) !== path.resolve(currentServers)) {
      try {
        const items = fs.readdirSync(src);
        for (const item of items) {
          const itemSrc = path.join(src, item);
          const itemDst = path.join(currentServers, item);
          if (fs.existsSync(itemSrc) && fs.statSync(itemSrc).isDirectory() && !fs.existsSync(itemDst)) {
            fs.cpSync(itemSrc, itemDst, { recursive: true });
          }
        }
      } catch (e) {}
    }
  }

  const legacyBinSources = [
    path.resolve(process.cwd(), 'bin'),
    path.resolve('c:/Users/Marzipan/Desktop/Spruce/bin')
  ];

  for (const src of legacyBinSources) {
    if (fs.existsSync(src) && path.resolve(src) !== path.resolve(currentBin)) {
      try {
        const items = fs.readdirSync(src);
        for (const item of items) {
          const itemSrc = path.join(src, item);
          const itemDst = path.join(currentBin, item);
          if (fs.existsSync(itemSrc) && !fs.existsSync(itemDst)) {
            fs.copyFileSync(itemSrc, itemDst);
          }
        }
      } catch (e) {}
    }
  }

  const legacyRuntimeSources = [
    path.resolve(process.cwd(), 'runtimes'),
    path.resolve('c:/Users/Marzipan/Desktop/Spruce/runtimes')
  ];

  for (const src of legacyRuntimeSources) {
    if (fs.existsSync(src) && path.resolve(src) !== path.resolve(currentRuntimes)) {
      try {
        const items = fs.readdirSync(src);
        for (const item of items) {
          const itemSrc = path.join(src, item);
          const itemDst = path.join(currentRuntimes, item);
          if (fs.existsSync(itemSrc) && fs.statSync(itemSrc).isDirectory() && !fs.existsSync(itemDst)) {
            fs.cpSync(itemSrc, itemDst, { recursive: true });
          }
        }
      } catch (e) {}
    }
  }
}
