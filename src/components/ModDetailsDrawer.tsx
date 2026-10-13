import React, { useState, useEffect, useMemo } from 'react';
import { ModItem, Server as ServerType, InstalledMod, ModDetail, ModVersion } from '../types';
import { X, Download, Check, Image as ImageIcon, FileText, Layers, AlertCircle, Eye } from 'lucide-react';
import { marked } from 'marked';

interface ModDetailsDrawerProps {
  mod: ModItem | null;
  server: ServerType;
  installedMods: InstalledMod[];
  curseApiKey: string;
  onClose: () => void;
  onModInstalled: () => void;
}

export const ModDetailsDrawer: React.FC<ModDetailsDrawerProps> = ({
  mod,
  server,
  installedMods,
  curseApiKey,
  onClose,
  onModInstalled
}) => {
  const [details, setDetails] = useState<ModDetail | null>(null);
  const [versions, setVersions] = useState<ModVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'gallery' | 'versions'>('versions');
  const [installingVersionId, setInstallingVersionId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [onlyCompatible, setOnlyCompatible] = useState(false);

  useEffect(() => {
    if (!mod || !window.spruceApi) {
      setDetails(null);
      setVersions([]);
      return;
    }

    let isCancelled = false;
    setLoading(true);
    setActiveTab('versions');

    const loadData = async () => {
      try {
        if (mod.source === 'modrinth') {
          const [projectData, versionsData] = await Promise.all([
            window.spruceApi.getModrinthProject(mod.slug || mod.id).catch(() => null),
            window.spruceApi.getModrinthVersions({
              projectIdOrSlug: mod.slug || mod.id,
              loader: server.loader,
              mcVersion: server.mcVersion
            }).catch(() => [])
          ]);

          if (isCancelled) return;

          if (projectData) {
            setDetails({
              ...projectData,
              source: 'modrinth'
            });
          } else {
            setDetails({
              id: mod.id,
              slug: mod.slug,
              title: mod.title,
              description: mod.description,
              iconUrl: mod.iconUrl,
              downloads: mod.downloads,
              author: mod.author,
              categories: mod.categories,
              gallery: [],
              source: 'modrinth'
            });
          }

          const vers = versionsData || [];
          setVersions(vers);
          const hasCompat = vers.some((v: ModVersion) => isVersionCompatible(v));
          setOnlyCompatible(hasCompat);
        } else {
          const [projectData, filesData] = await Promise.all([
            window.spruceApi.getCurseForgeProject({ modId: mod.id, apiKey: curseApiKey }).catch(() => null),
            window.spruceApi.getCurseForgeVersions({
              modId: mod.id,
              apiKey: curseApiKey,
              loader: server.loader,
              mcVersion: server.mcVersion
            }).catch(() => [])
          ]);

          if (isCancelled) return;

          if (projectData) {
            setDetails({
              ...projectData,
              source: 'curseforge'
            });
          } else {
            setDetails({
              id: mod.id,
              slug: mod.slug,
              title: mod.title,
              description: mod.description,
              iconUrl: mod.iconUrl,
              downloads: mod.downloads,
              author: mod.author,
              categories: mod.categories,
              gallery: [],
              source: 'curseforge'
            });
          }

          const vers = filesData || [];
          setVersions(vers);
          const hasCompat = vers.some((v: ModVersion) => isVersionCompatible(v));
          setOnlyCompatible(hasCompat);
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    loadData();

    return () => {
      isCancelled = true;
    };
  }, [mod, curseApiKey, server.loader, server.mcVersion]);

  if (!mod) return null;

  const getLoaderStyle = (loaderName: string) => {
    const l = loaderName.toLowerCase();
    if (l === 'forge') {
      return { background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)' };
    }
    if (l === 'neoforge') {
      return { background: 'rgba(249, 115, 22, 0.15)', color: '#f97316', border: '1px solid rgba(249, 115, 22, 0.3)' };
    }
    if (l === 'fabric') {
      return { background: 'rgba(74, 222, 128, 0.15)', color: '#4ade80', border: '1px solid rgba(74, 222, 128, 0.3)' };
    }
    if (l === 'quilt') {
      return { background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)' };
    }
    return { background: 'rgba(255, 255, 255, 0.08)', color: '#d4d4d8', border: '1px solid rgba(255, 255, 255, 0.12)' };
  };

  const isVersionCompatible = (v: ModVersion) => {
    const sLoader = (server.loader || '').toLowerCase();
    const sVer = server.mcVersion;

    const hasLoader =
      !sLoader ||
      sLoader === 'vanilla' ||
      (v.loaders && v.loaders.map((l) => l.toLowerCase()).includes(sLoader));

    const hasVer =
      !sVer ||
      (v.gameVersions && v.gameVersions.includes(sVer));

    return Boolean(hasLoader && hasVer);
  };

  const parsedBodyHtml = useMemo(() => {
    if (!details?.body) return '';
    try {
      return marked.parse(details.body, { gfm: true, breaks: true }) as string;
    } catch {
      return '';
    }
  }, [details?.body]);

  const isFileInstalled = (filename: string) => {
    return installedMods.some(
      (im) => im.filename === filename || im.cleanName.toLowerCase() === filename.replace('.jar', '').toLowerCase()
    );
  };

  const handleInstallSpecificVersion = async (v: ModVersion) => {
    if (!v.files || v.files.length === 0) return;
    const file = v.files.find((f) => f.primary) || v.files[0];
    if (!file || !file.url) {
      alert('У этой версии нет прямой ссылки на скачивание');
      return;
    }

    setInstallingVersionId(v.id);
    try {
      await window.spruceApi.installModFile({
        serverPath: server.path,
        fileUrl: file.url,
        filename: file.filename
      });
      onModInstalled();
    } catch (err: any) {
      alert(`Ошибка установки: ${err.message || 'Сбой'}`);
    } finally {
      setInstallingVersionId(null);
    }
  };

  const filteredVersions = onlyCompatible
    ? versions.filter((v) => isVersionCompatible(v))
    : versions;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          zIndex: 100
        }}
        onClick={onClose}
      />

      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(580px, 92vw)',
          background: '#0d0d0d',
          borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.8)',
          zIndex: 101,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideInRight 0.22s ease-out'
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(20, 20, 20, 0.95)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '3px 8px',
                borderRadius: '4px',
                background: mod.source === 'modrinth' ? 'rgba(74, 222, 128, 0.15)' : 'rgba(249, 115, 22, 0.15)',
                color: mod.source === 'modrinth' ? '#4ade80' : '#f97316',
                border: mod.source === 'modrinth' ? '1px solid rgba(74, 222, 128, 0.3)' : '1px solid rgba(249, 115, 22, 0.3)'
              }}
            >
              {mod.source === 'modrinth' ? 'Modrinth' : 'CurseForge'}
            </span>
          </div>

          <button
            onClick={onClose}
            className="btn btn-secondary btn-sm btn-icon"
            style={{ width: '32px', height: '32px', padding: 0 }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
            {mod.iconUrl ? (
              <img
                src={mod.iconUrl}
                alt={mod.title}
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '12px',
                  objectFit: 'cover',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  flexShrink: 0
                }}
              />
            ) : (
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  flexShrink: 0
                }}
              >
                <Layers size={28} color="#4ade80" />
              </div>
            )}

            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff', lineHeight: 1.2 }}>
                {mod.title}
              </h2>
              <div style={{ fontSize: '13px', color: '#a1a1aa', marginTop: '4px' }}>
                Автор: <span style={{ color: '#e4e4e7', fontWeight: 600 }}>{mod.author || 'Не указан'}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                {mod.downloads > 0 && (
                  <span style={{ fontSize: '11px', color: '#a1a1aa', background: 'rgba(255, 255, 255, 0.05)', padding: '2px 8px', borderRadius: '4px' }}>
                    {(mod.downloads / 1000).toFixed(0)}k скачиваний
                  </span>
                )}
                {(mod.categories || []).slice(0, 3).map((cat) => (
                  <span key={cat} style={{ fontSize: '11px', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '6px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              paddingBottom: '8px'
            }}
          >
            <button
              onClick={() => setActiveTab('versions')}
              className={`btn btn-sm ${activeTab === 'versions' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Layers size={14} />
              <span>Версии ({versions.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('gallery')}
              className={`btn btn-sm ${activeTab === 'gallery' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <ImageIcon size={14} />
              <span>Галерея ({details?.gallery?.length || 0})</span>
            </button>
            <button
              onClick={() => setActiveTab('info')}
              className={`btn btn-sm ${activeTab === 'info' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <FileText size={14} />
              <span>Описание</span>
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#4ade80' }}>
              Загрузка данных мода...
            </div>
          ) : activeTab === 'versions' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
                <span style={{ fontSize: '13px', color: '#a1a1aa' }}>
                  Сервер: <strong style={{ color: '#ffffff' }}>{server.loader.toUpperCase()} {server.mcVersion}</strong>
                </span>

                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#e4e4e7', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={onlyCompatible}
                    onChange={(e) => setOnlyCompatible(e.target.checked)}
                    style={{ accentColor: 'var(--accent-spruce)', cursor: 'pointer' }}
                  />
                  <span>Только совместимые</span>
                </label>
              </div>

              {filteredVersions.length === 0 ? (
                <div
                  style={{
                    background: '#141414',
                    border: '1px dashed rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '30px',
                    textAlign: 'center',
                    color: '#a1a1aa',
                    fontSize: '13px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '10px'
                  }}
                >
                  <AlertCircle size={24} color="#f59e0b" />
                  <div>
                    {onlyCompatible
                      ? `Нет версий для ${server.loader.toUpperCase()} ${server.mcVersion}. Сними галочку «Только совместимые», чтобы увидеть все версии.`
                      : 'Список версий пуст.'}
                  </div>
                </div>
              ) : (
                filteredVersions.map((v) => {
                  const compat = isVersionCompatible(v);
                  const primFile = v.files && (v.files.find((f) => f.primary) || v.files[0]);
                  const alreadyInstalled = primFile ? isFileInstalled(primFile.filename) : false;
                  const isInstalling = installingVersionId === v.id;

                  return (
                    <div
                      key={v.id}
                      style={{
                        background: '#141414',
                        border: compat ? '1px solid rgba(74, 222, 128, 0.25)' : '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '8px',
                        padding: '12px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>
                              {v.name || v.versionNumber}
                            </span>
                            {compat && (
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  background: 'rgba(74, 222, 128, 0.15)',
                                  color: '#4ade80',
                                  border: '1px solid rgba(74, 222, 128, 0.3)',
                                  padding: '1px 6px',
                                  borderRadius: '4px'
                                }}
                              >
                                Совместимо
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '11px', color: '#a1a1aa', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                            {primFile ? `${primFile.filename} (${(primFile.size / (1024 * 1024)).toFixed(2)} MB)` : v.versionNumber}
                          </div>
                        </div>

                        {alreadyInstalled ? (
                          <span
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              color: '#4ade80',
                              background: 'rgba(74, 222, 128, 0.1)',
                              padding: '4px 8px',
                              borderRadius: '4px'
                            }}
                          >
                            <Check size={13} />
                            <span>Установлен</span>
                          </span>
                        ) : (
                          <button
                            className="btn btn-primary btn-sm"
                            disabled={isInstalling || !primFile}
                            onClick={() => handleInstallSpecificVersion(v)}
                            style={{ flexShrink: 0 }}
                          >
                            <Download size={13} />
                            <span>{isInstalling ? 'Установка...' : 'Установить'}</span>
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {(v.loaders || []).map((l) => (
                          <span
                            key={l}
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              padding: '1px 6px',
                              borderRadius: '3px',
                              ...getLoaderStyle(l)
                            }}
                          >
                            {l}
                          </span>
                        ))}
                        {(v.gameVersions || []).slice(0, 6).map((gv) => (
                          <span
                            key={gv}
                            style={{
                              fontSize: '10px',
                              background: gv === server.mcVersion ? 'rgba(74, 222, 128, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                              color: gv === server.mcVersion ? '#4ade80' : '#a1a1aa',
                              padding: '1px 5px',
                              borderRadius: '3px',
                              fontFamily: 'var(--font-mono)'
                            }}
                          >
                            MC {gv}
                          </span>
                        ))}
                        {(v.gameVersions || []).length > 6 && (
                          <span style={{ fontSize: '10px', color: '#71717a' }}>
                            +{v.gameVersions.length - 6} версий
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : activeTab === 'gallery' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {(!details?.gallery || details.gallery.length === 0) ? (
                <div
                  style={{
                    background: '#141414',
                    border: '1px dashed rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '40px 20px',
                    textAlign: 'center',
                    color: '#a1a1aa',
                    fontSize: '13px'
                  }}
                >
                  В галерее этого мода нет скриншотов.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
                  {details.gallery.map((img, idx) => (
                    <div
                      key={idx}
                      style={{
                        position: 'relative',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        aspectRatio: '16 / 9',
                        background: '#141414'
                      }}
                      onClick={() => setSelectedImage(img.url)}
                    >
                      <img
                        src={img.url}
                        alt={img.title || `Скриншот ${idx + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      {img.title && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            padding: '6px 8px',
                            background: 'rgba(0, 0, 0, 0.75)',
                            fontSize: '11px',
                            color: '#ffffff',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {img.title}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div
                style={{
                  background: '#141414',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px',
                  padding: '16px',
                  color: '#e4e4e7',
                  fontSize: '13px',
                  lineHeight: '1.6'
                }}
              >
                <div style={{ fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>
                  Краткое описание:
                </div>
                <p>{mod.description || 'Нет описания'}</p>
              </div>

              {parsedBodyHtml ? (
                <div
                  style={{
                    background: '#141414',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    padding: '18px',
                    maxHeight: '480px',
                    overflowY: 'auto'
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#ffffff', marginBottom: '12px', fontSize: '14px' }}>
                    Подробная информация:
                  </div>
                  <div
                    className="mod-description-html"
                    dangerouslySetInnerHTML={{ __html: parsedBodyHtml }}
                  />
                </div>
              ) : details?.body ? (
                <div
                  style={{
                    background: '#141414',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    padding: '16px',
                    color: '#d4d4d8',
                    fontSize: '13px',
                    lineHeight: '1.6',
                    maxHeight: '400px',
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'inherit'
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>
                    Подробная информация:
                  </div>
                  {details.body}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {selectedImage && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.9)',
            zIndex: 110,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px'
          }}
          onClick={() => setSelectedImage(null)}
        >
          <img
            src={selectedImage}
            alt="Preview"
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 0 30px rgba(0,0,0,0.9)' }}
          />
        </div>
      )}
    </>
  );
};
