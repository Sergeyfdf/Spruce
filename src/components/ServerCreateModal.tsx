import React, { useState, useEffect } from 'react';
import { X, Check, Loader2 } from 'lucide-react';
import { McVersion } from '../types';

interface ServerCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: {
    name: string;
    mcVersion: string;
    loader: 'vanilla' | 'fabric' | 'forge' | 'neoforge';
    ramMin: number;
    ramMax: number;
    port: number;
    seed?: string;
  }) => Promise<void>;
}

export const ServerCreateModal: React.FC<ServerCreateModalProps> = ({
  isOpen,
  onClose,
  onCreate
}) => {
  const [name, setName] = useState('Мой сервер Spruce');
  const [mcVersion, setMcVersion] = useState('1.20.1');
  const [loader, setLoader] = useState<'vanilla' | 'fabric' | 'forge' | 'neoforge'>('forge');
  const [ramMax, setRamMax] = useState(4096);
  const [port, setPort] = useState(25565);
  const [seed, setSeed] = useState('');
  const [versions, setVersions] = useState<McVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setLoadingVersions(true);
    if (window.spruceApi) {
      window.spruceApi.listServers().then((servers: any[]) => {
        if (servers && servers.length > 0) {
          const usedPorts = servers.map((s) => s.port || 25565);
          const maxPort = Math.max(...usedPorts, 25564);
          setPort(maxPort + 1);
        } else {
          setPort(25565);
        }
      });

      window.spruceApi
        .getMinecraftVersions()
        .then((list: McVersion[]) => {
          if (list && list.length > 0) {
            setVersions(list);
            setMcVersion(list[0].id);
          }
        })
        .finally(() => setLoadingVersions(false));
    } else {
      setVersions([
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
      ]);
      setLoadingVersions(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setProgressMsg('Подготовка сервера и установка ядра...');

    try {
      await onCreate({
        name,
        mcVersion,
        loader,
        ramMin: Math.min(1024, ramMax),
        ramMax,
        port,
        seed: seed.trim()
      });
      onClose();
    } catch (err: any) {
      alert('Ошибка при создании сервера: ' + (err.message || 'Неизвестная ошибка'));
    } finally {
      setSubmitting(false);
      setProgressMsg('');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Новый Сервер Minecraft</h2>
          <button className="btn btn-secondary btn-sm btn-icon" onClick={onClose} disabled={submitting}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Название сервера</label>
              <input
                type="text"
                className="form-input"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Пример: Сборка с модами"
                disabled={submitting}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Версия Minecraft</label>
                <select
                  className="form-select"
                  value={mcVersion}
                  onChange={(e) => setMcVersion(e.target.value)}
                  disabled={submitting || loadingVersions}
                >
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.id}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Загрузчик / Ядро</label>
                <select
                  className="form-select"
                  value={loader}
                  onChange={(e) => setLoader(e.target.value as any)}
                  disabled={submitting}
                >
                  <option value="forge">Forge</option>
                  <option value="neoforge">NeoForge</option>
                  <option value="fabric">Fabric</option>
                  <option value="vanilla">Vanilla</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label">Выделяемая RAM</label>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                  {ramMax} MB ({(ramMax / 1024).toFixed(1)} GB)
                </span>
              </div>
              <input
                type="range"
                min="1024"
                max="16384"
                step="512"
                value={ramMax}
                onChange={(e) => setRamMax(Number(e.target.value))}
                disabled={submitting}
                style={{ accentColor: '#d4d4d8', cursor: 'pointer', height: '6px' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Порт сервера</label>
                <input
                  type="number"
                  className="form-input"
                  value={port}
                  onChange={(e) => setPort(Number(e.target.value))}
                  min="1024"
                  max="65535"
                  disabled={submitting}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Стандартный порт: 25565
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Сид мира (seed)</label>
                <input
                  type="text"
                  className="form-input"
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  placeholder="Случайный (пусто)"
                  disabled={submitting}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Любое число или текст
                </span>
              </div>
            </div>

            {submitting && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#d4d4d8', fontSize: '13px' }}>
                <Loader2 size={16} className="spin-animation" />
                <span>{progressMsg}</span>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 size={16} className="spin-animation" />
                  <span>Установка ядра...</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>Создать сервер</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
