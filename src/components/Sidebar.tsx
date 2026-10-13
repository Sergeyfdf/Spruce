import React from 'react';
import { Server, PlusCircle, Radio, Settings, ShieldCheck, Layers } from 'lucide-react';
import spruceIcon from '../assets/icon.png';

interface SidebarProps {
  currentView: string;
  onSelectView: (view: string) => void;
  serversCount: number;
  playitRunning: boolean;
  onOpenCreate: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  serversCount,
  playitRunning,
  onOpenCreate
}) => {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <img
          src={spruceIcon}
          alt="Spruce"
          style={{ width: '46px', height: '46px', objectFit: 'contain', filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.45))' }}
        />
        <div>
          <div className="logo-text">Spruce</div>
        </div>
      </div>

      <div className="sidebar-nav">
        <button
          className={`nav-item ${currentView === 'servers' ? 'active' : ''}`}
          onClick={() => onSelectView('servers')}
        >
          <Server size={20} />
          <span>Все серверы</span>
          <span className="nav-counter">{serversCount}</span>
        </button>

        <button
          className="nav-item"
          onClick={onOpenCreate}
        >
          <PlusCircle size={20} />
          <span>Создать сервер</span>
        </button>

        <div className="sidebar-divider" />

        <button
          className={`nav-item ${currentView === 'modpacks' ? 'active' : ''}`}
          onClick={() => onSelectView('modpacks')}
        >
          <Layers size={20} />
          <span>Модпаки</span>
        </button>

        <div className="sidebar-divider" />

        <button
          className={`nav-item ${currentView === 'tunnel' ? 'active' : ''}`}
          onClick={() => onSelectView('tunnel')}
        >
          <Radio size={20} />
          <span>Playit Туннель</span>
        </button>

        <div className="sidebar-divider" />

        <button
          className={`nav-item ${currentView === 'settings' ? 'active' : ''}`}
          onClick={() => onSelectView('settings')}
        >
          <Settings size={20} />
          <span>Настройки</span>
        </button>
      </div>

      <div className="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
        </div>
      </div>
    </aside>
  );
};
