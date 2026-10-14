import React, { useState, useEffect } from 'react';
import { Server as ServerType, PlayitStatus } from './types';
import { Sidebar } from './components/Sidebar';
import { ServerList } from './components/ServerList';
import { ServerCreateModal } from './components/ServerCreateModal';
import { ServerDashboard } from './components/ServerDashboard';
import { Radio, ShieldCheck, HardDrive, RefreshCw, Copy, Check, ExternalLink } from 'lucide-react';
import { UpdateCard } from '@marzipan/updater/react';
import '@marzipan/updater/react/style.css';
import { StorageSettingsCard } from './components/StorageSettingsCard';
import { ThemeSettingsCard, LeavesTheme } from './components/ThemeSettingsCard';
import { InitialSetupModal } from './components/InitialSetupModal';
import { ModpacksView } from './components/ModpacksView';
import { StorageConfig } from './types';

export const App: React.FC = () => {
  const [servers, setServers] = useState<ServerType[]>([]);
  const [selectedServer, setSelectedServer] = useState<ServerType | null>(null);
  const [currentView, setCurrentView] = useState<string>('servers');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createModpackId, setCreateModpackId] = useState<string | undefined>(undefined);
  const [localIp, setLocalIp] = useState('127.0.0.1');
  const [copiedTunnel, setCopiedTunnel] = useState(false);
  const [manualSecret, setManualSecret] = useState('');
  const [isInitialSetupOpen, setIsInitialSetupOpen] = useState(false);
  const [leavesTheme, setLeavesTheme] = useState<LeavesTheme>(() => {
    const saved = localStorage.getItem('spruce_leaves_theme');
    if (saved === 'green' || saved === 'snowy' || saved === 'brown') return saved as LeavesTheme;
    return 'brown';
  });

  const handleSelectTheme = (theme: LeavesTheme) => {
    setLeavesTheme(theme);
    localStorage.setItem('spruce_leaves_theme', theme);
  };

  const [playit, setPlayit] = useState<PlayitStatus>({
    running: false,
    claimUrl: null,
    tunnelAddress: null,
    logs: []
  });

  const loadServers = async () => {
    if (!window.spruceApi) return;
    try {
      const list = await window.spruceApi.listServers();
      setServers(list || []);
      if (selectedServer) {
        const updated = list.find((s: ServerType) => s.id === selectedServer.id);
        if (updated) setSelectedServer(updated);
      }
    } catch (e) {
    }
  };

  const handleInitialSetupComplete = async () => {
    setIsInitialSetupOpen(false);
    await loadServers();
  };

  useEffect(() => {
    loadServers();

    if (window.spruceApi) {
      window.spruceApi.getStorageConfig().then((cfg: StorageConfig) => {
        if (cfg && !cfg.isSetupCompleted) {
          setIsInitialSetupOpen(true);
        }
      });

      window.spruceApi.getLocalIp().then((ip: string) => setLocalIp(ip));
      window.spruceApi.getPlayitStatus().then((s: PlayitStatus) => setPlayit(s));

      const removeStatusListener = window.spruceApi.onServerStatusChange((data: { serverId: string; status: any }) => {
        setServers((prev) =>
          prev.map((s) => (s.id === data.serverId ? { ...s, status: data.status } : s))
        );
        setSelectedServer((prev) =>
          prev && prev.id === data.serverId ? { ...prev, status: data.status } : prev
        );
      });

      const removePlayitListener = window.spruceApi.onPlayitStatusChange((s: PlayitStatus) => {
        setPlayit(s);
      });

      return () => {
        removeStatusListener();
        removePlayitListener();
      };
    }
  }, []);

  const handleCreateServer = async (data: any) => {
    if (!window.spruceApi) return;
    const newServer = await window.spruceApi.createServer(data);
    await loadServers();
    if (newServer) {
      setSelectedServer(newServer);
    }
  };

  const handleStartServer = async (id: string) => {
    if (!window.spruceApi) return;
    await window.spruceApi.startServer(id);
    loadServers();
  };

  const handleStopServer = async (id: string) => {
    if (!window.spruceApi) return;
    setServers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: 'stopping' } : s))
    );
    setSelectedServer((prev) =>
      prev && prev.id === id ? { ...prev, status: 'stopping' } : prev
    );
    await window.spruceApi.stopServer(id);
    loadServers();
  };

  const handleKillServer = async (id: string) => {
    if (!window.spruceApi) return;
    await window.spruceApi.killServer(id);
    loadServers();
  };

  const handleDeleteServer = async (id: string) => {
    if (!window.spruceApi) return;
    await window.spruceApi.deleteServer(id);
    if (selectedServer && selectedServer.id === id) {
      setSelectedServer(null);
    }
    loadServers();
  };

  const handleTogglePlayit = async () => {
    if (!window.spruceApi) return;
    if (playit.running) {
      const res = await window.spruceApi.stopPlayit();
      if (res) setPlayit(res);
    } else {
      const res = await window.spruceApi.startPlayit();
      if (res) setPlayit(res);
    }
  };

  const handleSavePlayitSecret = async () => {
    if (!manualSecret.trim() || !window.spruceApi) return;
    await window.spruceApi.setPlayitSecret(manualSecret.trim());
    await window.spruceApi.startPlayit();
    setManualSecret('');
  };

  return (
    <div className={`app-container theme-${leavesTheme}`}>
      <Sidebar
        currentView={currentView}
        onSelectView={(view) => {
          setCurrentView(view);
          setSelectedServer(null);
        }}
        serversCount={servers.length}
        playitRunning={playit.running}
        onOpenCreate={() => setIsCreateOpen(true)}
      />

      <main className="main-content">
        {selectedServer ? (
          <ServerDashboard
            key={selectedServer.id}
            server={selectedServer}
            onBack={() => {
              setSelectedServer(null);
              loadServers();
            }}
            onStart={handleStartServer}
            onStop={handleStopServer}
            onKill={handleKillServer}
          />
        ) : currentView === 'servers' ? (
          <div className="content-body">
            <ServerList
              servers={servers}
              onSelectServer={(s) => setSelectedServer(s)}
              onStartServer={handleStartServer}
              onStopServer={handleStopServer}
              onDeleteServer={handleDeleteServer}
              onOpenCreate={() => setIsCreateOpen(true)}
            />
          </div>
        ) : currentView === 'modpacks' ? (
          <div className="content-body" style={{ maxWidth: '1200px', width: '100%' }}>
            <ModpacksView
              onCreateServerWithModpack={(modpackId) => {
                setCreateModpackId(modpackId);
                setIsCreateOpen(true);
              }}
            />
          </div>
        ) : currentView === 'tunnel' ? (
          <div className="content-body" style={{ maxWidth: '800px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Playit.gg Шлюз и Туннели</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
                  Глобальный доступ к твоим серверам без белого IP и без сторонних сетей вроде Radmin VPN
                </p>
              </div>

              <div className="network-card">
                <div className="network-card-header">
                  <div className="network-card-title">
                    <Radio size={20} color="var(--accent-spruce)" />
                    <span>Статус туннеля</span>
                  </div>
                  <span className={`badge ${playit.running ? 'badge-online' : 'badge-offline'}`}>
                    {playit.running ? 'Активен' : 'Остановлен'}
                  </span>
                </div>

                {playit.claimUrl && !playit.tunnelAddress && (
                  <div
                    style={{
                      background: 'rgba(245, 158, 11, 0.12)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      padding: '14px',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}
                  >
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>Привязка к playit.gg:</div>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                      Подтверди добавление агента в личном кабинете playit.gg.
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
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>АДРЕС СЕРВЕРА</div>
                      <div style={{ fontSize: '16px', fontWeight: 800 }}>{playit.tunnelAddress}</div>
                    </div>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        navigator.clipboard.writeText(playit.tunnelAddress || '');
                        setCopiedTunnel(true);
                        setTimeout(() => setCopiedTunnel(false), 2000);
                      }}
                    >
                      {copiedTunnel ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copiedTunnel ? 'Скопировано' : 'Скопировать'}</span>
                    </button>
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {playit.running
                      ? (playit.claimUrl ? 'Ожидание подтверждения привязки на сайте...' : 'Подключение к шлюзу Playit...')
                      : 'Нажми кнопку ниже, чтобы запустить туннель.'}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleSavePlayitSecret}
                    disabled={!manualSecret.trim()}
                  >
                    Применить
                  </button>
                </div>

                <button
                  className={`btn ${playit.running ? 'btn-danger' : 'btn-primary'}`}
                  onClick={handleTogglePlayit}
                >
                  {playit.running ? 'Остановить агент Playit' : 'Запустить туннель Playit'}
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  Логи процесса Playit Agent
                </span>
                <div
                  style={{
                    background: '#070a0e',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    color: '#94a3b8',
                    height: '240px',
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {playit.logs.length === 0 ? 'Нет логов' : playit.logs.join('\n')}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="content-body" style={{ maxWidth: '1200px', width: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: 800 }}>Настройки</h2>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '20px', alignItems: 'start' }}>
                <ThemeSettingsCard currentTheme={leavesTheme} onSelectTheme={handleSelectTheme} />
                <StorageSettingsCard />
                <UpdateCard title="Обновления Spruce" />
              </div>
            </div>
          </div>
        )}
      </main>

      <ServerCreateModal
        isOpen={isCreateOpen}
        initialModpackId={createModpackId}
        onClose={() => {
          setIsCreateOpen(false);
          setCreateModpackId(undefined);
        }}
        onCreate={handleCreateServer}
      />

      <InitialSetupModal
        isOpen={isInitialSetupOpen}
        onComplete={handleInitialSetupComplete}
      />
    </div>
  );
};
