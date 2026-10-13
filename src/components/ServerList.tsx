import React, { useState } from 'react';
import { Server as ServerType } from '../types';
import { Play, Square, Terminal, Trash2, Cpu, HardDrive, Users, Server as ServerIcon, Plus } from 'lucide-react';

interface ServerListProps {
  servers: ServerType[];
  onSelectServer: (server: ServerType) => void;
  onStartServer: (id: string) => void;
  onStopServer: (id: string) => void;
  onDeleteServer: (id: string) => void;
  onOpenCreate: () => void;
}

export const ServerList: React.FC<ServerListProps> = ({
  servers,
  onSelectServer,
  onStartServer,
  onStopServer,
  onDeleteServer,
  onOpenCreate
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.3px' }}>Серверы</h2>
        <button className="btn btn-primary" onClick={onOpenCreate}>
          <Plus size={16} />
          <span>Создать сервер</span>
        </button>
      </div>

      {servers.length === 0 ? (
        <div
          style={{
            background: '#0e0e0e',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px dashed rgba(255, 255, 255, 0.12)',
            borderRadius: '10px',
            padding: '60px 20px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px'
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#a1a1aa'
            }}
          >
            <ServerIcon size={28} />
          </div>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#ffffff' }}>Серверов пока нет</h3>
            <p style={{ color: '#a1a1aa', fontSize: '13px', marginTop: '4px' }}>
              Добавь свой первый сервер, чтобы начать игру
            </p>
          </div>
          <button className="btn btn-primary" onClick={onOpenCreate}>
            <Plus size={16} />
            <span>Создать сервер</span>
          </button>
        </div>
      ) : (
        <div className="server-grid">
          {servers.map((server) => {
            const isOnline = server.status === 'online';
            return (
              <div
                key={server.id}
                className={`server-card ${isOnline ? 'selected' : ''}`}
                onClick={() => onSelectServer(server)}
              >
                <div className="server-card-top">
                  <div className="server-card-icon">
                    <ServerIcon size={22} />
                  </div>
                  <div className="server-card-meta">
                    <div className="server-card-title">{server.name}</div>
                    <div className="server-card-sub">
                      <span>{server.loader.charAt(0).toUpperCase() + server.loader.slice(1)} {server.mcVersion}</span>
                      <span className="sub-dot">•</span>
                      <span>Порт {server.port}</span>
                    </div>
                  </div>
                  <div className={`status-indicator ${isOnline ? 'online' : ''}`}>
                    <span className="status-dot" />
                    <span>{isOnline ? (server.onlinePlayersCount ? `${server.onlinePlayersCount} онлайн` : 'Онлайн') : 'Остановлен'}</span>
                  </div>
                </div>

                <div className="server-card-actions">
                  {isOnline ? (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onStopServer(server.id);
                      }}
                    >
                      <Square size={13} />
                      <span>Стоп</span>
                    </button>
                  ) : (
                    <button
                      className="btn btn-start btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartServer(server.id);
                      }}
                    >
                      <Play size={13} />
                      <span>Старт</span>
                    </button>
                  )}
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectServer(server);
                    }}
                  >
                    <Terminal size={13} />
                    <span>Панель</span>
                  </button>

                  <button
                    className="btn btn-ghost btn-sm btn-icon"
                    title="Удалить сервер"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Точно удалить сервер "${server.name}"? Все файлы мира будут стёрты.`)) {
                        onDeleteServer(server.id);
                      }
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
