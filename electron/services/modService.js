import fs from 'fs';
import path from 'path';
import axios from 'axios';

export async function searchModrinth({ query = '', loader = '', mcVersion = '', limit = 24, offset = 0 }) {
  const buildFacets = (useLoader, useVer) => {
    const f = [['project_type:mod']];
    if (useLoader && loader && loader !== 'vanilla') {
      f.push([`categories:${loader.toLowerCase()}`]);
    }
    if (useVer && mcVersion) {
      f.push([`versions:${mcVersion}`]);
    }
    return f;
  };

  const doSearch = async (facets, isPopular = false) => {
    const params = {
      limit,
      offset,
      facets: JSON.stringify(facets)
    };
    if (query && query.trim()) {
      params.query = query.trim();
    }
    if (isPopular || !query || !query.trim()) {
      params.index = 'downloads';
    }

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
      loaders: hit.loaders || [],
      author: hit.author,
      source: 'modrinth'
    }));
  };

  try {
    if (!query || !query.trim()) {
      let results = await doSearch(buildFacets(true, false), true);
      if (!results.length) {
        results = await doSearch(buildFacets(false, false), true);
      }
      return results;
    }

    let results = await doSearch(buildFacets(true, true), false);
    if (!results.length && (loader || mcVersion)) {
      results = await doSearch(buildFacets(true, false), false);
    }
    if (!results.length) {
      results = await doSearch(buildFacets(false, false), false);
    }
    return results;
  } catch (err) {
    return [];
  }
}

export async function getModrinthProject(projectIdOrSlug) {
  const res = await axios.get(`https://api.modrinth.com/v2/project/${projectIdOrSlug}`, {
    headers: { 'User-Agent': 'Spruce-Minecraft-Orchestrator/1.0' },
    timeout: 10000
  });
  const data = res.data;
  return {
    id: data.id,
    slug: data.slug,
    title: data.title,
    description: data.description,
    body: data.body,
    iconUrl: data.icon_url,
    downloads: data.downloads,
    followers: data.followers,
    categories: data.categories || [],
    loaders: data.loaders || [],
    gameVersions: data.game_versions || [],
    gallery: (data.gallery || []).map((g) => ({
      url: g.url || g.raw_url,
      title: g.title || '',
      description: g.description || ''
    }))
  };
}

export async function getModrinthVersions(params) {
  const projectIdOrSlug = typeof params === 'string' ? params : (params?.projectIdOrSlug || params?.idOrSlug || params?.id);
  const loader = typeof params === 'object' ? params?.loader : '';
  const mcVersion = typeof params === 'object' ? params?.mcVersion : '';

  const headers = { 'User-Agent': 'Spruce-Minecraft-Orchestrator/1.0' };
  let compatibleList = [];

  if (loader && loader !== 'vanilla' && mcVersion) {
    try {
      const compatRes = await axios.get(`https://api.modrinth.com/v2/project/${projectIdOrSlug}/version`, {
        params: {
          loaders: JSON.stringify([loader.toLowerCase()]),
          game_versions: JSON.stringify([mcVersion])
        },
        headers,
        timeout: 10000
      });
      compatibleList = compatRes.data || [];
    } catch (e) {}
  }

  let generalList = [];
  try {
    const generalRes = await axios.get(`https://api.modrinth.com/v2/project/${projectIdOrSlug}/version`, {
      headers,
      timeout: 10000
    });
    generalList = generalRes.data || [];
  } catch (e) {}

  const seenIds = new Set();
  const merged = [];

  for (const v of compatibleList) {
    if (!seenIds.has(v.id)) {
      seenIds.add(v.id);
      merged.push(v);
    }
  }

  for (const v of generalList) {
    if (!seenIds.has(v.id)) {
      seenIds.add(v.id);
      merged.push(v);
    }
  }

  return merged.slice(0, 150).map((v) => ({
    id: v.id,
    name: v.name,
    versionNumber: v.version_number,
    gameVersions: v.game_versions || [],
    loaders: v.loaders || [],
    datePublished: v.date_published,
    files: (v.files || []).map((f) => ({
      filename: f.filename,
      size: f.size,
      url: f.url,
      primary: f.primary
    }))
  }));
}

export async function installModFile({ serverPath, fileUrl, filename }) {
  if (!serverPath || !fileUrl || !filename) {
    throw new Error('Параметры serverPath, fileUrl и filename обязательны');
  }
  const modsDir = path.join(serverPath, 'mods');
  if (!fs.existsSync(modsDir)) {
    fs.mkdirSync(modsDir, { recursive: true });
  }
  const targetPath = path.join(modsDir, filename);
  const fileRes = await axios({
    method: 'GET',
    url: fileUrl,
    responseType: 'arraybuffer',
    timeout: 60000
  });
  fs.writeFileSync(targetPath, Buffer.from(fileRes.data));
  return {
    filename,
    size: fileRes.data.length,
    success: true
  };
}

export async function installModrinthMod({ projectId, serverPath, mcVersion, loader }) {
  const versionsUrl = `https://api.modrinth.com/v2/project/${projectId}/version`;
  const res = await axios.get(versionsUrl, {
    headers: { 'User-Agent': 'Spruce-Minecraft-Orchestrator/1.0' }
  });

  let validVersion = res.data.find((v) => {
    const hasGameVer = !mcVersion || (v.game_versions && v.game_versions.includes(mcVersion));
    const hasLoader = !loader || loader === 'vanilla' || (v.loaders && v.loaders.map((l) => l.toLowerCase()).includes(loader.toLowerCase()));
    return hasGameVer && hasLoader;
  });

  if (!validVersion || !validVersion.files || validVersion.files.length === 0) {
    throw new Error(`Нет совместимой версии для ${loader} ${mcVersion}. Открой вкладку «Версии», чтобы выбрать подходящий файл вручную.`);
  }

  const primaryFile = validVersion.files.find((f) => f.primary) || validVersion.files[0];
  const modsDir = path.join(serverPath, 'mods');
  if (!fs.existsSync(modsDir)) {
    fs.mkdirSync(modsDir, { recursive: true });
  }

  const targetPath = path.join(modsDir, primaryFile.filename);
  const fileRes = await axios({
    method: 'GET',
    url: primaryFile.url,
    responseType: 'arraybuffer'
  });

  fs.writeFileSync(targetPath, Buffer.from(fileRes.data));
  return {
    filename: primaryFile.filename,
    size: primaryFile.size,
    success: true
  };
}

export async function searchCurseForge({ query = '', loader = '', mcVersion = '', apiKey = '', pageSize = 24, index = 0 }) {
  const effectiveKey = apiKey || process.env.CURSEFORGE_API_KEY || '';
  if (!effectiveKey) {
    return [];
  }

  const loaderMap = {
    forge: 1,
    fabric: 4,
    quilt: 5,
    neoforge: 6
  };

  const doSearch = async (useLoader, useVer) => {
    const params = {
      gameId: 432,
      classId: 6,
      pageSize,
      index,
      sortField: 2,
      sortOrder: 'desc'
    };
    if (query && query.trim()) {
      params.searchFilter = query.trim();
    }
    if (useVer && mcVersion) params.gameVersion = mcVersion;
    if (useLoader && loader && loaderMap[loader.toLowerCase()]) {
      params.modLoaderType = loaderMap[loader.toLowerCase()];
    }

    const res = await axios.get('https://api.curseforge.com/v1/mods/search', {
      params,
      headers: {
        'x-api-key': effectiveKey,
        'Accept': 'application/json'
      },
      timeout: 10000
    });
    return (res.data.data || []).map((mod) => ({
      id: mod.id.toString(),
      slug: mod.slug,
      title: mod.name,
      description: mod.summary,
      iconUrl: mod.logo ? mod.logo.url : null,
      downloads: mod.downloadCount,
      author: (mod.authors && mod.authors[0]) ? mod.authors[0].name : '',
      categories: (mod.categories || []).map((c) => c.name),
      source: 'curseforge'
    }));
  };

  try {
    let results = await doSearch(true, true);
    if (!results.length && (loader || mcVersion)) {
      results = await doSearch(true, false);
    }
    if (!results.length) {
      results = await doSearch(false, false);
    }
    return results;
  } catch (e) {
    return [];
  }
}

export async function getCurseForgeProject({ modId, apiKey }) {
  const effectiveKey = apiKey || process.env.CURSEFORGE_API_KEY || '';
  if (!effectiveKey) {
    throw new Error('CurseForge API Key required');
  }
  const res = await axios.get(`https://api.curseforge.com/v1/mods/${modId}`, {
    headers: { 'x-api-key': effectiveKey, 'Accept': 'application/json' },
    timeout: 10000
  });
  const mod = res.data.data;
  return {
    id: mod.id.toString(),
    slug: mod.slug,
    title: mod.name,
    description: mod.summary,
    body: mod.summary,
    iconUrl: mod.logo ? mod.logo.url : null,
    downloads: mod.downloadCount,
    author: (mod.authors && mod.authors[0]) ? mod.authors[0].name : '',
    categories: (mod.categories || []).map((c) => c.name),
    gallery: (mod.screenshots || []).map((s) => ({
      url: s.url,
      title: s.title || '',
      description: s.description || ''
    }))
  };
}

export async function getCurseForgeVersions(params) {
  const modId = params?.modId || params?.id;
  const apiKey = params?.apiKey;
  const loader = params?.loader;
  const mcVersion = params?.mcVersion;

  const effectiveKey = apiKey || process.env.CURSEFORGE_API_KEY || '';
  if (!effectiveKey) {
    throw new Error('CurseForge API Key required');
  }

  const loaderMap = {
    forge: 1,
    fabric: 4,
    quilt: 5,
    neoforge: 6
  };

  let compatibleList = [];
  if (mcVersion) {
    try {
      const qParams = { gameVersion: mcVersion };
      if (loader && loaderMap[loader.toLowerCase()]) {
        qParams.modLoaderType = loaderMap[loader.toLowerCase()];
      }
      const compatRes = await axios.get(`https://api.curseforge.com/v1/mods/${modId}/files`, {
        params: qParams,
        headers: { 'x-api-key': effectiveKey, 'Accept': 'application/json' },
        timeout: 10000
      });
      compatibleList = compatRes.data.data || [];
    } catch (e) {}
  }

  let generalList = [];
  try {
    const res = await axios.get(`https://api.curseforge.com/v1/mods/${modId}/files`, {
      headers: { 'x-api-key': effectiveKey, 'Accept': 'application/json' },
      timeout: 10000
    });
    generalList = res.data.data || [];
  } catch (e) {}

  const seenIds = new Set();
  const merged = [];

  for (const f of compatibleList) {
    if (!seenIds.has(f.id)) {
      seenIds.add(f.id);
      merged.push(f);
    }
  }

  for (const f of generalList) {
    if (!seenIds.has(f.id)) {
      seenIds.add(f.id);
      merged.push(f);
    }
  }

  return merged.slice(0, 150).map((f) => ({
    id: f.id.toString(),
    name: f.displayName,
    versionNumber: f.fileName,
    gameVersions: f.gameVersions || [],
    loaders: (f.gameVersions || []).filter((v) => ['Forge', 'Fabric', 'Quilt', 'NeoForge'].includes(v)).map((l) => l.toLowerCase()),
    datePublished: f.fileDate,
    files: [{
      filename: f.fileName,
      size: f.fileLength,
      url: f.downloadUrl,
      primary: true
    }]
  }));
}

export async function installCurseForgeMod({ modId, serverPath, apiKey, mcVersion }) {
  if (!apiKey) {
    throw new Error('CurseForge API Key required');
  }

  const filesRes = await axios.get(`https://api.curseforge.com/v1/mods/${modId}/files`, {
    headers: { 'x-api-key': apiKey }
  });

  const files = filesRes.data.data || [];
  let file = files.find((f) => !mcVersion || (f.gameVersions && f.gameVersions.includes(mcVersion)));
  if (!file && files.length > 0) {
    file = files[0];
  }

  if (!file || !file.downloadUrl) {
    throw new Error('No download URL available for CurseForge file');
  }

  const modsDir = path.join(serverPath, 'mods');
  if (!fs.existsSync(modsDir)) {
    fs.mkdirSync(modsDir, { recursive: true });
  }

  const targetPath = path.join(modsDir, file.fileName);
  const fileRes = await axios({
    method: 'GET',
    url: file.downloadUrl,
    responseType: 'arraybuffer'
  });

  fs.writeFileSync(targetPath, Buffer.from(fileRes.data));
  return {
    filename: file.fileName,
    size: file.fileLength,
    success: true
  };
}

export function listInstalledMods(serverPath) {
  const modsDir = path.join(serverPath, 'mods');
  if (!fs.existsSync(modsDir)) {
    return [];
  }

  const files = fs.readdirSync(modsDir);
  return files
    .filter((f) => f.endsWith('.jar') || f.endsWith('.jar.disabled'))
    .map((filename) => {
      const fullPath = path.join(modsDir, filename);
      const stat = fs.statSync(fullPath);
      const enabled = !filename.endsWith('.disabled');
      const cleanName = filename.replace('.disabled', '').replace('.jar', '');
      return {
        filename,
        cleanName,
        enabled,
        size: stat.size,
        modified: stat.mtime
      };
    });
}

export function toggleModState(serverPath, filename) {
  const modsDir = path.join(serverPath, 'mods');
  const currentPath = path.join(modsDir, filename);
  if (!fs.existsSync(currentPath)) {
    throw new Error('Mod file not found');
  }

  let newName = '';
  if (filename.endsWith('.disabled')) {
    newName = filename.replace('.disabled', '');
  } else {
    newName = filename + '.disabled';
  }

  const newPath = path.join(modsDir, newName);
  fs.renameSync(currentPath, newPath);
  return { oldName: filename, newName, enabled: !newName.endsWith('.disabled') };
}

export function deleteModFile(serverPath, filename) {
  const modsDir = path.join(serverPath, 'mods');
  const target = path.join(modsDir, filename);
  if (fs.existsSync(target)) {
    fs.unlinkSync(target);
    return true;
  }
  return false;
}
