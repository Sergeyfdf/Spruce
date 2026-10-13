import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Server as ServerType,
  Player,
  ModItem,
  InstalledMod,
  PlayitStatus,
  LogEntry
} from '../types';
import {
  Terminal as TerminalIcon,
  Radio,
  Users,
  Boxes,
  Map as MapIcon,
  Sliders,
  Play,
  Square,
  RotateCcw,
  Skull,
  Send,
  Trash2,
  Copy,
  Check,
  Download,
  Power,
  Shield,
  Compass,
  Bed,
  MapPin,
  Eye,
  AlertTriangle,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Layers,
  FolderOpen,
  Upload
} from 'lucide-react';
import { PlayerInventoryModal } from './PlayerInventoryModal';
import { ModDetailsDrawer } from './ModDetailsDrawer';

interface CommandSuggestion {
  cmd: string;
  desc: string;
  insertText: string;
}

const BASE_COMMANDS: CommandSuggestion[] = [
  { cmd: '/help', desc: 'Справка по доступным командам', insertText: '/help' },
  { cmd: '/gamemode survival', desc: 'Установить режим выживания', insertText: '/gamemode survival ' },
  { cmd: '/gamemode creative', desc: 'Установить творческий режим', insertText: '/gamemode creative ' },
  { cmd: '/gamemode spectator', desc: 'Установить режим наблюдателя', insertText: '/gamemode spectator ' },
  { cmd: '/gamemode adventure', desc: 'Установить режим приключений', insertText: '/gamemode adventure ' },
  { cmd: '/tp <игрок> <x y z>', desc: 'Телепортировать игрока', insertText: '/tp ' },
  { cmd: '/time set day', desc: 'Установить дневное время', insertText: '/time set day' },
  { cmd: '/time set night', desc: 'Установить ночное время', insertText: '/time set night' },
  { cmd: '/time set noon', desc: 'Установить полдень', insertText: '/time set noon' },
  { cmd: '/time set midnight', desc: 'Установить полночь', insertText: '/time set midnight' },
  { cmd: '/weather clear', desc: 'Установить ясную погоду', insertText: '/weather clear' },
  { cmd: '/weather rain', desc: 'Установить дождь', insertText: '/weather rain' },
  { cmd: '/weather thunder', desc: 'Установить грозу', insertText: '/weather thunder' },
  { cmd: '/op <игрок>', desc: 'Выдать права оператора сервера', insertText: '/op ' },
  { cmd: '/deop <игрок>', desc: 'Забрать права оператора', insertText: '/deop ' },
  { cmd: '/kick <игрок>', desc: 'Выгнать игрока с сервера', insertText: '/kick ' },
  { cmd: '/ban <игрок>', desc: 'Заблокировать игрока на сервере', insertText: '/ban ' },
  { cmd: '/pardon <игрок>', desc: 'Разблокировать игрока', insertText: '/pardon ' },
  { cmd: '/whitelist on', desc: 'Включить белый список', insertText: '/whitelist on' },
  { cmd: '/whitelist off', desc: 'Выключить белый список', insertText: '/whitelist off' },
  { cmd: '/whitelist add <игрок>', desc: 'Добавить в белый список', insertText: '/whitelist add ' },
  { cmd: '/give <игрок> <предмет>', desc: 'Выдать предмет игроку', insertText: '/give ' },
  { cmd: '/clear <игрок>', desc: 'Очистить инвентарь игрока', insertText: '/clear ' },
  { cmd: '/kill <игрок>', desc: 'Убить игрока или сущность', insertText: '/kill ' },
  { cmd: '/difficulty peaceful', desc: 'Мирная сложность', insertText: '/difficulty peaceful' },
  { cmd: '/difficulty easy', desc: 'Легкая сложность', insertText: '/difficulty easy' },
  { cmd: '/difficulty normal', desc: 'Нормальная сложность', insertText: '/difficulty normal' },
  { cmd: '/difficulty hard', desc: 'Сложная сложность', insertText: '/difficulty hard' },
  { cmd: '/gamerule keepInventory true', desc: 'Сохранять инвентарь при смерти', insertText: '/gamerule keepInventory true' },
  { cmd: '/gamerule keepInventory false', desc: 'Терять инвентарь при смерти', insertText: '/gamerule keepInventory false' },
  { cmd: '/gamerule mobGriefing false', desc: 'Запретить мобам разрушать блоки', insertText: '/gamerule mobGriefing false' },
  { cmd: '/gamerule mobGriefing true', desc: 'Разрешить мобам разрушать блоки', insertText: '/gamerule mobGriefing true' },
  { cmd: '/spawnpoint', desc: 'Установить точку возрождения', insertText: '/spawnpoint ' },
  { cmd: '/setworldspawn', desc: 'Установить спавн мира', insertText: '/setworldspawn ' },
  { cmd: '/seed', desc: 'Показать зерно генерации мира', insertText: '/seed' },
  { cmd: '/save-all flush', desc: 'Сохранить мир и инвентари на диск', insertText: '/save-all flush' },
  { cmd: '/stop', desc: 'Безопасно остановить сервер', insertText: '/stop' },
  { cmd: '/bluemap reload', desc: 'Перезагрузить BlueMap', insertText: '/bluemap reload' },
  { cmd: '/bluemap update', desc: 'Обновить рендер BlueMap', insertText: '/bluemap update' },
  { cmd: '/bluemap purge world', desc: 'Сбросить и перерендерить карту мира', insertText: '/bluemap purge world' }
];

interface ServerDashboardProps {
  server: ServerType;
  onBack: () => void;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onKill: (id: string) => void;
}

export const ServerDashboard: React.FC<ServerDashboardProps> = ({
  server,
  onBack,
  onStart,
  onStop,
  onKill
}) => {
  const [activeTab, setActiveTab] = useState<'map' | 'console' | 'network' | 'players' | 'mods' | 'settings'>('console');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [cmdInput, setCmdInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [autoScroll, setAutoScroll] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const mapIframeRef = useRef<HTMLIFrameElement>(null);
  const [mapRefreshKey, setMapRefreshKey] = useState(0);

  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayerForInv, setSelectedPlayerForInv] = useState<Player | null>(null);

  const [localIp, setLocalIp] = useState('127.0.0.1');
  const [upnpStatus, setUpnpStatus] = useState<boolean | null>(null);
  const [playit, setPlayit] = useState<PlayitStatus>({
    running: false,
    claimUrl: null,
    tunnelAddress: null,
    logs: []
  });
  const [copiedIp, setCopiedIp] = useState(false);

  const [modQuery, setModQuery] = useState('');
  const [modSearchSource, setModSearchSource] = useState<'modrinth' | 'curseforge'>('modrinth');
  const [curseApiKey, setCurseApiKey] = useState('');
  const [modsTab, setModsTab] = useState<'installed' | 'search'>('installed');
  const [searchResults, setSearchResults] = useState<ModItem[]>([]);
  const [installedMods, setInstalledMods] = useState<InstalledMod[]>([]);
  const [loadingMods, setLoadingMods] = useState(false);
  const [installingModId, setInstallingModId] = useState<string | null>(null);
  const [selectedModForDetails, setSelectedModForDetails] = useState<ModItem | null>(null);

  const [isBlueMapInstalled, setIsBlueMapInstalled] = useState(false);
  const [installingBlueMap, setInstallingBlueMap] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);

  const blueMapPort = 8100 + (((server.port || 25565) - 25565) % 100);
  const mapUrl = `http://localhost:${blueMapPort}/`;

  const [serverProps, setServerProps] = useState<{ [key: string]: string }>({});
  const [savingProps, setSavingProps] = useState(false);
  const isOnline = server.status === 'online';

  useEffect(() => {
    if (!window.spruceApi) return;

    window.spruceApi.getServerLogs(server.id).then((l: LogEntry[]) => {
      setLogs(l || []);
    });

    const removeLogListener = window.spruceApi.onServerLog((event: { serverId: string; line: string }) => {
      if (event.serverId === server.id) {
        setLogs((prev) => [
          ...prev,
          { time: new Date().toLocaleTimeString(), text: event.line }
        ]);
      }
    });

    window.spruceApi.getLocalIp().then((ip: string) => setLocalIp(ip));
    window.spruceApi.getPlayitStatus(server.port).then((s: PlayitStatus) => setPlayit(s));

    const removePlayitListener = window.spruceApi.onPlayitStatusChange((s: PlayitStatus) => {
      setPlayit(s);
    });

    loadPlayers();
    loadInstalledMods();
    checkBlueMap();
    loadServerProps();

    const playerPoll = setInterval(() => {
      loadPlayers();
    }, 2500);

    const checkMap = async () => {
      if (window.spruceApi && window.spruceApi.checkBlueMapReady && isOnline && isBlueMapInstalled) {
        const ready = await window.spruceApi.checkBlueMapReady(blueMapPort);
        setIsMapReady(ready);
      } else {
        setIsMapReady(false);
      }
    };

    checkMap();
    const mapPoll = setInterval(checkMap, 2000);

    return () => {
      removeLogListener();
      removePlayitListener();
      clearInterval(playerPoll);
      clearInterval(mapPoll);
    };
  }, [server.id, server.port, isOnline, isBlueMapInstalled, blueMapPort]);

  useEffect(() => {
    setActiveTab('console');
  }, [server.id]);

  const handleReloadMap = async () => {
    if (window.spruceApi && window.spruceApi.clearBlueMapCache) {
      try {
        await window.spruceApi.clearBlueMapCache();
      } catch (e) {
      }
    }
    setMapRefreshKey((prev) => prev + 1);
  };

  const handlePurgeMap = async () => {
    if (!confirm('Сбросить сохраненные файлы карты BlueMap для этого сервера?')) return;
    if (window.spruceApi && window.spruceApi.purgeBlueMap) {
      await window.spruceApi.purgeBlueMap(server.path);
    }
    if (isOnline && window.spruceApi) {
      window.spruceApi.sendCommand(server.id, 'bluemap purge world');
    }
    await handleReloadMap();
  };

  useEffect(() => {
    if (!isOnline || !isBlueMapInstalled || !isMapReady) return;
    const interval = setInterval(() => {
      handleReloadMap();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isOnline, isBlueMapInstalled, isMapReady]);

  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const loadPlayers = async () => {
    if (!window.spruceApi) return;
    try {
      const list = await window.spruceApi.getAllPlayers(server.id);
      setPlayers(list || []);
    } catch (e) {
    }
  };

  const loadInstalledMods = async () => {
    if (!window.spruceApi) return;
    try {
      const list = await window.spruceApi.listInstalledMods(server.path);
      setInstalledMods(list || []);
    } catch (e) {
    }
  };

  const checkBlueMap = async () => {
    if (!window.spruceApi) return;
    try {
      const installed = await window.spruceApi.isBlueMapInstalled(server.path, server.port);
      setIsBlueMapInstalled(installed);
      if (!installed && server.loader !== 'vanilla') {
        setInstallingBlueMap(true);
        window.spruceApi
          .installBlueMap(server.path, server.loader, server.mcVersion, server.port)
          .then(() => setIsBlueMapInstalled(true))
          .catch(() => { })
          .finally(() => setInstallingBlueMap(false));
      }
    } catch (e) {
    }
  };

  const loadServerProps = async () => {
    if (!window.spruceApi) return;
    try {
      const props = await window.spruceApi.getServerProperties(server.id);
      setServerProps(props || {});
    } catch (e) {
    }
  };

  const handleSendCommand = (cmdToRun?: string) => {
    const text = (cmdToRun !== undefined ? cmdToRun : cmdInput).trim();
    if (!text || !window.spruceApi) return;
    window.spruceApi.sendCommand(server.id, text);
    if (cmdToRun === undefined) setCmdInput('');
    setShowSuggestions(false);
  };

  const handleOpenPlayerModal = (p: Player) => {
    if (isOnline && window.spruceApi) {
      window.spruceApi.sendCommand(server.id, 'save-all flush');
      setTimeout(() => {
        loadPlayers();
      }, 300);
    }
    setSelectedPlayerForInv(p);
  };

  const allSuggestions = useMemo(() => {
    const list = [...BASE_COMMANDS];
    for (const p of players) {
      list.push(
        { cmd: `/tp ${p.name}`, desc: `Телепортировать ${p.name}`, insertText: `/tp ${p.name} ` },
        { cmd: `/op ${p.name}`, desc: `Выдать OP игроку ${p.name}`, insertText: `/op ${p.name}` },
        { cmd: `/deop ${p.name}`, desc: `Забрать OP у ${p.name}`, insertText: `/deop ${p.name}` },
        { cmd: `/kick ${p.name}`, desc: `Кикнуть игрока ${p.name}`, insertText: `/kick ${p.name} ` },
        { cmd: `/ban ${p.name}`, desc: `Забанить игрока ${p.name}`, insertText: `/ban ${p.name} ` },
        { cmd: `/kill ${p.name}`, desc: `Убить игрока ${p.name}`, insertText: `/kill ${p.name}` },
        { cmd: `/clear ${p.name}`, desc: `Очистить инвентарь ${p.name}`, insertText: `/clear ${p.name}` }
      );
    }
    return list;
  }, [players]);

  const matchingSuggestions = useMemo(() => {
    const query = cmdInput.trim().toLowerCase();
    if (!query) return [];
    return allSuggestions
      .filter((s) => s.cmd.toLowerCase().includes(query) || s.desc.toLowerCase().includes(query))
      .slice(0, 8);
  }, [cmdInput, allSuggestions]);

  const handleCopyIp = () => {
    const ipToCopy = getPublicAddress();
    navigator.clipboard.writeText(ipToCopy);
    setCopiedIp(true);
    setTimeout(() => setCopiedIp(false), 2000);
  };

  const handleToggleUpnp = async () => {
    if (!window.spruceApi) return;
    const targetState = !upnpStatus;
    const res = await window.spruceApi.toggleUpnp(server.port, targetState);
    if (res && res.success) {
      setUpnpStatus(targetState);
    } else {
      alert('Не удалось изменить UPnP: роутер не поддерживает или функция выключена в его настройках');
    }
  };

  const handleTogglePlayit = async () => {
    if (!window.spruceApi) return;
    if (playit.running) {
      const res = await window.spruceApi.stopPlayit();
      if (res) setPlayit(res);
    } else {
      const res = await window.spruceApi.startPlayit(server.port);
      if (res) setPlayit(res);
    }
  };

  const handleSearchMods = async (queryOverride?: string, sourceOverride?: 'modrinth' | 'curseforge') => {
    if (!window.spruceApi) return;
    const queryToUse = queryOverride !== undefined ? queryOverride : modQuery;
    const sourceToUse = sourceOverride !== undefined ? sourceOverride : modSearchSource;
    setLoadingMods(true);
    try {
      if (sourceToUse === 'modrinth') {
        const results = await window.spruceApi.searchModrinth({
          query: queryToUse.trim(),
          loader: server.loader,
          mcVersion: server.mcVersion
        });
        setSearchResults(results || []);
      } else {
        const results = await window.spruceApi.searchCurseForge({
          query: queryToUse.trim(),
          loader: server.loader,
          mcVersion: server.mcVersion,
          apiKey: curseApiKey
        });
        setSearchResults(results || []);
      }
    } finally {
      setLoadingMods(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'mods' && modsTab === 'search') {
      handleSearchMods();
    }
  }, [activeTab, modsTab, modSearchSource]);

  const handleInstallMod = async (mod: ModItem) => {
    if (!window.spruceApi) return;
    setInstallingModId(mod.id);
    try {
      if (mod.source === 'modrinth') {
        await window.spruceApi.installModrinthMod({
          projectId: mod.id,
          serverPath: server.path,
          mcVersion: server.mcVersion,
          loader: server.loader
        });
      } else {
        await window.spruceApi.installCurseForgeMod({
          modId: mod.id,
          serverPath: server.path,
          apiKey: curseApiKey,
          mcVersion: server.mcVersion
        });
      }
      alert(`Мод ${mod.title} успешно установлен в папку mods!`);
      loadInstalledMods();
    } catch (err: any) {
      alert(`Ошибка при установке мода: ${err.message || 'Сбой'}`);
    } finally {
      setInstallingModId(null);
    }
  };

  const handleToggleMod = async (mod: InstalledMod) => {
    if (!window.spruceApi) return;
    try {
      await window.spruceApi.toggleModState(server.path, mod.filename);
      loadInstalledMods();
    } catch (e) {
    }
  };

  const handleDeleteMod = async (mod: InstalledMod) => {
    if (!window.spruceApi) return;
    if (confirm(`Удалить файл ${mod.filename}?`)) {
      await window.spruceApi.deleteModFile(server.path, mod.filename);
      loadInstalledMods();
    }
  };

  const handleOpenModsFolder = async () => {
    if (!window.spruceApi) return;
    await window.spruceApi.openModsFolder(server.path);
  };

  const handleImportMods = async () => {
    if (!window.spruceApi) return;
    const res = await window.spruceApi.importMods(server.path);
    if (res && res.success) {
      await loadInstalledMods();
    }
  };

  const handleExportToXmcl = async () => {
    if (!window.spruceApi) return;
    try {
      const res = await window.spruceApi.exportServerToXmcl(server);
      if (res && res.success) {
        alert(`Сервер перенесен в XMCL: инстанс "${res.instanceName}" (${res.modsCopied} модов). Запускаем лаунчер.`);
      }
    } catch (e: any) {
      alert('Ошибка при экспорте в XMCL: ' + (e.message || 'Сбой'));
    }
  };

  const handleInstallBlueMap = async () => {
    if (!window.spruceApi) return;
    setInstallingBlueMap(true);
    try {
      await window.spruceApi.installBlueMap(server.path, server.loader, server.mcVersion, server.port);
      setIsBlueMapInstalled(true);
      alert(`BlueMap 3D карта установлена! Перезапусти сервер, и веб-карта станет доступна на порту ${blueMapPort}.`);
    } catch (e: any) {
      alert('Ошибка при установке BlueMap: ' + (e.message || 'Сбой'));
    } finally {
      setInstallingBlueMap(false);
    }
  };

  const handleSaveProperties = async () => {
    if (!window.spruceApi) return;
    setSavingProps(true);
    try {
      await window.spruceApi.saveServerProperties(server.id, serverProps);
      alert('Настройки server.properties сохранены!');
    } finally {
      setSavingProps(false);
    }
  };

  const getPublicAddress = () => {
    if (playit.tunnelAddress && !playit.tunnelAddress.includes('undefined')) {
      return playit.tunnelAddress;
    }
    const ip = localIp && localIp !== 'undefined' ? localIp : '127.0.0.1';
    return `${ip}:${server.port}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="top-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button className="btn btn-secondary btn-sm" onClick={onBack}>
            Назад
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '18px', fontWeight: 800 }}>{server.name}</h1>
              <span className={`badge ${isOnline ? 'badge-online' : 'badge-offline'}`}>
                {isOnline ? 'Онлайн' : 'Остановлен'}
              </span>
              <span className="badge badge-loader">{server.loader.toUpperCase()} {server.mcVersion}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            className="btn btn-secondary btn-sm"
            style={{ padding: '6px 14px' }}
            onClick={handleExportToXmcl}
            title="Экспортировать этот сервер с модами в лаунчер XMCL"
          >
            <Download size={14} />
            <span>Экспорт в XMCL</span>
          </button>
          <div
            className="ip-display-box"
            style={{ padding: '6px 14px', fontSize: '13px', cursor: 'pointer' }}
            onClick={handleCopyIp}
            title="Нажми, чтобы скопировать IP"
          >
            <span>{getPublicAddress()}</span>
            <span style={{ marginLeft: '8px', opacity: 0.8 }}>
              {copiedIp ? <Check size={14} color="#4ade80" /> : <Copy size={14} />}
            </span>
          </div>
        </div>
      </div>

      <div className="tabs-nav">
        <button
          className={`tab-btn ${activeTab === 'map' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('map');
            checkBlueMap();
            loadPlayers();
          }}
        >
          <MapIcon size={16} />
          <span>Карта мира</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'console' ? 'active' : ''}`}
          onClick={() => setActiveTab('console')}
        >
          <TerminalIcon size={16} />
          <span>Консоль</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'network' ? 'active' : ''}`}
          onClick={() => setActiveTab('network')}
        >
          <Radio size={16} />
          <span>Сеть и Порты</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'players' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('players');
            loadPlayers();
          }}
        >
          <Users size={16} />
          <span>Игроки</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'mods' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('mods');
            loadInstalledMods();
          }}
        >
          <Boxes size={16} />
          <span>Моды</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('settings');
            loadServerProps();
          }}
        >
          <Sliders size={16} />
          <span>Настройки</span>
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0' }}>
          {server.status === 'stopping' ? (
            <button
              className="btn btn-secondary btn-large-control"
              disabled
              style={{ opacity: 0.75, cursor: 'not-allowed' }}
            >
              <Square size={16} />
              <span>Остановка...</span>
            </button>
          ) : isOnline ? (
            <>
              <button
                className="btn btn-danger btn-large-control"
                onClick={() => onStop(server.id)}
              >
                <Square size={16} />
                <span>Остановить сервер</span>
              </button>
              <button
                className="btn btn-secondary btn-icon"
                title="Принудительно убить процесс"
                onClick={() => onKill(server.id)}
              >
                <Power size={16} color="#fb7185" />
              </button>
            </>
          ) : (
            <button
              className="btn btn-start-hero"
              onClick={() => onStart(server.id)}
            >
              <Play size={18} />
              <span>Запустить сервер</span>
            </button>
          )}
        </div>
      </div>

      <div className="content-body" style={{ padding: '20px 28px' }}>
        {activeTab === 'console' && (
          <div className="console-container">
            <div className="console-toolbar">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  Консоль
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setAutoScroll(!autoScroll)}
                  style={{ opacity: autoScroll ? 1 : 0.6 }}
                >
                  Автоскролл: {autoScroll ? 'Вкл' : 'Выкл'}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setLogs([])}>
                  Очистить
                </button>
              </div>
            </div>

            <div className="console-logs">
              {logs.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '60px' }}>
                  Сервер выключен
                </div>
              ) : (
                logs.map((log, index) => {
                  let colorClass = 'log-text';
                  if (log.text.includes('WARN')) colorClass = 'log-warn';
                  if (log.text.includes('ERROR') || log.text.includes('Exception')) colorClass = 'log-error';
                  if (log.text.includes('INFO') || log.text.includes('[Spruce]')) colorClass = 'log-info';

                  return (
                    <div key={index} className="log-line">
                      <span className="log-time">[{log.time}]</span>
                      <span className={colorClass}>{log.text}</span>
                    </div>
                  );
                })
              )}
              <div ref={logsEndRef} />
            </div>

            <div className="quick-commands">
              <button className="quick-cmd-btn" onClick={() => handleSendCommand('/gamemode creative @a')}>
                /gamemode creative
              </button>
              <button className="quick-cmd-btn" onClick={() => handleSendCommand('/gamemode survival @a')}>
                /gamemode survival
              </button>
              <button className="quick-cmd-btn" onClick={() => handleSendCommand('/time set day')}>
                /time set day
              </button>
              <button className="quick-cmd-btn" onClick={() => handleSendCommand('/weather clear')}>
                /weather clear
              </button>
              <button className="quick-cmd-btn" onClick={() => handleSendCommand('/save-all')}>
                /save-all
              </button>
              <button className="quick-cmd-btn" onClick={() => handleSendCommand('/list')}>
                /list
              </button>
            </div>

            <form
              className="console-input-bar"
              style={{ position: 'relative' }}
              onSubmit={(e) => {
                e.preventDefault();
                setShowSuggestions(false);
                handleSendCommand();
              }}
            >
              {showSuggestions && matchingSuggestions.length > 0 && (
                <div className="console-autocomplete-popup">
                  {matchingSuggestions.map((item, idx) => (
                    <div
                      key={item.cmd}
                      className={`autocomplete-item ${idx === selectedSuggestionIndex ? 'active' : ''}`}
                      onClick={() => {
                        setCmdInput(item.insertText);
                        setShowSuggestions(false);
                      }}
                    >
                      <span className="autocomplete-cmd">{item.cmd}</span>
                      <span className="autocomplete-desc">{item.desc}</span>
                    </div>
                  ))}
                </div>
              )}
              <span style={{ color: '#4ade80', fontFamily: 'var(--font-mono)' }}>&gt;</span>
              <input
                type="text"
                className="console-input"
                placeholder={isOnline ? 'Введите команду...' : 'Сервер выключен'}
                value={cmdInput}
                onChange={(e) => {
                  setCmdInput(e.target.value);
                  setShowSuggestions(true);
                  setSelectedSuggestionIndex(0);
                }}
                onKeyDown={(e) => {
                  if (showSuggestions && matchingSuggestions.length > 0) {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setSelectedSuggestionIndex((prev) => (prev + 1) % matchingSuggestions.length);
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setSelectedSuggestionIndex((prev) => (prev - 1 + matchingSuggestions.length) % matchingSuggestions.length);
                    } else if (e.key === 'Tab') {
                      e.preventDefault();
                      setCmdInput(matchingSuggestions[selectedSuggestionIndex].insertText);
                      setShowSuggestions(false);
                    } else if (e.key === 'Escape') {
                      setShowSuggestions(false);
                    }
                  }
                }}
                disabled={!isOnline}
              />
              <button type="submit" className="btn btn-primary btn-sm" disabled={!isOnline || !cmdInput.trim()}>
                <Send size={14} />
              </button>
            </form>
          </div>
        )}

        {activeTab === 'network' && (
          <div className="network-cards">
            <div className="network-card">
              <div className="network-card-header">
                <div className="network-card-title">
                  <Radio size={20} color="#4ade80" />
                  <span>Playit.gg Туннель</span>
                </div>
                <span className={`badge ${playit.running ? 'badge-online' : 'badge-offline'}`}>
                  {playit.running ? 'Работает' : 'Отключен'}
                </span>
              </div>

              {playit.claimUrl && !playit.tunnelAddress && (
                <div
                  style={{
                    background: 'rgba(34, 197, 94, 0.08)',
                    border: '1px solid rgba(34, 197, 94, 0.25)',
                    padding: '14px',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#f4f4f5' }}>
                    Требуется подтвердить привязку на playit.gg:
                  </div>
                  <p style={{ fontSize: '12px', color: '#a1a1aa', lineHeight: '1.4' }}>
                    Подтверди добавление агента в личном кабинете playit.gg:
                  </p>
                  <a
                    href={playit.claimUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-primary btn-sm"
                    style={{ textDecoration: 'none', textAlign: 'center' }}
                  >
                    <span>Привязать агент на playit.gg</span>
                    <ExternalLink size={14} />
                  </a>
                </div>
              )}

              {playit.tunnelAddress && !playit.tunnelAddress.includes('undefined') ? (
                <div className="ip-display-box">
                  <div>
                    <div style={{ fontSize: '10px', color: '#a1a1aa' }}>АДРЕС СЕРВЕРА</div>
                    <div style={{ fontSize: '16px', fontWeight: 800 }}>{playit.tunnelAddress}</div>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={handleCopyIp}>
                    <Copy size={14} />
                    <span>Скопировать</span>
                  </button>
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: '#a1a1aa' }}>
                  {playit.running
                    ? (playit.claimUrl ? 'Ожидание подтверждения привязки на сайте...' : 'Подключение к шлюзу Playit...')
                    : 'Нажми кнопку ниже, чтобы запустить туннель.'}
                </div>
              )}

              <div style={{ marginTop: 'auto', display: 'flex', gap: '10px' }}>
                <button
                  className={`btn ${playit.running ? 'btn-secondary' : 'btn-primary'}`}
                  onClick={handleTogglePlayit}
                  style={{ width: '100%' }}
                >
                  {playit.running ? 'Остановить Playit туннель' : 'Запустить Playit туннель'}
                </button>
              </div>
            </div>

            <div className="network-card">
              <div className="network-card-header">
                <div className="network-card-title">
                  <Shield size={20} color="#4ade80" />
                  <span>UPnP</span>
                </div>
                <span className={`badge ${upnpStatus ? 'badge-online' : 'badge-offline'}`}>
                  {upnpStatus ? 'Порт открыт' : 'Не активен'}
                </span>
              </div>

              <p style={{ fontSize: '13px', color: '#a1a1aa' }}>
                Проброс порта {server.port} на роутере для прямого подключения по IP.
              </p>

              <div className="ip-display-box">
                <div>
                  <div style={{ fontSize: '10px', color: '#a1a1aa' }}>ЛОКАЛЬНЫЙ IP</div>
                  <div style={{ fontSize: '15px' }}>{localIp}:{server.port}</div>
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    navigator.clipboard.writeText(`${localIp}:${server.port}`);
                  }}
                >
                  <Copy size={14} />
                </button>
              </div>

              <div style={{ marginTop: 'auto' }}>
                <button
                  className="btn btn-secondary"
                  onClick={handleToggleUpnp}
                  style={{ width: '100%' }}
                >
                  {upnpStatus ? 'Закрыть порт UPnP' : 'Автоматически открыть порт 25565 через UPnP'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'players' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#d4d4d8' }}>Управление игроками</h3>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={loadPlayers}>
                <RefreshCw size={14} />
                <span>Обновить данные</span>
              </button>
            </div>

            {players.length === 0 ? (
              <div
                style={{
                  background: '#0e0e0e',
                  padding: '36px',
                  borderRadius: '10px',
                  textAlign: 'center',
                  color: '#a1a1aa',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  fontSize: '14px'
                }}
              >
                Игроков пока нет
              </div>
            ) : (
              <div className="players-grid">
                {players.map((p) => (
                  <div
                    key={p.uuid || p.name}
                    className="player-card"
                    onClick={() => handleOpenPlayerModal(p)}
                  >
                    <div className="player-card-header">
                      <img src={p.headUrl} alt={p.name} className="player-head-img" />
                      <div className="player-info-meta">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="player-name">{p.name}</span>
                          <span className={`badge ${p.online ? 'badge-online' : 'badge-offline'}`}>
                            {p.online ? 'В сети' : 'Офлайн'}
                          </span>
                        </div>
                        <div className="player-coords">
                          {p.dimension.toUpperCase()}: {p.coords[0]}, {p.coords[1]}, {p.coords[2]}
                        </div>
                      </div>
                    </div>

                    <div className="player-details-table">
                      <div className="detail-row">
                        <span>Текущие координаты</span>
                        <span>X: {p.coords[0]} | Y: {p.coords[1]} | Z: {p.coords[2]}</span>
                      </div>
                      <div className="detail-row">
                        <span>Точка спавна</span>
                        <span>
                          {p.spawnPoint
                            ? `${p.spawnPoint.x}, ${p.spawnPoint.y}, ${p.spawnPoint.z}`
                            : 'Не установлена'}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span>Точка смерти</span>
                        <span style={{ color: p.lastDeath ? 'var(--accent-rose)' : 'inherit' }}>
                          {p.lastDeath
                            ? `${p.lastDeath.x}, ${p.lastDeath.y}, ${p.lastDeath.z} (${p.lastDeath.dimension})`
                            : 'Нет данных'}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span>Здоровье / Еда</span>
                        <span>{p.health} HP / {p.food} Hunger</span>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '6px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: '6px',
                        fontSize: '11px',
                        color: '#a1a1aa'
                      }}
                    >
                      <span>Нажми для управления игроком</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'mods' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className={`btn ${modsTab === 'installed' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                  onClick={() => setModsTab('installed')}
                >
                  Установленные ({installedMods.length})
                </button>
                <button
                  className={`btn ${modsTab === 'search' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                  onClick={() => setModsTab('search')}
                >
                  Каталог Modrinth & CurseForge
                </button>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleOpenModsFolder}
                  title="Открыть папку mods в проводнике"
                >
                  <FolderOpen size={14} />
                  <span>Открыть папку</span>
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleImportMods}
                  title="Импортировать файлы модов .jar с компьютера"
                >
                  <Upload size={14} />
                  <span>Импортировать мод</span>
                </button>
                <button className="btn btn-secondary btn-sm" onClick={loadInstalledMods} title="Обновить список">
                  <RefreshCw size={14} />
                  <span>Обновить папку</span>
                </button>
              </div>
            </div>

            {modsTab === 'installed' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {installedMods.length === 0 ? (
                  <div
                    style={{
                      background: '#0e0e0e',
                      padding: '36px',
                      borderRadius: '10px',
                      textAlign: 'center',
                      color: '#a1a1aa',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      fontSize: '14px'
                    }}
                  >
                    В папке mods пусто.
                  </div>
                ) : (
                  installedMods.map((m) => (
                    <div
                      key={m.filename}
                      style={{
                        background: '#0e0e0e',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '10px',
                        padding: '12px 18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Boxes size={20} color={m.enabled ? '#4ade80' : '#71717a'} />
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: m.enabled ? '#ffffff' : '#71717a' }}>
                            {m.cleanName}
                          </div>
                          <div style={{ fontSize: '11px', color: '#a1a1aa', fontFamily: 'var(--font-mono)' }}>
                            {(m.size / (1024 * 1024)).toFixed(2)} MB | {m.filename}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                          className={`btn ${m.enabled ? 'btn-secondary' : 'btn-primary'} btn-sm`}
                          onClick={() => handleToggleMod(m)}
                        >
                          {m.enabled ? 'Отключить' : 'Включить'}
                        </button>
                        <button
                          className="btn btn-secondary btn-sm btn-icon"
                          onClick={() => handleDeleteMod(m)}
                        >
                          <Trash2 size={14} color="#f43f5e" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div
                  style={{
                    background: '#0e0e0e',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '10px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <select
                      className="form-select"
                      value={modSearchSource}
                      onChange={(e) => setModSearchSource(e.target.value as any)}
                      style={{ width: '160px', background: '#141414', border: '1px solid rgba(255, 255, 255, 0.15)' }}
                    >
                      <option value="modrinth">Modrinth (API)</option>
                      <option value="curseforge">CurseForge</option>
                    </select>

                    <input
                      type="text"
                      className="form-input"
                      placeholder="Поиск модов (например: Lithium, FerriteCore, BlueMap, WorldEdit)..."
                      value={modQuery}
                      onChange={(e) => setModQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearchMods()}
                      style={{ flex: 1, background: '#141414', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#ffffff' }}
                    />

                    {modSearchSource === 'curseforge' && (
                      <input
                        type="text"
                        className="form-input"
                        placeholder="CurseForge API Key (или в .env)"
                        value={curseApiKey}
                        onChange={(e) => setCurseApiKey(e.target.value)}
                        style={{ width: '220px', background: '#141414', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#ffffff' }}
                      />
                    )}

                    <button className="btn btn-primary" onClick={handleSearchMods} disabled={loadingMods}>
                      <Search size={16} />
                      <span>Найти</span>
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {searchResults.length > 0 && (
                    <div style={{ fontSize: '12px', color: '#71717a' }}>
                      Найдено: {searchResults.length}
                    </div>
                  )}
                </div>

                {loadingMods ? (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: '#4ade80' }}>
                    Загрузка каталога модов...
                  </div>
                ) : searchResults.length === 0 ? (
                  <div
                    style={{
                      background: '#0e0e0e',
                      border: '1px dashed rgba(255, 255, 255, 0.1)',
                      borderRadius: '10px',
                      padding: '40px 20px',
                      textAlign: 'center',
                      color: '#a1a1aa',
                      fontSize: '13px'
                    }}
                  >
                    Ничего не найдено. Попробуй изменить запрос или сменить источник на Modrinth / CurseForge.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                    {searchResults.map((mod) => (
                      <div
                        key={mod.id}
                        className="mod-card"
                        onClick={() => setSelectedModForDetails(mod)}
                        style={{
                          background: '#0e0e0e',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '10px',
                          padding: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                          {mod.iconUrl ? (
                            <img src={mod.iconUrl} alt={mod.title} style={{ width: '42px', height: '42px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
                          ) : (
                            <div className="server-card-icon" style={{ width: '42px', height: '42px' }}>
                              <Boxes size={20} color="#4ade80" />
                            </div>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {mod.title}
                            </div>
                            <div style={{ fontSize: '11px', color: '#a1a1aa' }}>Автор: {mod.author || 'Не указан'}</div>
                          </div>
                        </div>

                        <p
                          style={{
                            fontSize: '12px',
                            color: '#a1a1aa',
                            lineHeight: '1.4',
                            maxHeight: '48px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {mod.description}
                        </p>

                        <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', color: '#a1a1aa', fontFamily: 'var(--font-mono)' }}>
                            {mod.downloads ? `${(mod.downloads / 1000).toFixed(0)}k скачиваний` : ''}
                          </span>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedModForDetails(mod);
                              }}
                            >
                              <Layers size={13} />
                              <span>Версии</span>
                            </button>
                            <button
                              className="btn btn-primary btn-sm"
                              disabled={installingModId === mod.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleInstallMod(mod);
                              }}
                            >
                              <Download size={13} />
                              <span>{installingModId === mod.id ? 'Установка...' : 'Установить'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div style={{ display: activeTab === 'map' ? 'flex' : 'none', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#d4d4d8' }}>Карта мира (BlueMap)</h3>
              {isOnline && (
                <span className="badge badge-online" style={{ fontSize: '11px' }}>В реальном времени</span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {isBlueMapInstalled && isOnline && isMapReady && (
                <>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleReloadMap}
                    title="Обновить карту мира и сбросить кеш"
                  >
                    <RefreshCw size={14} />
                    <span>Обновить карту</span>
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handlePurgeMap}
                    title="Очистить файлы карты BlueMap и перерендерить с нуля"
                  >
                    <Trash2 size={14} color="#f43f5e" />
                    <span>Очистить кеш карты</span>
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => window.open(mapUrl, '_blank')}
                  >
                    <ExternalLink size={14} />
                    <span>В браузере ({blueMapPort})</span>
                  </button>
                </>
              )}
              {!isBlueMapInstalled && (
                <button
                  className="btn btn-primary"
                  onClick={handleInstallBlueMap}
                  disabled={installingBlueMap}
                >
                  <Download size={16} />
                  <span>{installingBlueMap ? 'Скачивание...' : 'Установить BlueMap'}</span>
                </button>
              )}
            </div>
          </div>

          <div className="map-container">
            {isBlueMapInstalled && isOnline && isMapReady ? (
              <iframe
                ref={mapIframeRef}
                key={`${server.id}_${blueMapPort}_${mapRefreshKey}`}
                src={`${mapUrl}?serverId=${server.id}&_t=${mapRefreshKey}`}
                title="BlueMap"
                className="map-iframe"
              />
            ) : (
              <div className="map-placeholder">
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: 'rgba(34, 197, 94, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#4ade80'
                  }}
                >
                  <Compass size={28} />
                </div>
                <div>
                  <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>
                    {!isBlueMapInstalled
                      ? (installingBlueMap ? 'Скачивание BlueMap для сервера...' : 'BlueMap еще не установлен')
                      : (!isOnline
                        ? 'Сервер выключен'
                        : 'Сервер запускается... Ожидание веб-сервера карты')}
                  </h4>
                  <p style={{ fontSize: '13px', color: '#a1a1aa', marginTop: '6px', maxWidth: '420px' }}>
                    {!isBlueMapInstalled
                      ? (installingBlueMap ? 'Загружаем совместимую версию мода под твою версию и загрузчик...' : 'Автоматически скачиваем совместимый мод на карту.')
                      : (!isOnline
                        ? 'Запусти сервер, чтобы открыть динамическую 3D карту мира.'
                        : 'Minecraft и BlueMap инициализируются. Карта мира появится здесь автоматически сразу после запуска.')}
                  </p>
                </div>

                <div style={{ width: '100%', maxWidth: '500px', background: '#0e0e0e', padding: '16px', borderRadius: '10px', textAlign: 'left', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#4ade80', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Радар игроков в мире:</span>
                    <span style={{ fontSize: '11px', color: '#a1a1aa' }}>Обновляется в реальном времени</span>
                  </div>
                  {players.length === 0 ? (
                    <div style={{ fontSize: '12px', color: '#a1a1aa' }}>Нет игроков в мире</div>
                  ) : (
                    players.map((p) => (
                      <div
                        key={p.name}
                        onClick={() => handleOpenPlayerModal(p)}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '12px',
                          padding: '6px 8px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          borderBottom: '1px solid rgba(255,255,255,0.04)'
                        }}
                        title="Нажми для управления игроком"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <img src={p.headUrl} alt={p.name} style={{ width: '18px', height: '18px', borderRadius: '3px' }} />
                          <span style={{ color: '#d4d4d8' }}>{p.name}</span>
                        </div>
                        <span style={{ fontFamily: 'var(--font-mono)', color: '#4ade80' }}>
                          [{p.coords[0]}, {p.coords[1]}, {p.coords[2]}]
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {activeTab === 'settings' && (
          <div className="settings-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#d4d4d8' }}>Параметры сервера</h3>
              <button className="btn btn-primary" onClick={handleSaveProperties} disabled={savingProps}>
                <Check size={16} />
                <span>{savingProps ? 'Сохранение...' : 'Сохранить'}</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Описание сервера (MOTD)</label>
                <input
                  type="text"
                  className="form-input"
                  value={serverProps['motd'] || ''}
                  onChange={(e) => setServerProps({ ...serverProps, motd: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Пиратский режим (Online Mode)</label>
                  <select
                    className="form-select"
                    value={serverProps['online-mode'] || 'false'}
                    onChange={(e) => setServerProps({ ...serverProps, 'online-mode': e.target.value })}
                  >
                    <option value="false">Разрешен (Без лицензии / TLauncher)</option>
                    <option value="true">Только лицензия Mojang/Microsoft</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Сложность игры</label>
                  <select
                    className="form-select"
                    value={serverProps['difficulty'] || 'normal'}
                    onChange={(e) => setServerProps({ ...serverProps, difficulty: e.target.value })}
                  >
                    <option value="peaceful">Мирная (Peaceful)</option>
                    <option value="easy">Легкая (Easy)</option>
                    <option value="normal">Нормальная (Normal)</option>
                    <option value="hard">Сложная (Hard)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">PVP (Битва между игроками)</label>
                  <select
                    className="form-select"
                    value={serverProps['pvp'] || 'true'}
                    onChange={(e) => setServerProps({ ...serverProps, pvp: e.target.value })}
                  >
                    <option value="true">Включено</option>
                    <option value="false">Выключено</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Максимум игроков</label>
                  <input
                    type="number"
                    className="form-input"
                    value={serverProps['max-players'] || '20'}
                    onChange={(e) => setServerProps({ ...serverProps, 'max-players': e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Дальность прорисовки (view-distance)</label>
                <input
                  type="number"
                  className="form-input"
                  value={serverProps['view-distance'] || '10'}
                  onChange={(e) => setServerProps({ ...serverProps, 'view-distance': e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Сид мира (level-seed)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Оставь пустым для случайного сида"
                  value={serverProps['level-seed'] ?? ''}
                  onChange={(e) => setServerProps({ ...serverProps, 'level-seed': e.target.value })}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <PlayerInventoryModal
        player={
          selectedPlayerForInv
            ? players.find((p) => p.uuid === selectedPlayerForInv.uuid || p.name === selectedPlayerForInv.name) || selectedPlayerForInv
            : null
        }
        onClose={() => setSelectedPlayerForInv(null)}
        onSendCommand={handleSendCommand}
        onRefresh={loadPlayers}
      />

      {selectedModForDetails && (
        <ModDetailsDrawer
          mod={selectedModForDetails}
          server={server}
          installedMods={installedMods}
          curseApiKey={curseApiKey}
          onClose={() => setSelectedModForDetails(null)}
          onModInstalled={() => {
            loadInstalledMods();
          }}
        />
      )}
    </div>
  );
};
