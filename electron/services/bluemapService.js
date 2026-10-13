import fs from 'fs';
import path from 'path';
import axios from 'axios';

export function ensureBlueMapConfig(serverPath, mcPort = 25565) {
  const confDir = path.join(serverPath, 'config', 'bluemap');
  const confFile = path.join(confDir, 'core.conf');
  const webserverFile = path.join(confDir, 'webserver.conf');
  const parsedPort = parseInt(mcPort, 10) || 25565;
  const bmPort = 8100 + ((parsedPort - 25565) % 100);

  if (fs.existsSync(confFile)) {
    try {
      let content = fs.readFileSync(confFile, 'utf8');
      let changed = false;
      if (content.includes('accept-download: false')) {
        content = content.replace('accept-download: false', 'accept-download: true');
        changed = true;
      }
      if (content.includes('render-thread-count: 2')) {
        content = content.replace('render-thread-count: 2', 'render-thread-count: 1');
        changed = true;
      }
      if (content.includes('#render-thread-priority: 1')) {
        content = content.replace('#render-thread-priority: 1', 'render-thread-priority: 1');
        changed = true;
      }
      if (changed) {
        fs.writeFileSync(confFile, content);
      }
    } catch (e) {
    }
  } else {
    try {
      if (!fs.existsSync(confDir)) {
        fs.mkdirSync(confDir, { recursive: true });
      }
      fs.writeFileSync(confFile, 'accept-download: true\nrender-thread-count: 1\nrender-thread-priority: 1\n');
    } catch (e) {
    }
  }

  if (fs.existsSync(webserverFile)) {
    try {
      let content = fs.readFileSync(webserverFile, 'utf8');
      const portRegex = /^(\s*port:\s*)\d+/m;
      if (portRegex.test(content)) {
        const updated = content.replace(portRegex, `$1${bmPort}`);
        if (updated !== content) {
          fs.writeFileSync(webserverFile, updated);
        }
      } else {
        content += `\nport: ${bmPort}\n`;
        fs.writeFileSync(webserverFile, content);
      }
    } catch (e) {
    }
  } else {
    try {
      if (!fs.existsSync(confDir)) {
        fs.mkdirSync(confDir, { recursive: true });
      }
      fs.writeFileSync(webserverFile, `enabled: true\nwebroot: "bluemap/web"\nport: ${bmPort}\n`);
    } catch (e) {
    }
  }

  const webappFile = path.join(confDir, 'webapp.conf');
  if (fs.existsSync(webappFile)) {
    try {
      let content = fs.readFileSync(webappFile, 'utf8');
      let changed = false;
      if (content.includes('hires-slider-default: 100')) {
        content = content.replace('hires-slider-default: 100', 'hires-slider-default: 300');
        changed = true;
      }
      if (content.includes('hires-slider-max: 500')) {
        content = content.replace('hires-slider-max: 500', 'hires-slider-max: 1200');
        changed = true;
      }
      if (changed) {
        fs.writeFileSync(webappFile, content);
      }
    } catch (e) {
    }
  }

  const webSettingsFile = path.join(serverPath, 'bluemap', 'web', 'settings.json');
  if (fs.existsSync(webSettingsFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(webSettingsFile, 'utf8'));
      let changed = false;
      if (data.hiresSliderDefault === 100) {
        data.hiresSliderDefault = 300;
        changed = true;
      }
      if (data.hiresSliderMax === 500) {
        data.hiresSliderMax = 1200;
        changed = true;
      }
      if (changed) {
        fs.writeFileSync(webSettingsFile, JSON.stringify(data));
      }
    } catch (e) {
    }
  }
}

export function purgeBlueMap(serverPath) {
  try {
    const mapsDir = path.join(serverPath, 'bluemap', 'web', 'maps');
    if (fs.existsSync(mapsDir)) {
      fs.rmSync(mapsDir, { recursive: true, force: true });
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export function isBlueMapInstalled(serverPath, mcPort = 25565) {
  const modsDir = path.join(serverPath, 'mods');
  const pluginsDir = path.join(serverPath, 'plugins');

  let installed = false;
  if (fs.existsSync(modsDir)) {
    const files = fs.readdirSync(modsDir);
    if (files.some((f) => f.toLowerCase().includes('bluemap') && !f.endsWith('.disabled'))) {
      installed = true;
    }
  }

  if (!installed && fs.existsSync(pluginsDir)) {
    const files = fs.readdirSync(pluginsDir);
    if (files.some((f) => f.toLowerCase().includes('bluemap') && !f.endsWith('.disabled'))) {
      installed = true;
    }
  }

  if (installed) {
    ensureBlueMapConfig(serverPath, mcPort);
  }

  return installed;
}

export function pickBlueMapVersion(mcVer, loaderName, versions) {
  const normLoader = (loaderName || 'fabric').toLowerCase();
  const isPaperFamily = ['paper', 'purpur', 'spigot', 'folia', 'bukkit'].includes(normLoader);
  const isNeoforge = normLoader === 'neoforge';

  let mcMajor = 0;
  let mcMinor = 0;
  let mcPatch = 0;
  if (mcVer) {
    const parts = mcVer.split('.').map((p) => parseInt(p, 10) || 0);
    mcMajor = parts[0] || 0;
    mcMinor = parts[1] || 0;
    mcPatch = parts[2] || 0;
  }

  const isPre1205 = mcMajor === 1 && (mcMinor < 20 || (mcMinor === 20 && mcPatch <= 4));

  const filterCandidate = (v) => {
    const primaryFile = (v.files && v.files.find((f) => f.primary)) || (v.files && v.files[0]);
    const fn = (primaryFile?.filename || '').toLowerCase();
    const vn = (v.name || '').toLowerCase();

    if (isPre1205) {
      if (
        fn.includes('1.20-6') || fn.includes('1.20.6') || fn.includes('1.20.5') ||
        vn.includes('1.20-6') || vn.includes('1.20.6') || vn.includes('1.20.5') ||
        fn.includes('mc1.20-6')
      ) {
        return false;
      }
    }

    if (mcMajor === 1 && mcMinor < 20) {
      if (fn.includes('-1.20') || fn.includes('-1.21') || vn.includes('1.20') || vn.includes('1.21')) {
        return false;
      }
    }

    if (isPaperFamily) {
      return (v.loaders || []).some((l) => ['paper', 'purpur', 'spigot', 'folia', 'bukkit'].includes(l.toLowerCase()));
    }
    if (isNeoforge) {
      return (v.loaders || []).includes('neoforge') || (v.loaders || []).includes('forge');
    }
    return (v.loaders || []).includes(normLoader);
  };

  const candidates = (versions || []).filter(filterCandidate);

  let exact = candidates.filter((v) => (v.game_versions || []).includes(mcVer));
  if (isNeoforge && exact.length > 0) {
    const nativeNeo = exact.find((v) => (v.loaders || []).includes('neoforge'));
    if (nativeNeo) return nativeNeo;
  }
  if (exact.length > 0) return exact[0];

  if (mcVer) {
    const majorMinor = mcVer.split('.').slice(0, 2).join('.');
    const mmMatches = candidates.filter((v) => (v.game_versions || []).some((gv) => gv.startsWith(majorMinor)));
    if (isNeoforge && mmMatches.length > 0) {
      const nativeNeo = mmMatches.find((v) => (v.loaders || []).includes('neoforge'));
      if (nativeNeo) return nativeNeo;
    }
    if (mmMatches.length > 0) return mmMatches[0];
  }

  return candidates[0] || null;
}

export async function installBlueMap(serverPath, loader = 'fabric', mcVersion = '1.21.4', mcPort = 25565) {
  const normalizedLoader = (loader || 'fabric').toLowerCase();
  const isPaperFamily = ['paper', 'purpur', 'spigot', 'folia', 'bukkit'].includes(normalizedLoader);
  const targetDir = isPaperFamily
    ? path.join(serverPath, 'plugins')
    : path.join(serverPath, 'mods');

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  try {
    const modrinthUrl = 'https://api.modrinth.com/v2/project/bluemap/version';
    const mRes = await axios.get(modrinthUrl, {
      headers: { 'User-Agent': 'Spruce-Minecraft/1.0' },
      timeout: 10000
    });

    const versions = mRes.data || [];
    const match = pickBlueMapVersion(mcVersion, normalizedLoader, versions);

    if (match && match.files && match.files.length > 0) {
      const targetFile = match.files.find((f) => f.primary) || match.files[0];
      const filePath = path.join(targetDir, targetFile.filename);
      const fileRes = await axios({
        method: 'GET',
        url: targetFile.url,
        responseType: 'arraybuffer'
      });

      const existingFiles = fs.readdirSync(targetDir);
      for (const f of existingFiles) {
        if (f.toLowerCase().includes('bluemap') && f.toLowerCase().endsWith('.jar')) {
          try {
            fs.unlinkSync(path.join(targetDir, f));
          } catch (e) {
          }
        }
      }

      fs.writeFileSync(filePath, Buffer.from(fileRes.data));
      ensureBlueMapConfig(serverPath, mcPort);
      return {
        installed: true,
        filename: targetFile.filename
      };
    }
  } catch (err) {
  }

  try {
    const ghUrl = 'https://api.github.com/repos/BlueMap-Minecraft/BlueMap/releases?per_page=60';
    const releaseRes = await axios.get(ghUrl, {
      headers: { 'User-Agent': 'Spruce-Minecraft-Orchestrator/1.0' },
      timeout: 10000
    });

    const releases = releaseRes.data || [];
    let mcMajor = 0;
    let mcMinor = 0;
    let mcPatch = 0;
    if (mcVersion) {
      const parts = mcVersion.split('.').map((p) => parseInt(p, 10) || 0);
      mcMajor = parts[0] || 0;
      mcMinor = parts[1] || 0;
      mcPatch = parts[2] || 0;
    }
    const isPre1205 = mcMajor === 1 && (mcMinor < 20 || (mcMinor === 20 && mcPatch <= 4));

    let matchedAsset = null;
    for (const rel of releases) {
      for (const asset of (rel.assets || [])) {
        const aname = (asset.name || '').toLowerCase();
        if (isPre1205) {
          if (aname.includes('1.20-6') || aname.includes('1.20.6') || aname.includes('1.20.5')) {
            continue;
          }
        }
        let loaderOk = false;
        if (isPaperFamily) {
          loaderOk = aname.includes('paper') || aname.includes('spigot');
        } else if (normalizedLoader === 'neoforge') {
          loaderOk = aname.includes('neoforge') || aname.includes('forge');
        } else {
          loaderOk = aname.includes(normalizedLoader);
        }
        if (!loaderOk) continue;

        if (mcVersion && aname.includes(mcVersion)) {
          matchedAsset = asset;
          break;
        }
        if (mcVersion) {
          const majorMinor = mcVersion.split('.').slice(0, 2).join('.');
          if (aname.includes(majorMinor)) {
            matchedAsset = asset;
            break;
          }
        }
        if (!matchedAsset) {
          matchedAsset = asset;
        }
      }
      if (matchedAsset) break;
    }

    if (matchedAsset) {
      const filePath = path.join(targetDir, matchedAsset.name);
      const fileRes = await axios({
        method: 'GET',
        url: matchedAsset.browser_download_url,
        responseType: 'arraybuffer'
      });

      const existingFiles = fs.readdirSync(targetDir);
      for (const f of existingFiles) {
        if (f.toLowerCase().includes('bluemap') && f.toLowerCase().endsWith('.jar')) {
          try {
            fs.unlinkSync(path.join(targetDir, f));
          } catch (e) {
          }
        }
      }

      fs.writeFileSync(filePath, Buffer.from(fileRes.data));
      ensureBlueMapConfig(serverPath, mcPort);
      return {
        installed: true,
        filename: matchedAsset.name
      };
    }
  } catch (err) {
  }

  throw new Error('No compatible BlueMap release asset found');
}
