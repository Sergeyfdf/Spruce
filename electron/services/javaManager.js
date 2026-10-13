import fs from 'fs';
import path from 'path';
import axios from 'axios';
import AdmZip from 'adm-zip';
import { execSync } from 'child_process';
export { getRecommendedJava } from './versionService.js';
import { getRuntimesDir, migrateLegacyData } from './pathManager.js';

export function ensureRuntimesDir() {
  migrateLegacyData();
  const runtimesDir = getRuntimesDir();
  if (!fs.existsSync(runtimesDir)) {
    fs.mkdirSync(runtimesDir, { recursive: true });
  }
}

export function getSystemJavaVersion() {
  try {
    const output = execSync('java -version 2>&1', { encoding: 'utf8' });
    const match = output.match(/version "([^"]+)"/);
    if (match) {
      const verStr = match[1];
      if (verStr.startsWith('1.8')) return 8;
      const major = parseInt(verStr.split('.')[0], 10);
      return isNaN(major) ? null : major;
    }
  } catch (e) {
    return null;
  }
  return null;
}

export function getInstalledManagedJava(version) {
  ensureRuntimesDir();
  const javaDir = path.join(getRuntimesDir(), `java-${version}`);
  if (!fs.existsSync(javaDir)) {
    return null;
  }

  const directBin = path.join(javaDir, 'bin', 'java.exe');
  if (fs.existsSync(directBin)) {
    return directBin;
  }

  const entries = fs.readdirSync(javaDir);
  for (const entry of entries) {
    const subBin = path.join(javaDir, entry, 'bin', 'java.exe');
    if (fs.existsSync(subBin)) {
      return subBin;
    }
  }

  return null;
}

export async function downloadAdoptiumJava(version, onProgress) {
  ensureRuntimesDir();
  const targetDir = path.join(getRuntimesDir(), `java-${version}`);
  const zipPath = path.join(getRuntimesDir(), `java-${version}.zip`);

  const apiUrl = `https://api.adoptium.net/v3/binary/latest/${version}/ga/windows/x64/jdk/hotspot/normal/eclipse`;

  const response = await axios({
    method: 'GET',
    url: apiUrl,
    responseType: 'arraybuffer',
    maxRedirects: 5,
    onDownloadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percent);
      }
    }
  });

  fs.writeFileSync(zipPath, Buffer.from(response.data));

  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
  fs.mkdirSync(targetDir, { recursive: true });

  const zip = new AdmZip(zipPath);
  zip.extractAllTo(targetDir, true);

  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }

  return getInstalledManagedJava(version);
}

export async function resolveJavaPath(requiredVersion, onProgress) {
  const managed = getInstalledManagedJava(requiredVersion);
  if (managed) {
    return managed;
  }

  const systemVer = getSystemJavaVersion();
  if (systemVer === requiredVersion) {
    return 'java';
  }

  return await downloadAdoptiumJava(requiredVersion, onProgress);
}
