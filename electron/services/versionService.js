import axios from 'axios';

export async function getMinecraftVersions() {
  try {
    const res = await axios.get('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json', { timeout: 8000 });
    const releases = res.data.versions
      .filter((v) => v.type === 'release')
      .map((v) => ({
        id: v.id,
        url: v.url,
        releaseTime: v.releaseTime
      }));
    return releases;
  } catch (err) {
    return [
      { id: '1.21.4', releaseTime: '2024-12-03' },
      { id: '1.21.3', releaseTime: '2024-10-22' },
      { id: '1.21.1', releaseTime: '2024-08-08' },
      { id: '1.21', releaseTime: '2024-06-13' },
      { id: '1.20.6', releaseTime: '2024-04-29' },
      { id: '1.20.4', releaseTime: '2023-12-07' },
      { id: '1.20.2', releaseTime: '2023-09-21' },
      { id: '1.20.1', releaseTime: '2023-06-12' },
      { id: '1.19.4', releaseTime: '2023-03-14' },
      { id: '1.19.2', releaseTime: '2022-08-05' },
      { id: '1.18.2', releaseTime: '2022-02-28' },
      { id: '1.17.1', releaseTime: '2021-07-06' },
      { id: '1.16.5', releaseTime: '2021-01-15' },
      { id: '1.16.4', releaseTime: '2020-11-02' },
      { id: '1.15.2', releaseTime: '2020-01-21' },
      { id: '1.14.4', releaseTime: '2019-07-19' },
      { id: '1.12.2', releaseTime: '2017-09-18' },
      { id: '1.8.9', releaseTime: '2015-12-09' },
      { id: '1.7.10', releaseTime: '2014-06-26' }
    ];
  }
}

export async function getFabricLoaders(gameVersion) {
  try {
    const res = await axios.get(`https://meta.fabricmc.net/v2/versions/loader/${gameVersion}`, { timeout: 6000 });
    return res.data.map((l) => l.loader.version);
  } catch (err) {
    return ['0.16.10', '0.16.9', '0.15.11'];
  }
}

export async function getForgeVersion(mcVersion) {
  try {
    const res = await axios.get('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json', { timeout: 6000 });
    const promos = res.data.promos || {};
    return promos[`${mcVersion}-recommended`] || promos[`${mcVersion}-latest`] || null;
  } catch (e) {
    const fallbacks = {
      '1.20.4': '49.1.0',
      '1.20.2': '48.1.0',
      '1.20.1': '47.4.10',
      '1.19.4': '45.3.0',
      '1.19.2': '43.4.0',
      '1.18.2': '40.2.21',
      '1.16.5': '36.2.34',
      '1.12.2': '14.23.5.2859',
      '1.7.10': '10.13.4.1614'
    };
    return fallbacks[mcVersion] || null;
  }
}

export async function getNeoForgeVersion(mcVersion) {
  const parts = mcVersion.split('.').map(Number);
  const minor = parts[1] || 0;
  const patch = parts[2] || 0;

  if (minor < 20 || (minor === 20 && patch < 2)) {
    return null;
  }

  const prefix = minor === 20 ? `20.${patch}.` : `21.${patch}.`;

  try {
    const res = await axios.get('https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge', { timeout: 6000 });
    const matching = (res.data.versions || []).filter((v) => v.startsWith(prefix) && !v.includes('beta') && !v.includes('alpha'));
    if (matching.length > 0) {
      return matching[matching.length - 1];
    }
    const anyMatching = (res.data.versions || []).filter((v) => v.startsWith(prefix));
    return anyMatching.length > 0 ? anyMatching[anyMatching.length - 1] : null;
  } catch (e) {
    const fallbacks = {
      '1.21.4': '21.4.158',
      '1.21.3': '21.3.56',
      '1.21.1': '21.1.257',
      '1.21': '21.0.167',
      '1.20.6': '20.6.119',
      '1.20.4': '20.4.251',
      '1.20.2': '20.2.88'
    };
    return fallbacks[mcVersion] || null;
  }
}

export function getRecommendedJava(gameVersion) {
  if (!gameVersion) return 21;
  const str = String(gameVersion).trim();
  const parts = str.split('.').map(Number);
  const major = parts[0] || 0;
  const minor = parts.length > 1 ? (parts[1] || 0) : 0;
  const patch = parts.length > 2 ? (parts[2] || 0) : 0;

  if (major >= 25 || str.startsWith('25') || str.startsWith('26') || str.startsWith('27')) {
    return 25;
  }
  if (major >= 21) {
    return 21;
  }
  if (major === 1) {
    if (minor >= 25) {
      return 25;
    }
    if (minor > 20 || (minor === 20 && patch >= 5)) {
      return 21;
    }
    if (minor >= 18) {
      return 17;
    }
    if (minor === 17) {
      return 16;
    }
    return 8;
  }
  return 21;
}
