import React, { useState, useEffect } from 'react';
import { Folder, FolderOpen, Check, Loader2, HardDrive } from 'lucide-react';
import { StorageConfig } from '../types';

export const StorageSettingsCard: React.FC = () => {
  const [config, setConfig] = useState<StorageConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadConfig = async () => {
    if (!window.spruceApi) return;
    const res = await window.spruceApi.getStorageConfig();
    if (res) setConfig(res);
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleSelectDirectory = async () => {
    if (!window.spruceApi) return;
    const selected = await window.spruceApi.selectDirectory();
    if (!selected) return;

    setLoading(true);
    setMessage(null);
    try {
      const res = await window.spruceApi.setStorageDirectory(selected);
      if (res && res.success) {
        await loadConfig();
      } else {
        setMessage('Ошибка: ' + (res?.error || 'не удалось применить папку'));
      }
    } catch (err: any) {
      setMessage('Ошибка: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenFolder = () => {
    if (!window.spruceApi || !config) return;
    window.spruceApi.openDirectory(config.dataDir);
  };

  return (
    <div className="settings-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <HardDrive size={20} color="var(--accent-spruce)" />
          <div style={{ fontSize: '16px', fontWeight: 700 }}>Хранилище серверов и рантаймов</div>
        </div>
      </div>


      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label className="form-label" style={{ margin: 0 }}>Текущий путь к данным</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            className="form-input"
            readOnly
            value={config ? config.dataDir : 'Загрузка...'}
            style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', background: '#0e0e0e' }}
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleOpenFolder}
            title="Открыть папку в проводнике"
            style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <FolderOpen size={16} />
            <span>Проводник</span>
          </button>
        </div>
      </div>

      {message && (
        <div style={{ fontSize: '12px', color: message.startsWith('Ошибка') ? '#f87171' : '#a1a1aa' }}>
          {message}
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSelectDirectory}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          {loading ? <Loader2 size={16} className="spinner" /> : <Folder size={16} />}
          <span>{loading ? 'Перенос файлов...' : 'Выбрать другую папку'}</span>
        </button>
      </div>
    </div>
  );
};
