import os from 'os';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { spawn, execSync } from 'child_process';
import axios from 'axios';
import natUpnp from 'nat-upnp';
import { getBinDir, migrateLegacyData } from './pathManager.js';

const getSecretPath = () => path.join(getBinDir(), 'playit_secret.txt');
const getTomlPath = () => path.join(getBinDir(), 'playit.toml');

let upnpClient = null;
let playitProcess = null;
let claimPollTimer = null;
let currentTargetPort = 25565;
const statusListeners = new Set();

let playitStatus = {
  running: false,
  claimUrl: null,
  tunnelAddress: null,
  logs: []
};

export function onPlayitStatus(fn) {
  statusListeners.add(fn);
  return () => statusListeners.delete(fn);
}

function broadcastStatus() {
  const snapshot = { ...playitStatus };
  for (const fn of statusListeners) {
    try {
      fn(snapshot);
    } catch (e) {}
  }
}

function ensureBinDir() {
  migrateLegacyData();
  const binDir = getBinDir();
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }
}

export function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

export function toggleUpnp(port = 25565, enable = true) {
  return new Promise((resolve) => {
    try {
      if (!upnpClient) {
        upnpClient = natUpnp.createClient();
      }

      if (enable) {
        upnpClient.portMapping(
          {
            public: port,
            private: port,
            ttl: 0,
            description: 'Spruce Minecraft Server'
          },
          (err) => {
            if (err) {
              resolve({ success: false, error: err.message, port });
            } else {
              resolve({ success: true, enabled: true, port });
            }
          }
        );
      } else {
        upnpClient.portUnmapping(
          {
            public: port
          },
          (err) => {
            if (err) {
              resolve({ success: false, error: err.message, port });
            } else {
              resolve({ success: true, enabled: false, port });
            }
          }
        );
      }
    } catch (e) {
      resolve({ success: false, error: e.message, port });
    }
  });
}

export async function ensurePlayitBinary() {
  ensureBinDir();
  const exePath = path.join(getBinDir(), 'playit.exe');
  if (fs.existsSync(exePath)) {
    return exePath;
  }

  const downloadUrl = 'https://github.com/playit-cloud/playit-agent/releases/latest/download/playit-windows-x86_64.exe';
  const response = await axios({
    method: 'GET',
    url: downloadUrl,
    responseType: 'arraybuffer',
    maxRedirects: 5,
    timeout: 30000
  });

  fs.writeFileSync(exePath, Buffer.from(response.data));
  return exePath;
}

function getStoredSecret() {
  const secretPath = getSecretPath();
  const tomlPath = getTomlPath();
  if (fs.existsSync(secretPath)) {
    const s = fs.readFileSync(secretPath, 'utf8').trim();
    if (s) return s;
  }
  if (fs.existsSync(tomlPath)) {
    const content = fs.readFileSync(tomlPath, 'utf8');
    const match = content.match(/secret_key\s*=\s*["']([^"']+)["']/);
    if (match) return match[1].trim();
  }
  return null;
}

function saveSecret(secret) {
  ensureBinDir();
  fs.writeFileSync(getSecretPath(), secret.trim());
  fs.writeFileSync(getTomlPath(), `secret_key = "${secret.trim()}"\n`);
}

async function fetchRundataTunnels(secret) {
  try {
    const res = await axios.post('https://api.playit.gg/agents/rundata', {}, {
      headers: {
        'Authorization': `Agent-Key ${secret}`,
        'Content-Type': 'application/json'
      },
      timeout: 8000
    });

    if (res.data && res.data.status === 'success' && res.data.data) {
      const tunnels = res.data.data.tunnels || [];
      return tunnels;
    }
  } catch (e) {
  }
  return [];
}

function getTunnelLocalPort(t) {
  if (!t) return null;
  if (typeof t.local_port === 'number') return t.local_port;
  if (t.origin && t.origin.data) {
    if (typeof t.origin.data.local_port === 'number') return t.origin.data.local_port;
    if (typeof t.origin.data.port === 'number') return t.origin.data.port;
  }
  if (t.port && typeof t.port.local === 'number') return t.port.local;
  return null;
}

async function createMinecraftTunnel(secret, port = 25565) {
  try {
    let agentId = null;
    try {
      const rundataRes = await axios.post('https://api.playit.gg/agents/rundata', {}, {
        headers: {
          'Authorization': `Agent-Key ${secret}`,
          'Content-Type': 'application/json'
        },
        timeout: 8000
      });
      agentId = rundataRes.data?.data?.agent_id || rundataRes.data?.data?.id || rundataRes.data?.data?.agent?.id;
    } catch (e) {}

    const numPort = Number(port) || 25565;
    const payload = {
      name: `minecraft-${numPort}`,
      tunnel_type: 'minecraft-java',
      port_type: 'both',
      port_count: 1,
      enabled: true,
      origin: agentId ? {
        type: 'agent',
        data: {
          agent_id: agentId,
          local_ip: '127.0.0.1',
          local_port: numPort
        }
      } : {
        type: 'default',
        data: {
          port: numPort
        }
      }
    };

    const res = await axios.post('https://api.playit.gg/tunnels/create', payload, {
      headers: {
        'Authorization': `Agent-Key ${secret}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    if (res.data && res.data.status === 'success' && res.data.data) {
      return res.data.data;
    }
  } catch (e) {
  }
  return null;
}

export async function startPlayit(onStatusChange, targetPort = 25565) {
  if (onStatusChange) {
    statusListeners.add(onStatusChange);
  }
  currentTargetPort = Number(targetPort) || 25565;
  ensureBinDir();
  const exePath = await ensurePlayitBinary();
  const secret = getStoredSecret();

  if (playitProcess) {
    if (secret) {
      const tunnels = await fetchRundataTunnels(secret);
      let matched = tunnels.find((t) => getTunnelLocalPort(t) === currentTargetPort);
      if (!matched) {
        matched = await createMinecraftTunnel(secret, currentTargetPort);
      }
      if (matched) {
        const domain = matched.custom_domain || matched.assigned_domain;
        if (domain) {
          const p = matched.port ? (matched.port.from || matched.port) : currentTargetPort;
          playitStatus.tunnelAddress = `${domain}:${p}`;
        }
      }
      broadcastStatus();
    }
    return playitStatus;
  }

  playitStatus = {
    running: true,
    claimUrl: null,
    tunnelAddress: null,
    logs: []
  };

  if (!secret) {
    const claimCode = crypto.randomBytes(8).toString('hex');
    const claimUrl = `https://playit.gg/claim/${claimCode}`;
    playitStatus.claimUrl = claimUrl;
    playitStatus.logs.push(`[Spruce] Требуется привязка: ${claimUrl}`);
    broadcastStatus();

    try {
      await axios.post('https://api.playit.gg/claim/setup', {
        code: claimCode,
        agent_type: 'self-managed',
        version: '1.0.10'
      }, { timeout: 8000 });
    } catch (e) {
      playitStatus.logs.push(`[Spruce] Ошибка инициализации claim: ${e.message}`);
    }

    if (claimPollTimer) clearInterval(claimPollTimer);

    claimPollTimer = setInterval(async () => {
      try {
        const checkRes = await axios.post('https://api.playit.gg/claim/setup', {
          code: claimCode,
          agent_type: 'self-managed',
          version: '1.0.10'
        }, { timeout: 6000 });

        const resultState = checkRes.data ? checkRes.data.data : null;

        if (resultState === 'UserAccepted') {
          clearInterval(claimPollTimer);
          claimPollTimer = null;

          const exchRes = await axios.post('https://api.playit.gg/claim/exchange', {
            code: claimCode
          }, { timeout: 6000 });

          if (exchRes.data && exchRes.data.status === 'success' && exchRes.data.data) {
            const newSecret = exchRes.data.data.secret_key;
            saveSecret(newSecret);
            playitStatus.claimUrl = null;
            playitStatus.logs.push('[Spruce] Аккаунт Playit успешно привязан!');
            broadcastStatus();

            await launchDaemon(exePath, newSecret, currentTargetPort);
          }
        }
      } catch (err) {
      }
    }, 2500);

    return playitStatus;
  }

  await launchDaemon(exePath, secret, currentTargetPort);
  return playitStatus;
}

async function launchDaemon(exePath, secret, targetPort = 25565) {
  currentTargetPort = Number(targetPort) || 25565;
  let tunnels = await fetchRundataTunnels(secret);
  let matched = tunnels.find((t) => getTunnelLocalPort(t) === currentTargetPort);

  if (!matched) {
    const created = await createMinecraftTunnel(secret, currentTargetPort);
    if (created) {
      const refreshed = await fetchRundataTunnels(secret);
      matched = refreshed.find((t) => getTunnelLocalPort(t) === currentTargetPort);
    }
  }

  if (matched) {
    const domain = matched.custom_domain || matched.assigned_domain;
    if (domain) {
      const p = matched.port ? (matched.port.from || matched.port) : currentTargetPort;
      playitStatus.tunnelAddress = `${domain}:${p}`;
      playitStatus.logs.push(`[Spruce] Адрес туннеля: ${playitStatus.tunnelAddress}`);
    }
  }
  broadcastStatus();

  try {
    execSync('taskkill /F /IM playit.exe', { stdio: 'ignore' });
  } catch (e) {}

  playitProcess = spawn(exePath, ['--secret', secret], {
    cwd: getBinDir(),
    windowsHide: true
  });

  const handleOutput = (chunk) => {
    const text = chunk.toString();
    playitStatus.logs.push(text.trim());
    if (playitStatus.logs.length > 80) playitStatus.logs.shift();

    const claimMatch = text.match(/https:\/\/playit\.gg\/claim\/[a-zA-Z0-9_-]+/);
    if (claimMatch) {
      playitStatus.claimUrl = claimMatch[0];
    }

    const tunnelMatch = text.match(/([a-zA-Z0-9-]+\.gl\.joinmc\.link:\d+)/) ||
                        text.match(/([a-zA-Z0-9-]+\.ply\.gg:\d+)/);
    if (tunnelMatch && (!playitStatus.tunnelAddress || playitStatus.tunnelAddress.includes('undefined'))) {
      playitStatus.tunnelAddress = tunnelMatch[1];
    }

    if (!playitStatus.tunnelAddress && text.includes('playit connected')) {
      fetchRundataTunnels(secret).then((list) => {
        const m = list.find((t) => getTunnelLocalPort(t) === currentTargetPort);
        if (m) {
          const d = m.custom_domain || m.assigned_domain;
          if (d) {
            const prt = m.port ? (m.port.from || m.port) : currentTargetPort;
            playitStatus.tunnelAddress = `${d}:${prt}`;
            broadcastStatus();
          }
        }
      }).catch(() => {});
    }

    broadcastStatus();
  };

  playitProcess.stdout.on('data', handleOutput);
  playitProcess.stderr.on('data', handleOutput);

  playitProcess.on('close', () => {
    playitProcess = null;
    playitStatus.running = false;
    broadcastStatus();
  });
}

export function setCustomPlayitSecret(secret) {
  saveSecret(secret);
  return true;
}

export function stopPlayit() {
  if (claimPollTimer) {
    clearInterval(claimPollTimer);
    claimPollTimer = null;
  }

  if (playitProcess) {
    try { playitProcess.kill('SIGKILL'); } catch (e) {}
    playitProcess = null;
  }

  try {
    execSync('taskkill /F /IM playit.exe', { stdio: 'ignore' });
  } catch (e) {}

  playitStatus.running = false;
  broadcastStatus();
  return playitStatus;
}

export async function getPlayitStatus(targetPort) {
  playitStatus.running = !!playitProcess;
  const numPort = targetPort ? Number(targetPort) : currentTargetPort;
  if (numPort) currentTargetPort = numPort;

  const secret = getStoredSecret();
  if (secret) {
    const tunnels = await fetchRundataTunnels(secret);
    if (tunnels.length > 0) {
      let matched = tunnels.find((t) => getTunnelLocalPort(t) === currentTargetPort);
      if (!matched && !targetPort) matched = tunnels[0];
      if (!matched && targetPort) {
        matched = await createMinecraftTunnel(secret, currentTargetPort);
      }
      if (matched) {
        const domain = matched.custom_domain || matched.assigned_domain;
        if (domain) {
          const p = matched.port ? (matched.port.from || matched.port) : currentTargetPort;
          playitStatus.tunnelAddress = `${domain}:${p}`;
        }
      }
    }
  }
  return { ...playitStatus };
}
