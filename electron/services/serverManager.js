import fs from 'fs';
import path from 'path';
import { spawn, execSync } from 'child_process';
import axios from 'axios';
import { resolveJavaPath } from './javaManager.js';
import { getRecommendedJava, getFabricLoaders, getForgeVersion, getNeoForgeVersion } from './versionService.js';
import { startPlayit, stopPlayit } from './networkManager.js';
import { ensureBlueMapConfig } from './bluemapService.js';

const SERVERS_DIR = path.resolve(process.cwd(), 'servers');
const runningProcesses = new Map();
const serverLogs = new Map();
const onlinePlayersMap = new Map();
const statusCallbacks = new Map();

export function ensureServersDir() {
  if (!fs.existsSync(SERVERS_DIR)) {
    fs.mkdirSync(SERVERS_DIR, { recursive: true });
  }
}

export function listServers() {
  ensureServersDir();
  const entries = fs.readdirSync(SERVERS_DIR);
  const result = [];

  for (const dirName of entries) {
    const sDir = path.join(SERVERS_DIR, dirName);
    const metaPath = path.join(sDir, 'spruce.json');
    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        const isRunning = runningProcesses.has(meta.id);
        const onlinePlayers = onlinePlayersMap.get(meta.id) || [];
        result.push({
          ...meta,
          path: sDir,
          status: isRunning ? 'online' : 'offline',
          onlinePlayersCount: onlinePlayers.length,
          onlinePlayers,
          blueMapPort: 8100 + (((parseInt(meta.port, 10) || 25565) - 25565) % 100)
        });
      } catch (e) {
      }
    }
  }

  return result;
}

export async function createServer({ name, mcVersion, loader, ramMin = 2048, ramMax = 4096, port = 25565, seed = '' }, onProgress) {
  ensureServersDir();
  const id = 'srv_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
  const serverPath = path.join(SERVERS_DIR, id);
  fs.mkdirSync(serverPath, { recursive: true });

  const requiredJava = getRecommendedJava(mcVersion);
  const cleanSeed = (seed || '').trim();

  const meta = {
    id,
    name,
    mcVersion,
    loader,
    ramMin,
    ramMax,
    port,
    seed: cleanSeed,
    javaVersion: requiredJava,
    jarName: 'server.jar',
    launchType: 'jar',
    createdAt: new Date().toISOString()
  };

  fs.writeFileSync(path.join(serverPath, 'spruce.json'), JSON.stringify(meta, null, 2));
  fs.writeFileSync(path.join(serverPath, 'eula.txt'), 'eula=true\n');

  const defaultProps = `server-port=${port}\nlevel-seed=${cleanSeed}\nmotd=A Spruce Minecraft Server\nmax-players=20\nonline-mode=false\npvp=true\ndifficulty=normal\n`;
  fs.writeFileSync(path.join(serverPath, 'server.properties'), defaultProps);

  const jarPath = path.join(serverPath, 'server.jar');

  if (loader === 'fabric') {
    const loaders = await getFabricLoaders(mcVersion);
    const loaderVer = loaders[0] || '0.16.10';
    const installerVer = '1.0.1';
    const fabricUrl = `https://meta.fabricmc.net/v2/versions/loader/${mcVersion}/${loaderVer}/${installerVer}/server/jar`;

    const jarRes = await axios({
      method: 'GET',
      url: fabricUrl,
      responseType: 'arraybuffer',
      onDownloadProgress: (p) => {
        if (onProgress && p.total) onProgress(Math.round((p.loaded * 100) / p.total));
      }
    });
    fs.writeFileSync(jarPath, Buffer.from(jarRes.data));
  } else if (loader === 'forge') {
    const forgeVer = await getForgeVersion(mcVersion);
    if (!forgeVer) {
      throw new Error(`Версия Forge для Minecraft ${mcVersion} не найдена`);
    }

    const installerUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${mcVersion}-${forgeVer}/forge-${mcVersion}-${forgeVer}-installer.jar`;
    const installerPath = path.join(serverPath, 'forge-installer.jar');

    const dlRes = await axios({
      method: 'GET',
      url: installerUrl,
      responseType: 'arraybuffer',
      onDownloadProgress: (p) => {
        if (onProgress && p.total) onProgress(Math.round((p.loaded * 100) / p.total));
      }
    });
    fs.writeFileSync(installerPath, Buffer.from(dlRes.data));

    const javaExe = await resolveJavaPath(requiredJava);
    try {
      execSync(`"${javaExe}" -jar forge-installer.jar --installServer`, {
        cwd: serverPath,
        stdio: 'ignore'
      });
    } catch (e) {
    }

    if (fs.existsSync(installerPath)) {
      try { fs.unlinkSync(installerPath); } catch (e) {}
    }

    const runBatPath = path.join(serverPath, 'run.bat');
    if (fs.existsSync(runBatPath)) {
      meta.launchType = 'run_bat';
    } else {
      const files = fs.readdirSync(serverPath);
      const forgeJar = files.find((f) => f.startsWith('forge-') && f.endsWith('.jar') && !f.includes('installer'));
      if (forgeJar) {
        meta.jarName = forgeJar;
      }
    }
    fs.writeFileSync(path.join(serverPath, 'spruce.json'), JSON.stringify(meta, null, 2));
  } else if (loader === 'neoforge') {
    const neoVer = await getNeoForgeVersion(mcVersion);
    if (!neoVer) {
      throw new Error(`Версия NeoForge для Minecraft ${mcVersion} не найдена (поддерживается с 1.20.2+)`);
    }

    const installerUrl = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${neoVer}/neoforge-${neoVer}-installer.jar`;
    const installerPath = path.join(serverPath, 'neoforge-installer.jar');

    const dlRes = await axios({
      method: 'GET',
      url: installerUrl,
      responseType: 'arraybuffer',
      onDownloadProgress: (p) => {
        if (onProgress && p.total) onProgress(Math.round((p.loaded * 100) / p.total));
      }
    });
    fs.writeFileSync(installerPath, Buffer.from(dlRes.data));

    const javaExe = await resolveJavaPath(requiredJava);
    try {
      execSync(`"${javaExe}" -jar neoforge-installer.jar --installServer`, {
        cwd: serverPath,
        stdio: 'ignore'
      });
    } catch (e) {
    }

    if (fs.existsSync(installerPath)) {
      try { fs.unlinkSync(installerPath); } catch (e) {}
    }

    const runBatPath = path.join(serverPath, 'run.bat');
    if (fs.existsSync(runBatPath)) {
      meta.launchType = 'run_bat';
    }
    fs.writeFileSync(path.join(serverPath, 'spruce.json'), JSON.stringify(meta, null, 2));
  } else {
    await downloadVanillaJar(mcVersion, jarPath, onProgress);
  }

  return {
    ...meta,
    path: serverPath,
    status: 'offline'
  };
}

async function downloadVanillaJar(mcVersion, targetPath, onProgress) {
  const manifestRes = await axios.get('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json');
  const targetVerObj = manifestRes.data.versions.find((v) => v.id === mcVersion);
  if (!targetVerObj) {
    throw new Error(`Версия ${mcVersion} не найдена в манифесте Mojang`);
  }

  const verDataRes = await axios.get(targetVerObj.url);
  const serverDownloadUrl = verDataRes.data.downloads.server.url;

  const jarRes = await axios({
    method: 'GET',
    url: serverDownloadUrl,
    responseType: 'arraybuffer',
    onDownloadProgress: (p) => {
      if (onProgress && p.total) onProgress(Math.round((p.loaded * 100) / p.total));
    }
  });

  fs.writeFileSync(targetPath, Buffer.from(jarRes.data));
}

export async function startServer(serverId, onLog, onStatusChange) {
  if (runningProcesses.has(serverId)) {
    return { success: false, message: 'Server is already running' };
  }

  for (const [otherId] of runningProcesses.entries()) {
    if (otherId !== serverId) {
      throw new Error('Другой сервер уже запущен. Останови его перед запуском нового.');
    }
  }

  const serverPath = path.join(SERVERS_DIR, serverId);
  const metaPath = path.join(serverPath, 'spruce.json');
  if (!fs.existsSync(metaPath)) {
    throw new Error('Server configuration spruce.json missing');
  }

  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const recJava = getRecommendedJava(meta.mcVersion);
  let requiredJava = meta.javaVersion;
  if (!requiredJava || requiredJava < recJava) {
    requiredJava = recJava;
    meta.javaVersion = recJava;
    try {
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
    } catch (e) {
    }
  }

  ensureBlueMapConfig(serverPath, meta.port);

  if (onLog) {
    onLog(serverId, `[Spruce] Проверка Java для ${meta.mcVersion} (Java ${requiredJava})...`);
  }

  const javaExe = await resolveJavaPath(requiredJava, (pct) => {
    if (onLog) onLog(serverId, `[Spruce] Загрузка Java ${requiredJava}: ${pct}%`);
  });

  if (onLog) {
    onLog(serverId, `[Spruce] Java бинарник: ${javaExe}`);
    onLog(serverId, `[Spruce] Запуск ${meta.name} (${meta.loader.toUpperCase()}) с ${meta.ramMax}MB RAM...`);
  }

  const hasRunBat = fs.existsSync(path.join(serverPath, 'run.bat'));
  if (hasRunBat) {
    const runBatPath = path.join(serverPath, 'run.bat');
    try {
      let batContent = fs.readFileSync(runBatPath, 'utf8');
      if (batContent.includes('pause')) {
        batContent = batContent.replace(/^\s*pause\s*$/gmi, '');
        fs.writeFileSync(runBatPath, batContent);
      }
    } catch (e) {}
  }
  const isRunScript = meta.launchType === 'run_bat' || hasRunBat;

  let proc = null;
  const isManaged = javaExe !== 'java';
  const javaBinDir = isManaged ? path.dirname(javaExe) : '';
  const javaHome = isManaged ? path.dirname(javaBinDir) : '';

  if (isRunScript) {
    const userJvmArgs = path.join(serverPath, 'user_jvm_args.txt');
    fs.writeFileSync(userJvmArgs, `-Xms${meta.ramMin || 1024}M\n-Xmx${meta.ramMax || 3072}M\n`);

    const spawnEnv = { ...process.env };
    if (isManaged) {
      spawnEnv.JAVA_HOME = javaHome;
      spawnEnv.PATH = `${javaBinDir};${process.env.PATH}`;
    }

    proc = spawn('cmd.exe', ['/c', 'run.bat', 'nogui'], {
      cwd: serverPath,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: spawnEnv
    });
  } else {
    const jarFile = meta.jarName || 'server.jar';
    const args = [
      `-Xms${meta.ramMin || 1024}M`,
      `-Xmx${meta.ramMax || 3072}M`,
      '-jar',
      jarFile,
      'nogui'
    ];

    proc = spawn(javaExe, args, {
      cwd: serverPath,
      stdio: ['pipe', 'pipe', 'pipe']
    });
  }

  runningProcesses.set(serverId, proc);
  if (!serverLogs.has(serverId)) serverLogs.set(serverId, []);
  if (!onlinePlayersMap.has(serverId)) onlinePlayersMap.set(serverId, []);

  if (onStatusChange) {
    statusCallbacks.set(serverId, onStatusChange);
    onStatusChange(serverId, 'online');
  }

  let playitLogged = false;
  try {
    startPlayit((status) => {
      if (onLog && status.tunnelAddress && !playitLogged) {
        playitLogged = true;
        onLog(serverId, `[Spruce] Playit туннель: ${status.tunnelAddress}`);
      }
    }, meta.port || 25565);
  } catch (e) {
  }

  proc.stdout.on('data', (data) => {
    const text = data.toString();
    appendLog(serverId, text, onLog);
    detectPlayerEvents(serverId, text);
  });

  proc.stderr.on('data', (data) => {
    const text = data.toString();
    appendLog(serverId, text, onLog);
  });

  proc.on('close', (code) => {
    runningProcesses.delete(serverId);
    onlinePlayersMap.set(serverId, []);
    appendLog(serverId, `[Spruce] Сервер остановлен с кодом ${code}`, onLog);
    if (onStatusChange) onStatusChange(serverId, 'offline');
    statusCallbacks.delete(serverId);
    try { stopPlayit(); } catch (e) {}
  });

  return { success: true };
}

function detectPlayerEvents(serverId, text) {
  const joinMatch = text.match(/([a-zA-Z0-9_]{3,16})\s+joined the game/i) ||
                    text.match(/UUID of player ([a-zA-Z0-9_]{3,16}) is/i);
  if (joinMatch) {
    const playerName = joinMatch[1];
    const current = onlinePlayersMap.get(serverId) || [];
    if (!current.includes(playerName)) {
      current.push(playerName);
      onlinePlayersMap.set(serverId, current);
    }
  }

  const leaveMatch = text.match(/([a-zA-Z0-9_]{3,16})\s+left the game/i) ||
                     text.match(/([a-zA-Z0-9_]{3,16})\s+lost connection/i);
  if (leaveMatch) {
    const playerName = leaveMatch[1];
    const current = onlinePlayersMap.get(serverId) || [];
    const next = current.filter((p) => p.toLowerCase() !== playerName.toLowerCase());
    onlinePlayersMap.set(serverId, next);
  }

  const deathMatch = text.match(/([a-zA-Z0-9_]{3,16})\s+(died|was slain|fell from|burned|drowned|hit the ground|blew up|froze|withered|suffocated|starved|walked into fire)/i);
  if (deathMatch) {
    try {
      const proc = runningProcesses.get(serverId);
      if (proc) {
        proc.stdin.write('save-all flush\n');
      }
    } catch (e) {}
  }
}

function appendLog(serverId, text, onLog) {
  const lines = text.split('\n');
  const buffer = serverLogs.get(serverId) || [];

  for (const line of lines) {
    if (!line.trim()) continue;
    const entry = {
      time: new Date().toLocaleTimeString(),
      text: line
    };
    buffer.push(entry);
    if (buffer.length > 2000) buffer.shift();
    if (onLog) onLog(serverId, line);
  }

  serverLogs.set(serverId, buffer);
}

export function getServerLogs(serverId) {
  return serverLogs.get(serverId) || [];
}

export function getOnlinePlayers(serverId) {
  return onlinePlayersMap.get(serverId) || [];
}

export function sendCommand(serverId, command) {
  const proc = runningProcesses.get(serverId);
  if (!proc) {
    throw new Error('Server is not running');
  }

  proc.stdin.write(command.trim() + '\n');
  appendLog(serverId, `> ${command.trim()}`);
  return true;
}

export function stopServer(serverId) {
  const proc = runningProcesses.get(serverId);
  if (!proc) {
    return false;
  }

  try {
    proc.stdin.write('stop\n');
  } catch (e) {}

  setTimeout(() => {
    if (runningProcesses.has(serverId)) {
      try {
        proc.stdin.write('\n');
      } catch (e) {}
    }
  }, 1500);

  setTimeout(() => {
    if (runningProcesses.has(serverId)) {
      killServer(serverId);
    }
  }, 7000);

  return true;
}

export function killServer(serverId) {
  const proc = runningProcesses.get(serverId);
  if (!proc) {
    return false;
  }

  if (process.platform === 'win32' && proc.pid) {
    try {
      execSync(`taskkill /PID ${proc.pid} /T /F`);
    } catch (e) {
      try { proc.kill('SIGKILL'); } catch (err) {}
    }
  } else {
    try { proc.kill('SIGKILL'); } catch (e) {}
  }

  runningProcesses.delete(serverId);
  onlinePlayersMap.set(serverId, []);
  const cb = statusCallbacks.get(serverId);
  if (cb) cb(serverId, 'offline');
  statusCallbacks.delete(serverId);
  try { stopPlayit(); } catch (e) {}
  return true;
}

export function deleteServer(serverId) {
  if (runningProcesses.has(serverId)) {
    killServer(serverId);
  }

  const serverPath = path.join(SERVERS_DIR, serverId);
  if (fs.existsSync(serverPath)) {
    fs.rmSync(serverPath, { recursive: true, force: true });
    serverLogs.delete(serverId);
    onlinePlayersMap.delete(serverId);
    return true;
  }
  return false;
}

export function getServerProperties(serverId) {
  const propsPath = path.join(SERVERS_DIR, serverId, 'server.properties');
  if (!fs.existsSync(propsPath)) {
    return {};
  }

  const lines = fs.readFileSync(propsPath, 'utf8').split('\n');
  const result = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.substring(0, eqIdx).trim();
      const val = trimmed.substring(eqIdx + 1).trim();
      result[key] = val;
    }
  }
  return result;
}

export function saveServerProperties(serverId, props) {
  const propsPath = path.join(SERVERS_DIR, serverId, 'server.properties');
  const lines = [];
  for (const [key, value] of Object.entries(props)) {
    lines.push(`${key}=${value}`);
  }
  fs.writeFileSync(propsPath, lines.join('\n') + '\n');

  const metaPath = path.join(SERVERS_DIR, serverId, 'spruce.json');
  if (fs.existsSync(metaPath) && props['level-seed'] !== undefined) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      meta.seed = props['level-seed'];
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
    } catch (e) {
    }
  }

  return true;
}
