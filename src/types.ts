export interface Server {
  id: string;
  name: string;
  mcVersion: string;
  loader: 'vanilla' | 'fabric' | 'forge' | 'neoforge';
  loaderVersion?: string;
  modpackId?: string;
  ramMin: number;
  ramMax: number;
  port: number;
  javaVersion: number;
  jarName: string;
  path: string;
  status: 'online' | 'offline' | 'starting';
  onlinePlayersCount: number;
  onlinePlayers: string[];
  blueMapPort?: number;
  seed?: string;
  createdAt: string;
}

export interface PlayerInventoryItem {
  slot: number;
  id: string;
  count: number;
  tag?: any;
}

export interface Player {
  name: string;
  uuid: string;
  online: boolean;
  headUrl: string;
  avatarUrl: string;
  coords: [number, number, number];
  dimension: string;
  health: number;
  food: number;
  xp: number;
  spawnPoint: { x: number; y: number; z: number; dimension: string } | null;
  lastDeath: { x: number; y: number; z: number; dimension: string } | null;
  inventory: PlayerInventoryItem[];
}

export interface ModItem {
  id: string;
  slug: string;
  title: string;
  description: string;
  iconUrl: string | null;
  downloads: number;
  author: string;
  categories: string[];
  source: 'modrinth' | 'curseforge';
}

export interface InstalledMod {
  filename: string;
  cleanName: string;
  enabled: boolean;
  size: number;
  modified: string;
}

export interface PlayitStatus {
  running: boolean;
  claimUrl: string | null;
  tunnelAddress: string | null;
  logs: string[];
}

export interface LogEntry {
  time: string;
  text: string;
}

export interface McVersion {
  id: string;
  releaseTime: string;
}

export interface ModGalleryItem {
  url: string;
  title?: string;
  description?: string;
}

export interface ModVersionFile {
  filename: string;
  size: number;
  url: string;
  primary?: boolean;
}

export interface ModVersion {
  id: string;
  name: string;
  versionNumber: string;
  gameVersions: string[];
  loaders: string[];
  datePublished: string;
  files: ModVersionFile[];
}

export interface ModDetail {
  id: string;
  slug: string;
  title: string;
  description: string;
  body?: string;
  iconUrl: string | null;
  downloads: number;
  followers?: number;
  author?: string;
  categories: string[];
  loaders?: string[];
  gameVersions?: string[];
  gallery: ModGalleryItem[];
  source: 'modrinth' | 'curseforge';
}

export interface StorageConfig {
  dataDir: string;
  defaultDir: string;
  isSetupCompleted: boolean;
}

export interface ModpackItem {
  id: string;
  source: 'modrinth' | 'custom';
  name: string;
  slug?: string;
  description: string;
  iconUrl?: string | null;
  downloads?: number;
  mcVersion: string;
  loader: string;
  loaderVersion?: string;
  mrpackFile?: string;
  modsCount?: number;
  downloadedAt?: string;
  author?: string;
  loaders?: string[];
  versions?: string[];
}
