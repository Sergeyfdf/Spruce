import fs from 'fs';
import path from 'path';
import { exec, spawn } from 'child_process';
import { shell } from 'electron';
import { listServers } from './serverManager.js';

export function getXmclDir() {
  const appData = process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming');
  return path.join(appData, 'xmcl');
}

export function isXmclInstalled() {
  const dir = getXmclDir();
  return fs.existsSync(dir);
}

export function launchXmcl() {
  try {
    shell.openExternal('xmcl://');
  } catch (e) {}
  exec('explorer.exe shell:AppsFolder\\xmcl_wbnnev551gwxy!App', () => {});
}

export async function exportServerToXmcl(server) {
  const xmclDir = getXmclDir();
  if (!fs.existsSync(xmclDir)) {
    fs.mkdirSync(xmclDir, { recursive: true });
  }

  const instancesDir = path.join(xmclDir, 'instances');
  if (!fs.existsSync(instancesDir)) {
    fs.mkdirSync(instancesDir, { recursive: true });
  }

  const safeName = (server.name || 'Spruce Server').replace(/[/\\?%*:|"<>]/g, '_');
  const instancePath = path.join(instancesDir, safeName);
  if (!fs.existsSync(instancePath)) {
    fs.mkdirSync(instancePath, { recursive: true });
  }

  let spruceJson = {};
  try {
    const spruceJsonPath = path.join(server.path, 'spruce.json');
    if (fs.existsSync(spruceJsonPath)) {
      spruceJson = JSON.parse(fs.readFileSync(spruceJsonPath, 'utf8'));
    }
  } catch (e) {}

  const mcVersion = server.mcVersion || spruceJson.mcVersion || '1.20.1';
  const loader = (server.loader || spruceJson.loader || 'vanilla').toLowerCase();
  const loaderVer = server.loaderVersion || spruceJson.loaderVersion || '';

  const instanceJson = {
    name: server.name || safeName,
    resolution: {
      width: 1280,
      height: 720,
      fullscreen: false
    },
    minMemory: 0,
    maxMemory: server.ramMax || 4096,
    vmOptions: [],
    mcOptions: [],
    url: '',
    icon: '',
    showLog: false,
    hideLauncher: true,
    runtime: {
      minecraft: mcVersion,
      forge: loader === 'forge' ? loaderVer : '',
      fabricLoader: loader === 'fabric' ? loaderVer : '',
      neoForged: loader === 'neoforge' ? loaderVer : '',
      quiltLoader: loader === 'quilt' ? loaderVer : '',
      optifine: '',
      liteloader: '',
      yarn: ''
    },
    server: {
      ip: '127.0.0.1',
      port: server.port || 25565
    }
  };

  fs.writeFileSync(path.join(instancePath, 'instance.json'), JSON.stringify(instanceJson, null, 2), 'utf8');

  const serverModsDir = path.join(server.path, 'mods');
  const instanceModsDir = path.join(instancePath, 'mods');
  let modsCopied = 0;

  if (fs.existsSync(serverModsDir)) {
    if (!fs.existsSync(instanceModsDir)) {
      fs.mkdirSync(instanceModsDir, { recursive: true });
    }
    const files = fs.readdirSync(serverModsDir);
    for (const f of files) {
      if (f.endsWith('.jar') && !f.endsWith('.disabled')) {
        const src = path.join(serverModsDir, f);
        const dst = path.join(instanceModsDir, f);
        try {
          fs.copyFileSync(src, dst);
          modsCopied++;
        } catch (e) {}
      }
    }
  }

  const instancesJsonPath = path.join(xmclDir, 'instances.json');
  let instancesConfig = { selectedInstance: instancePath, instances: [], groups: [] };
  try {
    if (fs.existsSync(instancesJsonPath)) {
      instancesConfig = JSON.parse(fs.readFileSync(instancesJsonPath, 'utf8'));
    }
  } catch (e) {}

  if (!Array.isArray(instancesConfig.instances)) {
    instancesConfig.instances = [];
  }
  if (!instancesConfig.instances.includes(instancePath)) {
    instancesConfig.instances.push(instancePath);
  }
  instancesConfig.selectedInstance = instancePath;

  fs.writeFileSync(instancesJsonPath, JSON.stringify(instancesConfig, null, 2), 'utf8');

  launchXmcl();

  return {
    success: true,
    instancePath,
    instanceName: safeName,
    modsCopied
  };
}
