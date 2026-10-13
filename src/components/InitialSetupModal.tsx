import React, { useState, useEffect } from 'react';
import { Folder, HardDrive, Check, Loader2 } from 'lucide-react';
import { StorageConfig } from '../types';

interface InitialSetupModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

export const InitialSetupModal: React.FC<InitialSetupModalProps> = ({
  isOpen,
  onComplete
}) => {
  const [selectedPath, setSelectedPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !window.spruceApi) return;
    setLoading(true);
    window.spruceApi.getStorageConfig().then((cfg: StorageConfig) => {
      if (cfg) {
        setSelectedPath(cfg.dataDir || cfg.defaultDir);
      }
    }).finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBrowse = async () => {
    if (!window.spruceApi) return;
    const res = await window.spruceApi.selectDirectory();
    if (res) {
      setSelectedPath(res);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.spruceApi) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await window.spruceApi.completeInitialSetup(selectedPath);
      if (res && res.success) {
        onComplete();
      } else {
        setError(res?.error || 'Не удалось применить выбранную папку');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal-card" style={{ maxWidth: '560px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <HardDrive size={22} color="var(--accent-spruce)" />
            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Начальная настройка Spruce</h3>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              Сама программа установлена в систему и будет обновляться в фоне. Выбери директорию, где будут храниться все твои серверы Minecraft, миры, моды и загруженные версии Java.
            </p>

            <div className="form-group">
              <label className="form-label">Папка для серверов и рантаймов</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={selectedPath}
                  onChange={(e) => setSelectedPath(e.target.value)}
                  disabled={submitting || loading}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleBrowse}
                  disabled={submitting || loading}
                  style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Folder size={16} />
                  <span>Обзор...</span>
                </button>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Можно выбрать любой диск (например, D:\SpruceData), чтобы не расходовать память диска C.
              </span>
            </div>

            {error && (
              <div style={{ fontSize: '12px', color: '#f87171' }}>
                {error}
              </div>
            )}
          </div>

          <div className="modal-footer" style={{ justifyContent: 'flex-end' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || loading || !selectedPath.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {submitting ? <Loader2 size={16} className="spinner" /> : <Check size={16} />}
              <span>{submitting ? 'Сохранение...' : 'Начать работу'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
