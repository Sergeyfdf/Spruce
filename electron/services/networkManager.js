import os from 'os';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { spawn, execSync } from 'child_process';
import axios from 'axios';
import natUpnp from 'nat-upnp';

const BIN_DIR = path.resolve(process.cwd(), 'bin');
const SECRET_PATH = path.join(BIN_DIR, 'playit_secret.txt');
const TOML_PATH = path.join(BIN_DIR, 'playit.toml');

let upnpClient = null;
let playitProcess = null;
let claimPollTimer = null;

let playitStatus = {
  running: false,
  claimUrl: null,
  tunnelAddress: null,
  logs: []
};

function ensureBinDir() {
  if (!fs.existsSync(BIN_DIR)) {
    fs.mkdirSync(BIN_DIR, { recursive: true });
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
  const exePath = path.join(BIN_DIR, 'playit.exe');
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
  if (fs.existsSync(SECRET_PATH)) {
    const s = fs.readFileSync(SECRET_PATH, 'utf8').trim();
    if (s) return s;
  }
  if (fs.existsSync(TOML_PATH)) {
    const content = fs.readFileSync(TOML_PATH, 'utf8');
    const match = content.match(/secret_key\s*=\s*["']([^"']+)["']/);
    if (match) return match[1].trim();
  }
  return null;
}

function saveSecret(secret) {
  ensureBinDir();
  fs.writeFileSync(SECRET_PATH, secret.trim());
  fs.writeFileSync(TOML_PATH, `secret_key = "${secret.trim()}"\n`);
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
  ensureBinDir();
  const exePath = await ensurePlayitBinary();
  const secret = getStoredSecret();

  if (playitProcess) {
    if (secret) {
      const tunnels = await fetchRundataTunnels(secret);
      const numPort = Number(targetPort) || 25565;
      let matched = tunnels.find((t) => getTunnelLocalPort(t) === numPort);
      if (!matched) {
        matched = await createMinecraftTunnel(secret, numPort);
        if (matched) {
          await launchDaemon(exePath, secret, onStatusChange, numPort);
        }
      } else {
        const domain = matched.custom_domain || matched.assigned_domain;
        if (domain) {
          const p = matched.port ? (matched.port.from || matched.port) : numPort;
          playitStatus.tunnelAddress = `${domain}:${p}`;
          if (onStatusChange) onStatusChange({ ...playitStatus });
        }
      }
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
    if (onStatusChange) onStatusChange({ ...playitStatus });

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
            if (onStatusChange) onStatusChange({ ...playitStatus });

            await launchDaemon(exePath, newSecret, onStatusChange, targetPort);
          }
        }
      } catch (err) {
      }
    }, 2500);

    return playitStatus;
  }

  await launchDaemon(exePath, secret, onStatusChange, targetPort);
  return playitStatus;
}

async function launchDaemon(exePath, secret, onStatusChange, targetPort = 25565) {
  const numPort = Number(targetPort) || 25565;
  let tunnels = await fetchRundataTunnels(secret);
  let matched = tunnels.find((t) => getTunnelLocalPort(t) === numPort);

  if (!matched) {
    const created = await createMinecraftTunnel(secret, numPort);
    if (created) {
      const refreshed = await fetchRundataTunnels(secret);
      matched = refreshed.find((t) => getTunnelLocalPort(t) === numPort);
    }
  }

  if (matched) {
    const domain = matched.custom_domain || matched.assigned_domain;
    if (domain) {
      const p = matched.port ? (matched.port.from || matched.port) : numPort;
      playitStatus.tunnelAddress = `${domain}:${p}`;
      playitStatus.logs.push(`[Spruce] Адрес туннеля: ${playitStatus.tunnelAddress}`);
      if (onStatusChange) onStatusChange({ ...playitStatus });
    } else {
      playitStatus.tunnelAddress = null;
    }
  }

  try {
    execSync('taskkill /F /IM playit.exe', { stdio: 'ignore' });
  } catch (e) {}

  playitProcess = spawn(exePath, ['--secret', secret], {
    cwd: BIN_DIR,
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

    if (onStatusChange) onStatusChange({ ...playitStatus });
  };

  playitProcess.stdout.on('data', handleOutput);
  playitProcess.stderr.on('data', handleOutput);

  playitProcess.on('close', () => {
    playitProcess = null;
    playitStatus.running = false;
    if (onStatusChange) onStatusChange({ ...playitStatus });
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
  return playitStatus;
}

export async function getPlayitStatus(targetPort) {
  playitStatus.running = !!playitProcess;

  const secret = getStoredSecret();
  if (secret) {
    const tunnels = await fetchRundataTunnels(secret);
    if (tunnels.length > 0) {
      const numPort = targetPort ? Number(targetPort) : null;
      let matched = numPort ? tunnels.find((t) => getTunnelLocalPort(t) === numPort) : null;
      if (!matched && !numPort) matched = tunnels[0];
      if (matched) {
        const domain = matched.custom_domain || matched.assigned_domain;
        if (domain) {
          const p = matched.port ? (matched.port.from || matched.port) : (numPort || 25565);
          return {
            ...playitStatus,
            tunnelAddress: `${domain}:${p}`
          };
        }
      }
      return {
        ...playitStatus,
        tunnelAddress: null
      };
    }
  }
  return playitStatus;
}
