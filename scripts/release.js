import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function getGitHubToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    const stdout = execSync('git credential fill', {
      input: 'protocol=https\nhost=github.com\n\n',
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    });
    const match = stdout.match(/password=([^\r\n]+)/);
    if (match) return match[1].trim();
  } catch (e) {
  }
  return null;
}

function bumpVersion(currentVer, mode = 'patch') {
  const parts = currentVer.split('.').map((p) => parseInt(p, 10) || 0);
  let [major = 1, minor = 0, patch = 0] = parts;

  if (mode === 'major') {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (mode === 'minor') {
    minor += 1;
    patch = 0;
  } else {
    patch += 1;
  }

  return `${major}.${minor}.${patch}`;
}

async function run() {
  const token = getGitHubToken();
  if (!token) {
    throw new Error('GitHub token not found. Please log in with Git or set GITHUB_TOKEN environment variable.');
  }

  const pkgPath = path.join(rootDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  const arg = process.argv[2];
  let newVersion = '';

  if (arg && /^\d+\.\d+\.\d+$/.test(arg)) {
    newVersion = arg;
  } else {
    newVersion = bumpVersion(pkg.version, arg || 'patch');
  }

  console.log(`Bumping version: ${pkg.version} -> ${newVersion}`);
  pkg.version = newVersion;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  const lockPath = path.join(rootDir, 'package-lock.json');
  if (fs.existsSync(lockPath)) {
    try {
      const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
      lock.version = newVersion;
      if (lock.packages && lock.packages['']) {
        lock.packages[''].version = newVersion;
      }
      fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
    } catch (e) {
    }
  }

  console.log('Building application and packaging Windows installer...');
  execSync('npm run dist', { cwd: rootDir, stdio: 'inherit' });

  const releaseDir = path.join(rootDir, 'release');
  if (!fs.existsSync(releaseDir)) {
    throw new Error('Release directory not found after build');
  }

  const files = fs.readdirSync(releaseDir);
  const exeName = files.find((f) => f.endsWith('.exe') && f.includes(newVersion) && !f.includes('__uninstaller') && !f.startsWith('win-'))
    || files.find((f) => f.endsWith('.exe') && !f.includes('__uninstaller') && !f.startsWith('win-'));
  if (!exeName) {
    throw new Error('Installer .exe not found in release directory');
  }

  const exePath = path.join(releaseDir, exeName);
  console.log(`Installer found: ${exeName} (${Math.round(fs.statSync(exePath).size / 1024 / 1024)} MB)`);

  console.log('Committing version bump and pushing tag...');
  execSync(`git add package.json package-lock.json`, { cwd: rootDir, stdio: 'inherit' });
  execSync(`git commit -m "Release v${newVersion}"`, { cwd: rootDir, stdio: 'inherit' });
  execSync(`git tag -f v${newVersion}`, { cwd: rootDir, stdio: 'inherit' });
  execSync(`git push origin main --tags`, { cwd: rootDir, stdio: 'inherit' });

  const repo = 'Sergeyfdf/Spruce';
  console.log(`Creating GitHub release on ${repo} for tag v${newVersion}...`);

  let releaseData = null;
  const relUrl = `https://api.github.com/repos/${repo}/releases`;

  try {
    const existingRes = await axios.get(`${relUrl}/tags/v${newVersion}`, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Spruce-Release-Script'
      }
    });
    releaseData = existingRes.data;
    console.log(`Found existing release: ID ${releaseData.id}`);
  } catch (e) {
  }

  if (!releaseData) {
    const createRes = await axios.post(
      relUrl,
      {
        tag_name: `v${newVersion}`,
        name: `Spruce v${newVersion}`,
        body: `Release Spruce v${newVersion}\n\nAutomated build installer.`,
        draft: false,
        prerelease: false
      },
      {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'Spruce-Release-Script'
        }
      }
    );
    releaseData = createRes.data;
    console.log(`Release created: ID ${releaseData.id}`);
  }

  const existingAssets = releaseData.assets || [];
  const existingExeAsset = existingAssets.find((a) => a.name === exeName);
  if (existingExeAsset) {
    console.log(`Deleting previous asset ${exeName} (ID ${existingExeAsset.id})...`);
    await axios.delete(`https://api.github.com/repos/${repo}/releases/assets/${existingExeAsset.id}`, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Spruce-Release-Script'
      }
    });
  }

  console.log(`Uploading ${exeName} to GitHub Releases...`);
  const exeStats = fs.statSync(exePath);
  const exeStream = fs.createReadStream(exePath);

  const uploadUrl = `https://uploads.github.com/repos/${repo}/releases/${releaseData.id}/assets?name=${encodeURIComponent(exeName)}`;
  let lastLoggedPercent = -1;

  await axios({
    method: 'POST',
    url: uploadUrl,
    data: exeStream,
    headers: {
      Authorization: `token ${token}`,
      'Content-Type': 'application/octet-stream',
      'Content-Length': exeStats.size,
      'User-Agent': 'Spruce-Release-Script'
    },
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    onUploadProgress: (progressEvent) => {
      if (progressEvent.total) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        if (percent !== lastLoggedPercent && percent % 10 === 0) {
          lastLoggedPercent = percent;
          console.log(`Upload progress: ${percent}%`);
        }
      }
    }
  });

  const blockmapName = `${exeName}.blockmap`;
  const blockmapPath = path.join(releaseDir, blockmapName);
  if (fs.existsSync(blockmapPath)) {
    const existingBm = existingAssets.find((a) => a.name === blockmapName);
    if (existingBm) {
      await axios.delete(`https://api.github.com/repos/${repo}/releases/assets/${existingBm.id}`, {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'Spruce-Release-Script'
        }
      });
    }

    const bmStats = fs.statSync(blockmapPath);
    await axios({
      method: 'POST',
      url: `https://uploads.github.com/repos/${repo}/releases/${releaseData.id}/assets?name=${encodeURIComponent(blockmapName)}`,
      data: fs.createReadStream(blockmapPath),
      headers: {
        Authorization: `token ${token}`,
        'Content-Type': 'application/octet-stream',
        'Content-Length': bmStats.size,
        'User-Agent': 'Spruce-Release-Script'
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
  }

  console.log(`Release v${newVersion} successfully published!`);
  console.log(`URL: https://github.com/${repo}/releases/tag/v${newVersion}`);
}

run().catch((err) => {
  console.error('Release failed:', err.response?.data || err.message || err);
  process.exit(1);
});
