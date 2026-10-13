import React, { useState, useEffect } from 'react';
import {
  Layers,
  Search,
  Download,
  Plus,
  Trash2,
  Check,
  Loader2,
  Server,
  FolderOpen,
  ExternalLink,
  PackageCheck
} from 'lucide-react';
import { ModpackItem } from '../types';

interface ModpacksViewProps {
  onCreateServerWithModpack: (modpackId: string) => void;
}

export const ModpacksView: React.FC<ModpacksViewProps> = ({ onCreateServerWithModpack }) => {
  const [tab, setTab] = useState<'catalog' | 'my'>('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLoader, setSelectedLoader] = useState('');
  const [selectedMcVersion, setSelectedMcVersion] = useState('');
  const [catalogItems, setCatalogItems] = useState<ModpackItem[]>([]);
  const [localModpacks, setLocalModpacks] = useState<ModpackItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newPackName, setNewPackName] = useState('');
  const [newPackDesc, setNewPackDesc] = useState('');
  const [newPackMcVersion, setNewPackMcVersion] = useState('1.20.1');
  const [newPackLoader, setNewPackLoader] = useState('fabric');
  const [newPackLoaderVersion, setNewPackLoaderVersion] = useState('');

  const loadLocalModpacks = async () => {
    if (!window.spruceApi) return;
    try {
      const list = await window.spruceApi.listLocalModpacks();
      if (Array.isArray(list)) setLocalModpacks(list);
    } catch (e) {}
  };

  const handleSearchCatalog = async () => {
    if (!window.spruceApi) return;
    setLoadingCatalog(true);
    try {
      const results = await window.spruceApi.searchModpacks({
        query: searchQuery,
        loader: selectedLoader,
        mcVersion: selectedMcVersion,
        limit: 24
      });
      if (Array.isArray(results)) {
        setCatalogItems(results);
      }
    } catch (e) {
    } finally {
      setLoadingCatalog(false);
    }
  };

  useEffect(() => {
    loadLocalModpacks();
    handleSearchCatalog();

    if (window.spruceApi && window.spruceApi.onModpackDownloadProgress) {
      const unsubscribe = window.spruceApi.onModpackDownloadProgress((percent: number) => {
        setDownloadProgress(percent);
      });
      return () => unsubscribe();
    }
  }, []);

  const handleDownloadModpack = async (pack: ModpackItem) => {
    if (!window.spruceApi || downloadingId) return;
    setDownloadingId(pack.id);
    setDownloadProgress(0);

    try {
      const versions = await window.spruceApi.getModpackVersions(pack.id);
      if (!versions || versions.length === 0) {
        alert('Версии модпака не найдены');
        return;
      }
      const targetVer = versions[0];
      if (!targetVer.fileUrl) {
        alert('Ссылка на скачивание архива не найдена');
        return;
      }

      await window.spruceApi.downloadModpack({
        modpackId: pack.id,
        versionId: targetVer.id,
        title: pack.title || pack.name,
        description: pack.description || '',
        iconUrl: pack.iconUrl,
        mcVersion: targetVer.gameVersions?.[0] || '1.20.1',
        loader: targetVer.loaders?.[0] || 'fabric',
        downloadUrl: targetVer.fileUrl
      });

      await loadLocalModpacks();
      setTab('my');
    } catch (err: any) {
      alert('Ошибка при скачивании: ' + (err.message || 'Сбой'));
    } finally {
      setDownloadingId(null);
      setDownloadProgress(0);
    }
  };

  const handleDeleteLocal = async (id: string) => {
    if (!window.spruceApi) return;
    if (confirm('Удалить этот модпак из локального каталога?')) {
      await window.spruceApi.deleteLocalModpack(id);
      await loadLocalModpacks();
    }
  };

  const handleCreateCustomPack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.spruceApi || !newPackName.trim()) return;

    try {
      await window.spruceApi.createLocalModpack({
        name: newPackName.trim(),
        description: newPackDesc.trim(),
        mcVersion: newPackMcVersion,
        loader: newPackLoader,
        loaderVersion: newPackLoaderVersion.trim()
      });
      setIsCreateModalOpen(false);
      setNewPackName('');
      setNewPackDesc('');
      await loadLocalModpacks();
      setTab('my');
    } catch (err: any) {
      alert('Ошибка при создании: ' + err.message);
    }
  };

  const isDownloaded = (modpackId: string) => {
    return localModpacks.some((m) => m.id === `modrinth-${modpackId}` || m.slug === modpackId);
  };

  return (
    <div className="content-body" style={{ maxWidth: '1240px', width: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: 800 }}>Каталог и Модпаки</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
              Готовые сборки из Modrinth и собственные наборы модов для развертывания серверов
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              className="btn btn-primary"
              onClick={() => setIsCreateModalOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Plus size={16} />
              <span>Создать свой модпак</span>
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              className={`btn ${tab === 'catalog' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => setTab('catalog')}
            >
              Каталог Modrinth
            </button>
            <button
              className={`btn ${tab === 'my' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => setTab('my')}
            >
              Мои модпаки ({localModpacks.length})
            </button>
          </div>
        </div>

        {tab === 'catalog' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div
              style={{
                background: '#0e0e0e',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                gap: '12px',
                flexWrap: 'wrap',
                alignItems: 'center'
              }}
            >
              <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Поиск модпаков в Modrinth (например: Cobblemon, All the Mods, Better MC)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchCatalog()}
                  style={{ width: '100%', background: '#141414', border: '1px solid rgba(255, 255, 255, 0.14)', color: '#ffffff' }}
                />
              </div>

              <select
                className="form-select"
                value={selectedLoader}
                onChange={(e) => setSelectedLoader(e.target.value)}
                style={{ width: '160px', background: '#141414', border: '1px solid rgba(255, 255, 255, 0.14)' }}
              >
                <option value="">Все ядра</option>
                <option value="fabric">Fabric</option>
                <option value="forge">Forge</option>
                <option value="neoforge">NeoForge</option>
                <option value="quilt">Quilt</option>
              </select>

              <select
                className="form-select"
                value={selectedMcVersion}
                onChange={(e) => setSelectedMcVersion(e.target.value)}
                style={{ width: '140px', background: '#141414', border: '1px solid rgba(255, 255, 255, 0.14)' }}
              >
                <option value="">Все версии</option>
                <option value="1.21.4">1.21.4</option>
                <option value="1.21.1">1.21.1</option>
                <option value="1.20.1">1.20.1</option>
                <option value="1.19.2">1.19.2</option>
                <option value="1.18.2">1.18.2</option>
                <option value="1.16.5">1.16.5</option>
                <option value="1.12.2">1.12.2</option>
              </select>

              <button
                className="btn btn-primary"
                onClick={handleSearchCatalog}
                disabled={loadingCatalog}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {loadingCatalog ? <Loader2 size={16} className="spinner" /> : <Search size={16} />}
                <span>Поиск</span>
              </button>
            </div>

            {loadingCatalog ? (
              <div style={{ padding: '60px', textAlign: 'center', color: '#a1a1aa' }}>
                <Loader2 size={32} className="spinner" style={{ margin: '0 auto 12px' }} />
                <div>Загрузка модпаков из Modrinth...</div>
              </div>
            ) : catalogItems.length === 0 ? (
              <div
                style={{
                  background: '#0e0e0e',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '48px',
                  textAlign: 'center',
                  color: '#a1a1aa'
                }}
              >
                Модпаки не найдены. Попробуй изменить запрос или фильтры.
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
                  gap: '18px'
                }}
              >
                {catalogItems.map((item) => {
                  const alreadySaved = isDownloaded(item.id);
                  const isDownloadingThis = downloadingId === item.id;

                  return (
                    <div
                      key={item.id}
                      style={{
                        background: '#0e0e0e',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '12px',
                        padding: '20px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '14px',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)'
                      }}
                    >
                      <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                        {item.iconUrl ? (
                          <img
                            src={item.iconUrl}
                            alt=""
                            style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover' }}
                          />
                        ) : (
                          <div
                            style={{
                              width: '48px',
                              height: '48px',
                              borderRadius: '8px',
                              background: '#18181b',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <Layers size={24} color="#71717a" />
                          </div>
                        )}

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.title}
                          </div>
                          <div style={{ fontSize: '12px', color: '#71717a', marginTop: '2px' }}>
                            {item.author ? `от ${item.author}` : ''} • {item.downloads?.toLocaleString()} загрузок
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          fontSize: '13px',
                          color: '#a1a1aa',
                          lineHeight: '1.45',
                          height: '56px',
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical'
                        }}
                      >
                        {item.description}
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {(item.loaders || []).slice(0, 3).map((ld) => (
                          <span
                            key={ld}
                            style={{
                              fontSize: '11px',
                              background: 'rgba(255, 255, 255, 0.06)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              color: '#d4d4d8',
                              textTransform: 'uppercase'
                            }}
                          >
                            {ld}
                          </span>
                        ))}
                      </div>

                      <div style={{ paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <a
                          href={`https://modrinth.com/modpack/${item.slug || item.id}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: '12px', color: '#71717a', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                        >
                          <span>Modrinth</span>
                          <ExternalLink size={12} />
                        </a>

                        {alreadySaved ? (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              const found = localModpacks.find((m) => m.id === `modrinth-${item.id}` || m.slug === item.id);
                              if (found) onCreateServerWithModpack(found.id);
                            }}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                            <PackageCheck size={14} color="#4ade80" />
                            <span>Создать сервер</span>
                          </button>
                        ) : (
                          <button
                            className="btn btn-primary btn-sm"
                            disabled={isDownloadingThis}
                            onClick={() => handleDownloadModpack(item)}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                            {isDownloadingThis ? (
                              <>
                                <Loader2 size={14} className="spinner" />
                                <span>{downloadProgress}%</span>
                              </>
                            ) : (
                              <>
                                <Download size={14} />
                                <span>Скачать</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'my' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {localModpacks.length === 0 ? (
              <div
                style={{
                  background: '#0e0e0e',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '48px',
                  textAlign: 'center',
                  color: '#a1a1aa'
                }}
              >
                <Layers size={36} style={{ margin: '0 auto 12px', color: '#71717a' }} />
                <div style={{ fontSize: '16px', fontWeight: 600, color: '#ffffff' }}>У тебя пока нет сохраненных модпаков</div>
                <div style={{ fontSize: '13px', marginTop: '6px' }}>
                  Скачай готовую сборку во вкладке «Каталог Modrinth» или нажми «Создать свой модпак».
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
                  gap: '18px'
                }}
              >
                {localModpacks.map((pack) => (
                  <div
                    key={pack.id}
                    style={{
                      background: '#0e0e0e',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '12px',
                      padding: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '14px',
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)'
                    }}
                  >
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                      {pack.iconUrl ? (
                        <img
                          src={pack.iconUrl}
                          alt=""
                          style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover' }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '8px',
                            background: '#18181b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <Layers size={24} color="var(--accent-spruce)" />
                        </div>
                      )}

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>
                          {pack.name}
                        </div>
                        <div style={{ fontSize: '12px', color: '#71717a', marginTop: '2px' }}>
                          {pack.mcVersion} • {pack.loader.toUpperCase()} {pack.loaderVersion ? `(${pack.loaderVersion})` : ''}
                        </div>
                      </div>
                    </div>

                    {pack.description && (
                      <div
                        style={{
                          fontSize: '13px',
                          color: '#a1a1aa',
                          lineHeight: '1.45',
                          height: '38px',
                          overflow: 'hidden'
                        }}
                      >
                        {pack.description}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#71717a' }}>
                      <span>{pack.source === 'modrinth' ? 'Сборка Modrinth' : 'Свой модпак'}</span>
                      {pack.modsCount ? <span>Модов: {pack.modsCount}</span> : null}
                    </div>

                    <div style={{ paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <button
                        className="btn btn-secondary btn-sm btn-icon"
                        onClick={() => handleDeleteLocal(pack.id)}
                        title="Удалить модпак"
                      >
                        <Trash2 size={14} color="#f43f5e" />
                      </button>

                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => onCreateServerWithModpack(pack.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Server size={14} />
                        <span>Создать сервер</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {isCreateModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsCreateModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Создать свой модпак</h2>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setIsCreateModalOpen(false)}>
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateCustomPack}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Название модпака</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={newPackName}
                    onChange={(e) => setNewPackName(e.target.value)}
                    placeholder="Пример: Моя сборка RPG"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Описание (необязательно)</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    value={newPackDesc}
                    onChange={(e) => setNewPackDesc(e.target.value)}
                    placeholder="Краткое описание сборки..."
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Версия Minecraft</label>
                    <select
                      className="form-select"
                      value={newPackMcVersion}
                      onChange={(e) => setNewPackMcVersion(e.target.value)}
                    >
                      <option value="1.21.4">1.21.4</option>
                      <option value="1.21.1">1.21.1</option>
                      <option value="1.20.4">1.20.4</option>
                      <option value="1.20.1">1.20.1</option>
                      <option value="1.19.2">1.19.2</option>
                      <option value="1.18.2">1.18.2</option>
                      <option value="1.16.5">1.16.5</option>
                      <option value="1.12.2">1.12.2</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Загрузчик</label>
                    <select
                      className="form-select"
                      value={newPackLoader}
                      onChange={(e) => setNewPackLoader(e.target.value)}
                    >
                      <option value="fabric">Fabric</option>
                      <option value="forge">Forge</option>
                      <option value="neoforge">NeoForge</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Версия загрузчика (необязательно)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newPackLoaderVersion}
                    onChange={(e) => setNewPackLoaderVersion(e.target.value)}
                    placeholder="Например: 0.16.10 или 47.4.10"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsCreateModalOpen(false)}>
                  Отмена
                </button>
                <button type="submit" className="btn btn-primary">
                  Сохранить модпак
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
