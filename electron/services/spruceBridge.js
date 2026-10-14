import http from 'http';
import fs from 'fs';
import path from 'path';
import { listServers } from './serverManager.js';

let bridgeServer = null;

export function startSpruceHttpBridge() {
  if (bridgeServer) return;

  bridgeServer = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const host = req.headers.host || '127.0.0.1:29170';
    const parsedUrl = new URL(req.url, `http://${host}`);

    if (parsedUrl.pathname === '/api/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, app: 'Spruce' }));
      return;
    }

    if (parsedUrl.pathname === '/api/servers') {
      try {
        const servers = await listServers();
        const formatted = servers.map((s) => {
          let modsCount = 0;
          try {
            const modsDir = path.join(s.path, 'mods');
            if (fs.existsSync(modsDir)) {
              modsCount = fs.readdirSync(modsDir).filter((f) => f.endsWith('.jar') && !f.endsWith('.disabled')).length;
            }
          } catch (e) {}
          let resolvedLoaderVer = s.loaderVersion || '';
          if (!resolvedLoaderVer) {
            try {
              if (s.loader === 'forge') {
                const forgeLibDir = path.join(s.path, 'libraries', 'net', 'minecraftforge', 'forge');
                if (fs.existsSync(forgeLibDir)) {
                  const dirs = fs.readdirSync(forgeLibDir);
                  if (dirs.length > 0) {
                    resolvedLoaderVer = dirs[0].replace(`${s.mcVersion}-`, '');
                  }
                }
              } else if (s.loader === 'neoforge') {
                const neoLibDir = path.join(s.path, 'libraries', 'net', 'neoforged', 'neoforge');
                if (fs.existsSync(neoLibDir)) {
                  const dirs = fs.readdirSync(neoLibDir);
                  if (dirs.length > 0) {
                    resolvedLoaderVer = dirs[0];
                  }
                }
              }
            } catch (e) {}
          }
          return {
            id: s.id,
            name: s.name,
            mcVersion: s.mcVersion,
            loader: s.loader,
            loaderVersion: resolvedLoaderVer,
            port: s.port || 25565,
            ramMax: s.ramMax || 4096,
            path: s.path,
            modsCount
          };
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(formatted));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    if (parsedUrl.pathname === '/api/export-to-instance' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          const servers = await listServers();
          const targetServer = servers.find((s) => s.id === data.serverId || s.name === data.serverName);
          if (!targetServer) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Сервер не найден' }));
            return;
          }

          let copied = 0;
          if (data.instancePath) {
            const srcMods = path.join(targetServer.path, 'mods');
            const dstMods = path.join(data.instancePath, 'mods');
            if (fs.existsSync(srcMods)) {
              if (!fs.existsSync(dstMods)) {
                fs.mkdirSync(dstMods, { recursive: true });
              }
              const files = fs.readdirSync(srcMods);
              for (const f of files) {
                if (f.endsWith('.jar') && !f.endsWith('.disabled')) {
                  if (f.toLowerCase().includes('bluemap')) {
                    continue;
                  }
                  fs.copyFileSync(path.join(srcMods, f), path.join(dstMods, f));
                  copied++;
                }
              }
            }
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, modsCopied: copied }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  bridgeServer.listen(29170, '127.0.0.1', () => {});
  bridgeServer.on('error', () => {});
}

export function stopSpruceHttpBridge() {
  if (bridgeServer) {
    try {
      bridgeServer.close();
    } catch (e) {}
    bridgeServer = null;
  }
}
