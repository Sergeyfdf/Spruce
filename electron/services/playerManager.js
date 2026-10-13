import fs from 'fs';
import path from 'path';
import nbt from 'prismarine-nbt';
import { promisify } from 'util';

const parseNbtAsync = promisify(nbt.parse);

export function getUserCache(serverPath) {
  const cachePath = path.join(serverPath, 'usercache.json');
  if (!fs.existsSync(cachePath)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(cachePath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function findDatFile(serverPath, uuid) {
  const cleanUuid = uuid.replace(/-/g, '').toLowerCase();
  const rawUuid = uuid.toLowerCase();

  let levelName = 'world';
  const propsPath = path.join(serverPath, 'server.properties');
  if (fs.existsSync(propsPath)) {
    try {
      const content = fs.readFileSync(propsPath, 'utf8');
      const match = content.match(/^level-name\s*=\s*(.+)$/m);
      if (match && match[1].trim()) {
        levelName = match[1].trim();
      }
    } catch (e) {}
  }

  const candidateDirs = [
    path.join(serverPath, levelName, 'players', 'data'),
    path.join(serverPath, levelName, 'playerdata'),
    path.join(serverPath, levelName, 'players'),
    path.join(serverPath, 'world', 'players', 'data'),
    path.join(serverPath, 'world', 'playerdata'),
    path.join(serverPath, 'world', 'players')
  ];

  for (const dir of candidateDirs) {
    if (fs.existsSync(dir)) {
      const file1 = path.join(dir, `${uuid}.dat`);
      if (fs.existsSync(file1)) return file1;
      const file2 = path.join(dir, `${cleanUuid}.dat`);
      if (fs.existsSync(file2)) return file2;

      try {
        const files = fs.readdirSync(dir);
        const match = files.find((f) => {
          const fl = f.toLowerCase();
          return fl.endsWith('.dat') && (fl.startsWith(rawUuid) || fl.startsWith(cleanUuid) || fl.includes(cleanUuid));
        });
        if (match) return path.join(dir, match);
      } catch (e) {}
    }
  }

  try {
    const searchRoot = path.join(serverPath, levelName);
    const targetDir = fs.existsSync(searchRoot) ? searchRoot : serverPath;
    const stack = [targetDir];
    let depthCount = 0;
    while (stack.length > 0 && depthCount < 50) {
      depthCount++;
      const current = stack.pop();
      if (!fs.existsSync(current)) continue;
      const entries = fs.readdirSync(current, { withFileTypes: true });
      for (const ent of entries) {
        if (ent.isFile() && ent.name.toLowerCase().endsWith('.dat')) {
          const nameLower = ent.name.toLowerCase();
          if (nameLower.includes(cleanUuid) || nameLower.includes(rawUuid)) {
            return path.join(current, ent.name);
          }
        } else if (ent.isDirectory() && !['logs', 'libraries', 'bluemap', 'mods', 'config'].includes(ent.name)) {
          stack.push(path.join(current, ent.name));
        }
      }
    }
  } catch (e) {}

  return null;
}

export async function getPlayerData(serverPath, uuid) {
  const datPath = findDatFile(serverPath, uuid);
  if (!datPath) {
    return null;
  }

  try {
    const buffer = fs.readFileSync(datPath);
    const parsed = await parseNbtAsync(buffer);
    const data = nbt.simplify(parsed);

    const pos = data.Pos ? [
      Math.round(data.Pos[0] * 10) / 10,
      Math.round(data.Pos[1] * 10) / 10,
      Math.round(data.Pos[2] * 10) / 10
    ] : [0, 64, 0];

    const dimension = data.Dimension ? String(data.Dimension).replace('minecraft:', '') : 'overworld';

    const spawnPoint = (data.SpawnX !== undefined && data.SpawnY !== undefined && data.SpawnZ !== undefined) ? {
      x: data.SpawnX,
      y: data.SpawnY,
      z: data.SpawnZ,
      dimension: data.SpawnDimension ? String(data.SpawnDimension).replace('minecraft:', '') : 'overworld'
    } : null;

    let lastDeath = null;
    if (data.LastDeathLocation && data.LastDeathLocation.pos) {
      lastDeath = {
        x: data.LastDeathLocation.pos[0],
        y: data.LastDeathLocation.pos[1],
        z: data.LastDeathLocation.pos[2],
        dimension: data.LastDeathLocation.dimension ? String(data.LastDeathLocation.dimension).replace('minecraft:', '') : 'overworld'
      };
    }

    const inventory = (data.Inventory || []).map((item) => ({
      slot: item.Slot,
      id: item.id ? String(item.id).replace('minecraft:', '') : 'air',
      count: item.count || item.Count || 1,
      tag: item.tag || null
    }));

    return {
      pos,
      dimension,
      health: Math.round(data.Health || 20),
      food: data.foodLevel !== undefined ? data.foodLevel : 20,
      xp: data.XpLevel || 0,
      spawnPoint,
      lastDeath,
      inventory
    };
  } catch (err) {
    return null;
  }
}

export async function getAllPlayers(serverPath, onlineNames = []) {
  const cache = getUserCache(serverPath);
  const result = [];

  for (const entry of cache) {
    const isOnline = onlineNames.includes(entry.name);
    const pdata = await getPlayerData(serverPath, entry.uuid);

    result.push({
      name: entry.name,
      uuid: entry.uuid,
      online: isOnline,
      headUrl: `https://mc-heads.net/avatar/${entry.name}/64`,
      avatarUrl: `https://mc-heads.net/body/${entry.name}/128`,
      coords: pdata ? pdata.pos : [0, 64, 0],
      dimension: pdata ? pdata.dimension : 'overworld',
      health: pdata ? pdata.health : 20,
      food: pdata ? pdata.food : 20,
      xp: pdata ? pdata.xp : 0,
      spawnPoint: pdata ? pdata.spawnPoint : null,
      lastDeath: pdata ? pdata.lastDeath : null,
      inventory: pdata ? pdata.inventory : []
    });
  }

  for (const onlineName of onlineNames) {
    if (!result.find((p) => p.name.toLowerCase() === onlineName.toLowerCase())) {
      result.push({
        name: onlineName,
        uuid: onlineName,
        online: true,
        headUrl: `https://mc-heads.net/avatar/${onlineName}/64`,
        avatarUrl: `https://mc-heads.net/body/${onlineName}/128`,
        coords: [0, 64, 0],
        dimension: 'overworld',
        health: 20,
        food: 20,
        xp: 0,
        spawnPoint: null,
        lastDeath: null,
        inventory: []
      });
    }
  }

  return result;
}
