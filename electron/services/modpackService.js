import fs from 'fs';
import path from 'path';
import axios from 'axios';
import AdmZip from 'adm-zip';
import { getModpacksDir } from './pathManager.js';

export async function searchModrinthModpacks({ query = '', loader = '', mcVersion = '', limit = 24, offset = 0 }) {
  const facets = [['project_type:modpack']];
  if (loader && loader !== 'vanilla') {
    facets.push([`categories:${loader.toLowerCase()}`]);
  }
  if (mcVersion) {
    facets.push([`versions:${mcVersion}`]);
  }

  const params = {
    limit,
    offset,
    facets: JSON.stringify(facets)
  };
  if (query && query.trim()) {
    params.query = query.trim();
  } else {
    params.index = 'downloads';
  }

  try {
    const res = await axios.get('https://api.modrinth.com/v2/search', {
      params,
      headers: {
        'User-Agent': 'Spruce-Minecraft-Orchestrator/1.0'
      },
      timeout: 10000
    });

    return (res.data.hits || []).map((hit) => ({
      id: hit.project_id,
      slug: hit.slug,
      title: hit.title,
      description: hit.description,
      iconUrl: hit.icon_url,
      downloads: hit.downloads,
      follows: hit.follows,
      categories: hit.categories || [],
      versions: hit.versions || [],
      loaders: (hit.categories || []).filter((c) => ['fabric', 'forge', 'neoforge', 'quilt'].includes(c.toLowerCase())),
      author: hit.author,
      source: 'modrinth'
    }));
  } catch (err) {
    return [];
  }
}

export async function getModrinthModpackVersions(slugOrId) {
  try {
    const res = await axios.get(`https://api.modrinth.com/v2/project/${slugOrId}/version`, {
      headers: {
        'User-Agent': 'Spruce-Minecraft-Orchestrator/1.0'
      },
      timeout: 10000
    });
    return (res.data || []).map((v) => {
      const primaryFile = v.files.find((f) => f.primary) || v.files[0];
      return {
        id: v.id,
        name: v.name,
        versionNumber: v.version_number,
        gameVersions: v.game_versions || [],
        loaders: v.loaders || [],
        fileUrl: primaryFile?.url || null,
        filename: primaryFile?.filename || null,
        size: primaryFile?.size || 0,
        datePublished: v.date_published
      };
    });
  } catch (err) {
    return [];
  }
}

export async function downloadModrinthModpack(params, onProgress) {
  const { modpackId, versionId, title, iconUrl, mcVersion, loader, downloadUrl } = params;
  const modpacksDir = getModpacksDir();
  const mrpackFilename = `${modpackId}-${versionId}.mrpack`;
  const mrpackPath = path.join(modpacksDir, mrpackFilename);

  const res = await axios({
    method: 'GET',
    url: downloadUrl,
    responseType: 'arraybuffer',
    timeout: 30000,
    onDownloadProgress: (p) => {
      if (onProgress && p.total) {
        onProgress(Math.round((p.loaded * 100) / p.total));
      }
    }
  });

  fs.writeFileSync(mrpackPath, Buffer.from(res.data));

  let indexMeta = { game: 'minecraft', dependencies: {}, files: [] };
  try {
    const zip = new AdmZip(mrpackPath);
    const indexEntry = zip.getEntry('modrinth.index.json');
    if (indexEntry) {
      indexMeta = JSON.parse(indexEntry.getData().toString('utf8'));
    }
  } catch (e) {}

  const finalMcVersion = mcVersion || indexMeta.dependencies?.minecraft || '1.20.1';
  let finalLoader = loader || 'fabric';
  let finalLoaderVersion = '';
  if (indexMeta.dependencies?.['fabric-loader']) {
    finalLoader = 'fabric';
    finalLoaderVersion = indexMeta.dependencies['fabric-loader'];
  } else if (indexMeta.dependencies?.forge) {
    finalLoader = 'forge';
    finalLoaderVersion = indexMeta.dependencies.forge;
  } else if (indexMeta.dependencies?.neoforge) {
    finalLoader = 'neoforge';
    finalLoaderVersion = indexMeta.dependencies.neoforge;
  }

  const metaData = {
    id: `modrinth-${modpackId}`,
    source: 'modrinth',
    slug: modpackId,
    versionId,
    name: title,
    description: params.description || '',
    iconUrl,
    mcVersion: finalMcVersion,
    loader: finalLoader,
    loaderVersion: finalLoaderVersion,
    mrpackFile: mrpackFilename,
    modsCount: (indexMeta.files || []).length,
    downloadedAt: new Date().toISOString()
  };

  const jsonPath = path.join(modpacksDir, `modrinth-${modpackId}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(metaData, null, 2), 'utf8');

  return metaData;
}

export function listLocalModpacks() {
  const modpacksDir = getModpacksDir();
  if (!fs.existsSync(modpacksDir)) return [];
  const files = fs.readdirSync(modpacksDir);
  const list = [];
  for (const f of files) {
    if (f.endsWith('.json')) {
      try {
        const full = path.join(modpacksDir, f);
        const data = JSON.parse(fs.readFileSync(full, 'utf8'));
        list.push(data);
      } catch (e) {}
    }
  }
  return list.sort((a, b) => new Date(b.downloadedAt || 0).getTime() - new Date(a.downloadedAt || 0).getTime());
}

export function createLocalModpack(data) {
  const modpacksDir = getModpacksDir();
  const id = `custom-${Date.now()}`;
  const meta = {
    id,
    source: 'custom',
    name: data.name || 'Мой модпак',
    description: data.description || '',
    mcVersion: data.mcVersion || '1.20.1',
    loader: data.loader || 'fabric',
    loaderVersion: data.loaderVersion || '',
    mods: data.mods || [],
    modsCount: (data.mods || []).length,
    downloadedAt: new Date().toISOString()
  };
  const jsonPath = path.join(modpacksDir, `${id}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(meta, null, 2), 'utf8');
  return meta;
}

export function deleteLocalModpack(id) {
  const modpacksDir = getModpacksDir();
  const jsonPath = path.join(modpacksDir, `${id}.json`);
  if (fs.existsSync(jsonPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      if (data.mrpackFile) {
        const mrpack = path.join(modpacksDir, data.mrpackFile);
        if (fs.existsSync(mrpack)) fs.unlinkSync(mrpack);
      }
    } catch (e) {}
    fs.unlinkSync(jsonPath);
    return true;
  }
  return false;
}

export async function applyModpackToServer(serverPath, modpackId, onProgress) {
  const modpacksDir = getModpacksDir();
  const jsonPath = path.join(modpacksDir, `${modpackId}.json`);
  if (!fs.existsSync(jsonPath)) {
    throw new Error('Modpack metadata not found');
  }

  const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const modsDir = path.join(serverPath, 'mods');
  if (!fs.existsSync(modsDir)) {
    fs.mkdirSync(modsDir, { recursive: true });
  }

  if (meta.source === 'modrinth' && meta.mrpackFile) {
    const mrpackPath = path.join(modpacksDir, meta.mrpackFile);
    if (!fs.existsSync(mrpackPath)) {
      throw new Error('Mrpack archive file missing');
    }
    const zip = new AdmZip(mrpackPath);
    const indexEntry = zip.getEntry('modrinth.index.json');
    if (!indexEntry) {
      throw new Error('Invalid mrpack format: missing modrinth.index.json');
    }
    const indexData = JSON.parse(indexEntry.getData().toString('utf8'));

    const zipEntries = zip.getEntries();
    for (const entry of zipEntries) {
      if (entry.entryName.startsWith('overrides/')) {
        const rel = entry.entryName.replace(/^overrides\//, '');
        if (!rel) continue;
        const targetPath = path.join(serverPath, rel);
        if (entry.isDirectory) {
          if (!fs.existsSync(targetPath)) fs.mkdirSync(targetPath, { recursive: true });
        } else {
          const parent = path.dirname(targetPath);
          if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });
          fs.writeFileSync(targetPath, entry.getData());
        }
      }
    }

    const files = indexData.files || [];
    let installed = 0;
    for (const f of files) {
      if (!f.downloads || f.downloads.length === 0) continue;
      const targetRel = f.path;
      const targetAbs = path.join(serverPath, targetRel);
      const parentDir = path.dirname(targetAbs);
      if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });

      try {
        const dlUrl = f.downloads[0];
        const res = await axios.get(dlUrl, { responseType: 'arraybuffer', timeout: 15000 });
        fs.writeFileSync(targetAbs, Buffer.from(res.data));
      } catch (err) {}

      installed++;
      if (onProgress) {
        onProgress(Math.round((installed * 100) / files.length));
      }
    }

    return { success: true, installedCount: installed };
  } else if (meta.mods && Array.isArray(meta.mods)) {
    for (const mod of meta.mods) {
      if (mod.fileUrl) {
        try {
          const res = await axios.get(mod.fileUrl, { responseType: 'arraybuffer', timeout: 15000 });
          const target = path.join(modsDir, mod.filename || `${mod.name}.jar`);
          fs.writeFileSync(target, Buffer.from(res.data));
        } catch (e) {}
      }
    }
    return { success: true, installedCount: meta.mods.length };
  }

  return { success: true, installedCount: 0 };
}
