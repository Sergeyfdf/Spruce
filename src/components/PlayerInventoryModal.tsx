import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Player, PlayerInventoryItem } from '../types';
import inventoryGuiTexture from '../assets/gui/inventory.png';

interface PlayerInventoryModalProps {
  player: Player | null;
  onClose: () => void;
  onSendCommand?: (cmd: string) => void;
  onRefresh?: () => void;
}

const ITEM_NAMES_RU: { [key: string]: string } = {
  leaf_litter: 'Опавшие листья',
  brown_mushroom: 'Коричневый гриб',
  red_mushroom: 'Красный гриб',
  stone: 'Камень',
  dirt: 'Земля',
  cobblestone: 'Булыжник',
  oak_planks: 'Дубовые доски',
  spruce_planks: 'Еловые доски',
  birch_planks: 'Берёзовые доски',
  diamond_sword: 'Алмазный меч',
  iron_sword: 'Железный меч',
  golden_apple: 'Золотое яблоко',
  enchanted_golden_apple: 'Зачарованное яблоко',
  diamond_pickaxe: 'Алмазная кирка',
  netherite_sword: 'Незеритовый меч',
  shield: 'Щит',
  totem_of_undying: 'Тотем бессмертия',
  ender_pearl: 'Жемчуг Края',
  cooked_beef: 'Жареная говядина',
  bread: 'Хлеб',
  iron_chestplate: 'Железный нагрудник',
  diamond_chestplate: 'Алмазный нагрудник',
  netherite_chestplate: 'Незеритовый нагрудник',
  iron_helmet: 'Железный шлем',
  diamond_helmet: 'Алмазный шлем',
  iron_boots: 'Железные ботинки',
  diamond_boots: 'Алмазные ботинки',
  bow: 'Лук',
  arrow: 'Стрела',
  stick: 'Палка',
  apple: 'Яблоко'
};

function formatItemTitle(id: string): string {
  const clean = id.replace('minecraft:', '');
  if (ITEM_NAMES_RU[clean]) {
    return ITEM_NAMES_RU[clean];
  }
  return clean
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const McItemIcon: React.FC<{ id: string }> = ({ id }) => {
  const clean = id.replace('minecraft:', '');
  const [stage, setStage] = useState(0);

  const getSrc = () => {
    if (clean === 'leaf_litter') {
      return stage === 0
        ? 'https://assets.mcasset.cloud/snapshot/assets/minecraft/textures/block/leaf_litter.png'
        : 'https://assets.mcasset.cloud/snapshot/assets/minecraft/textures/item/leaf_litter.png';
    }
    if (stage === 0) {
      return `https://assets.mcasset.cloud/1.21.1/assets/minecraft/textures/item/${clean}.png`;
    }
    if (stage === 1) {
      return `https://assets.mcasset.cloud/1.21.1/assets/minecraft/textures/block/${clean}.png`;
    }
    if (stage === 2) {
      return `https://assets.mcasset.cloud/snapshot/assets/minecraft/textures/block/${clean}.png`;
    }
    return '';
  };

  const src = getSrc();

  if (stage > 2 || !src) {
    return (
      <span
        style={{
          fontSize: '9px',
          color: '#ffffff',
          textAlign: 'center',
          wordBreak: 'break-all',
          lineHeight: 1,
          padding: '2px',
          fontFamily: 'var(--font-mono)'
        }}
      >
        {clean.replace(/_/g, ' ')}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={clean}
      style={{
        width: '32px',
        height: '32px',
        imageRendering: 'pixelated',
        pointerEvents: 'none'
      }}
      onError={() => setStage((prev) => prev + 1)}
    />
  );
};

export const PlayerInventoryModal: React.FC<PlayerInventoryModalProps> = ({
  player,
  onClose,
  onSendCommand,
  onRefresh
}) => {
  if (!player) return null;

  const [tpCoords, setTpCoords] = useState({
    x: Math.round(player.coords[0]),
    y: Math.round(player.coords[1]),
    z: Math.round(player.coords[2])
  });

  const [spawnCoords, setSpawnCoords] = useState({
    x: player.spawnPoint ? player.spawnPoint.x : Math.round(player.coords[0]),
    y: player.spawnPoint ? player.spawnPoint.y : Math.round(player.coords[1]),
    z: player.spawnPoint ? player.spawnPoint.z : Math.round(player.coords[2])
  });

  const [lastActionMsg, setLastActionMsg] = useState<string | null>(null);
  const [hoveredItem, setHoveredItem] = useState<PlayerInventoryItem | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (player) {
      setTpCoords({
        x: Math.round(player.coords[0]),
        y: Math.round(player.coords[1]),
        z: Math.round(player.coords[2])
      });
      setSpawnCoords({
        x: player.spawnPoint ? player.spawnPoint.x : Math.round(player.coords[0]),
        y: player.spawnPoint ? player.spawnPoint.y : Math.round(player.coords[1]),
        z: player.spawnPoint ? player.spawnPoint.z : Math.round(player.coords[2])
      });
    }
  }, [player?.name, player?.coords]);

  const send = (cmd: string, desc?: string) => {
    if (onSendCommand) {
      onSendCommand(cmd);
      setLastActionMsg(desc || `Выполнено: ${cmd}`);
      setTimeout(() => setLastActionMsg(null), 3000);
    }
  };

  const itemsBySlot: { [key: number]: PlayerInventoryItem } = {};
  player.inventory.forEach((item) => {
    itemsBySlot[item.slot] = item;
  });

  const getSlotItem = (slotIndex: number) => {
    return itemsBySlot[slotIndex] || null;
  };

  const renderSlot = (slotIndex: number, left: number, top: number, label?: string) => {
    const item = getSlotItem(slotIndex);
    return (
      <div
        key={slotIndex}
        className="mc-slot"
        style={{
          position: 'absolute',
          left: `${left}px`,
          top: `${top}px`,
          width: '36px',
          height: '36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: item ? 'pointer' : 'default',
          userSelect: 'none'
        }}
        onMouseEnter={(e) => {
          if (item) {
            setHoveredItem(item);
            setTooltipPos({ x: e.clientX, y: e.clientY });
          }
        }}
        onMouseMove={(e) => {
          if (item) {
            setTooltipPos({ x: e.clientX, y: e.clientY });
          }
        }}
        onMouseLeave={() => setHoveredItem(null)}
      >
        {item ? (
          <>
            <McItemIcon id={item.id} />
            {item.count > 1 && (
              <span
                style={{
                  position: 'absolute',
                  bottom: '2px',
                  right: '4px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  fontSize: '13px',
                  color: '#ffffff',
                  textShadow: '2px 2px 0px #1a1a1a',
                  pointerEvents: 'none'
                }}
              >
                {item.count}
              </span>
            )}
          </>
        ) : label ? (
          <span style={{ fontSize: '8px', color: 'rgba(255, 255, 255, 0.15)', pointerEvents: 'none' }}>
            {label}
          </span>
        ) : null}
      </div>
    );
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '820px', width: '95%' }}
      >
        <div className="modal-header" style={{ padding: '16px 20px', borderColor: 'rgba(255, 255, 255, 0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img
              src={player.headUrl}
              alt={player.name}
              style={{ width: '36px', height: '36px', borderRadius: '6px', imageRendering: 'pixelated' }}
            />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff' }}>{player.name}</span>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '1px 7px',
                    borderRadius: '4px',
                    background: player.online ? 'rgba(74, 222, 128, 0.12)' : 'rgba(255, 255, 255, 0.06)',
                    color: player.online ? '#86efac' : '#71717a'
                  }}
                >
                  {player.online ? 'В сети' : 'Офлайн'}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '1px 7px',
                    borderRadius: '4px',
                    background: 'rgba(255, 255, 255, 0.06)',
                    color: '#a1a1aa'
                  }}
                >
                  {player.dimension.toUpperCase()}
                </span>
              </div>
              <span style={{ fontSize: '11px', color: '#71717a', fontFamily: 'var(--font-mono)' }}>
                UUID: {player.uuid}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                send('save-all flush', 'Мир сохранен на диск, данные обновлены');
                if (onRefresh) {
                  setTimeout(() => onRefresh(), 300);
                }
              }}
              title="Синхронизировать инвентарь и точку смерти с сервером"
              style={{ padding: '5px 12px', fontSize: '12px', color: '#d4d4d8' }}
            >
              Синхронизировать
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => send(`/op ${player.name}`, `Выданы права OP игроку ${player.name}`)}
              title="Выдать права оператора"
              style={{ padding: '5px 12px', fontSize: '12px', color: '#d4d4d8' }}
            >
              OP
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => send(`/deop ${player.name}`, `Сняты права OP с игрока ${player.name}`)}
              title="Забрать права оператора"
              style={{ padding: '5px 12px', fontSize: '12px', color: '#d4d4d8' }}
            >
              Deop
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                const reason = prompt(`Причина кика для ${player.name}:`, 'Кикнут администратором');
                if (reason !== null) {
                  send(`/kick ${player.name} ${reason}`, `Игрок ${player.name} кикнут`);
                }
              }}
              title="Кикнуть игрока"
              style={{ padding: '5px 12px', fontSize: '12px', color: '#d4d4d8' }}
            >
              Кик
            </button>
            <button
              className="btn btn-danger btn-sm"
              style={{ padding: '5px 12px', fontSize: '12px', background: 'rgba(225, 29, 72, 0.2)', border: '1px solid rgba(225, 29, 72, 0.35)', color: '#fca5a5' }}
              onClick={() => {
                const reason = prompt(`Причина бана для ${player.name}:`, 'Заблокирован администратором');
                if (reason !== null) {
                  send(`/ban ${player.name} ${reason}`, `Игрок ${player.name} забанен`);
                }
              }}
              title="Забанить игрока"
            >
              Бан
            </button>
            <button
              className="btn btn-secondary btn-sm btn-icon"
              onClick={onClose}
              style={{ padding: '6px', color: '#a1a1aa' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="modal-body" style={{ gap: '16px', padding: '20px' }}>
          {lastActionMsg && (
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '8px 12px',
                borderRadius: '6px',
                color: '#d4d4d8',
                fontSize: '12px'
              }}
            >
              {lastActionMsg}
            </div>
          )}

          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                background: '#121212',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.06)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                  Инвентарь игрока
                </span>
                <span style={{ fontSize: '11px', color: '#71717a' }}>
                  Vanilla Dark GUI
                </span>
              </div>

              <div
                className="mc-gui-inventory"
                style={{
                  width: '352px',
                  height: '332px',
                  position: 'relative',
                  backgroundImage: `url(${inventoryGuiTexture})`,
                  backgroundSize: '512px 512px',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: '0 0',
                  imageRendering: 'pixelated',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)'
                }}
              >
                {renderSlot(103, 16, 16, 'Шлем')}
                {renderSlot(102, 16, 52, 'Нагрудник')}
                {renderSlot(101, 16, 88, 'Поножи')}
                {renderSlot(100, 16, 124, 'Ботинки')}

                <div
                  style={{
                    position: 'absolute',
                    left: '52px',
                    top: '16px',
                    width: '102px',
                    height: '144px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden'
                  }}
                >
                  <img
                    src={player.avatarUrl}
                    alt={player.name}
                    style={{
                      height: '136px',
                      objectFit: 'contain',
                      imageRendering: 'pixelated',
                      pointerEvents: 'none'
                    }}
                  />
                </div>

                {renderSlot(-106, 154, 124, 'Щит')}

                {Array.from({ length: 9 }, (_, col) => renderSlot(col + 9, 16 + col * 36, 168))}
                {Array.from({ length: 9 }, (_, col) => renderSlot(col + 18, 16 + col * 36, 204))}
                {Array.from({ length: 9 }, (_, col) => renderSlot(col + 27, 16 + col * 36, 240))}

                {Array.from({ length: 9 }, (_, col) => renderSlot(col, 16 + col * 36, 284))}
              </div>
            </div>

            <div
              style={{
                flex: 1,
                minWidth: '320px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}
            >
              <div
                style={{
                  background: '#121212',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '8px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                    Статус игрока
                  </span>
                  <span style={{ fontSize: '11px', color: '#71717a', fontFamily: 'var(--font-mono)' }}>
                    XYZ: {Math.round(player.coords[0])}, {Math.round(player.coords[1])}, {Math.round(player.coords[2])}
                  </span>
                </div>

                <div
                  style={{
                    background: '#161616',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.05)'
                  }}
                >
                  <div>
                    <span style={{ color: '#71717a' }}>HP: </span>
                    <span style={{ color: '#ffffff', fontWeight: 600 }}>{player.health}/20</span>
                  </div>
                  <div>
                    <span style={{ color: '#71717a' }}>Голод: </span>
                    <span style={{ color: '#ffffff', fontWeight: 600 }}>{player.food}/20</span>
                  </div>
                  <div>
                    <span style={{ color: '#71717a' }}>Уровень: </span>
                    <span style={{ color: '#ffffff', fontWeight: 600 }}>{player.xp} LVL</span>
                  </div>
                </div>

                <div
                  style={{
                    background: '#161616',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    border: '1px solid rgba(255, 255, 255, 0.05)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#71717a' }}>Спавн:</span>
                    <span style={{ color: '#d4d4d8' }}>
                      {player.spawnPoint
                        ? `${player.spawnPoint.x}, ${player.spawnPoint.y}, ${player.spawnPoint.z}`
                        : 'Не установлена'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#71717a' }}>Смерть:</span>
                    <span style={{ color: '#d4d4d8' }}>
                      {player.lastDeath
                        ? `${player.lastDeath.x}, ${player.lastDeath.y}, ${player.lastDeath.z}`
                        : 'Нет данных'}
                    </span>
                  </div>
                </div>
              </div>

              <div
                style={{
                  background: '#121212',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '8px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#ffffff', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                  Здоровье
                </span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => send(`/damage ${player.name} 2`, `-2 HP игроку ${player.name}`)}
                    style={{ color: '#d4d4d8', padding: '4px 8px', fontSize: '11px' }}
                  >
                    -2 HP
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => send(`/damage ${player.name} 6`, `-6 HP игроку ${player.name}`)}
                    style={{ color: '#d4d4d8', padding: '4px 8px', fontSize: '11px' }}
                  >
                    -6 HP
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => send(`/effect give ${player.name} instant_health 1 0`, `+2 HP игроку ${player.name}`)}
                    style={{ color: '#d4d4d8', padding: '4px 8px', fontSize: '11px' }}
                  >
                    +2 HP
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => send(`/effect give ${player.name} instant_health 1 255`, `Игрок ${player.name} вылечен`)}
                    style={{ color: '#ffffff', padding: '4px 8px', fontSize: '11px' }}
                  >
                    Полное HP
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => send(`/kill ${player.name}`, `Игрок ${player.name} убит`)}
                    style={{ color: '#fca5a5', padding: '4px 8px', fontSize: '11px', background: 'rgba(225, 29, 72, 0.15)', border: '1px solid rgba(225, 29, 72, 0.25)' }}
                  >
                    Убить
                  </button>
                </div>
              </div>

              <div
                style={{
                  background: '#121212',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '8px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#ffffff', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                  Голод и сытость
                </span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => send(`/effect give ${player.name} hunger 3 5`, `-Голод игроку ${player.name}`)}
                    style={{ color: '#d4d4d8', padding: '4px 8px', fontSize: '11px' }}
                  >
                    -2 Голод
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => send(`/effect give ${player.name} hunger 8 10`, `Сильный голод игроку ${player.name}`)}
                    style={{ color: '#d4d4d8', padding: '4px 8px', fontSize: '11px' }}
                  >
                    -6 Голод
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => send(`/effect give ${player.name} saturation 1 1`, `+Сытость игроку ${player.name}`)}
                    style={{ color: '#d4d4d8', padding: '4px 8px', fontSize: '11px' }}
                  >
                    +2 Сытость
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => send(`/effect give ${player.name} saturation 1 20`, `Сытость заполнена`)}
                    style={{ color: '#ffffff', padding: '4px 8px', fontSize: '11px' }}
                  >
                    Насытить (20)
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div
              style={{
                background: '#121212',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '8px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                Телепортация игрока
              </span>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#71717a' }}>X:</span>
                  <input
                    type="number"
                    className="form-input"
                    style={{ width: '75px', padding: '5px 8px', fontSize: '12px', background: '#181818', borderColor: 'rgba(255, 255, 255, 0.08)' }}
                    value={tpCoords.x}
                    onChange={(e) => setTpCoords({ ...tpCoords, x: Number(e.target.value) })}
                  />
                </div>

                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#71717a' }}>Y:</span>
                  <input
                    type="number"
                    className="form-input"
                    style={{ width: '75px', padding: '5px 8px', fontSize: '12px', background: '#181818', borderColor: 'rgba(255, 255, 255, 0.08)' }}
                    value={tpCoords.y}
                    onChange={(e) => setTpCoords({ ...tpCoords, y: Number(e.target.value) })}
                  />
                </div>

                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#71717a' }}>Z:</span>
                  <input
                    type="number"
                    className="form-input"
                    style={{ width: '75px', padding: '5px 8px', fontSize: '12px', background: '#181818', borderColor: 'rgba(255, 255, 255, 0.08)' }}
                    value={tpCoords.z}
                    onChange={(e) => setTpCoords({ ...tpCoords, z: Number(e.target.value) })}
                  />
                </div>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => send(`/tp ${player.name} ${tpCoords.x} ${tpCoords.y} ${tpCoords.z}`, `Игрок ${player.name} телепортирован на ${tpCoords.x} ${tpCoords.y} ${tpCoords.z}`)}
                  style={{ background: '#222222', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.12)', padding: '5px 10px', fontSize: '12px' }}
                >
                  Телепортировать
                </button>
              </div>

              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => send(`/tp ${player.name} 0 100 0`, `Игрок ${player.name} телепортирован на спавн мира`)}
                  style={{ color: '#a1a1aa', padding: '4px 8px', fontSize: '11px' }}
                >
                  Спавн мира (0 100 0)
                </button>
                {player.lastDeath && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => send(`/tp ${player.name} ${player.lastDeath!.x} ${player.lastDeath!.y} ${player.lastDeath!.z}`, `Игрок телепортирован на место смерти`)}
                    style={{ color: '#a1a1aa', padding: '4px 8px', fontSize: '11px' }}
                  >
                    Место смерти
                  </button>
                )}
                {player.spawnPoint && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => send(`/tp ${player.name} ${player.spawnPoint!.x} ${player.spawnPoint!.y} ${player.spawnPoint!.z}`, `Игрок телепортирован на свой спавн`)}
                    style={{ color: '#a1a1aa', padding: '4px 8px', fontSize: '11px' }}
                  >
                    Личный спавн
                  </button>
                )}
              </div>
            </div>

            <div
              style={{
                background: '#121212',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '8px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                Точка возрождения (Spawnpoint)
              </span>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#71717a' }}>X:</span>
                  <input
                    type="number"
                    className="form-input"
                    style={{ width: '75px', padding: '5px 8px', fontSize: '12px', background: '#181818', borderColor: 'rgba(255, 255, 255, 0.08)' }}
                    value={spawnCoords.x}
                    onChange={(e) => setSpawnCoords({ ...spawnCoords, x: Number(e.target.value) })}
                  />
                </div>

                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#71717a' }}>Y:</span>
                  <input
                    type="number"
                    className="form-input"
                    style={{ width: '75px', padding: '5px 8px', fontSize: '12px', background: '#181818', borderColor: 'rgba(255, 255, 255, 0.08)' }}
                    value={spawnCoords.y}
                    onChange={(e) => setSpawnCoords({ ...spawnCoords, y: Number(e.target.value) })}
                  />
                </div>

                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#71717a' }}>Z:</span>
                  <input
                    type="number"
                    className="form-input"
                    style={{ width: '75px', padding: '5px 8px', fontSize: '12px', background: '#181818', borderColor: 'rgba(255, 255, 255, 0.08)' }}
                    value={spawnCoords.z}
                    onChange={(e) => setSpawnCoords({ ...spawnCoords, z: Number(e.target.value) })}
                  />
                </div>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => send(`/spawnpoint ${player.name} ${spawnCoords.x} ${spawnCoords.y} ${spawnCoords.z}`, `Точка возрождения для ${player.name} установлена`)}
                  style={{ background: '#222222', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.12)', padding: '5px 10px', fontSize: '12px' }}
                >
                  Установить спавн
                </button>
              </div>

              <div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    const cx = Math.round(player.coords[0]);
                    const cy = Math.round(player.coords[1]);
                    const cz = Math.round(player.coords[2]);
                    setSpawnCoords({ x: cx, y: cy, z: cz });
                    send(`/spawnpoint ${player.name} ${cx} ${cy} ${cz}`, `Спавн установлен на текущие координаты`);
                  }}
                  style={{ color: '#a1a1aa', padding: '4px 8px', fontSize: '11px' }}
                >
                  Спавн на текущее место
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ padding: '14px 20px', borderColor: 'rgba(255, 255, 255, 0.08)' }}>
          <button
            className="btn btn-secondary"
            onClick={onClose}
            style={{ color: '#d4d4d8', padding: '6px 16px', fontSize: '13px' }}
          >
            Закрыть
          </button>
        </div>
      </div>

      {hoveredItem && (
        <div
          className="mc-tooltip"
          style={{
            position: 'fixed',
            left: `${tooltipPos.x + 14}px`,
            top: `${tooltipPos.y + 14}px`,
            zIndex: 9999,
            pointerEvents: 'none',
            background: 'rgba(18, 18, 18, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            padding: '6px 10px',
            borderRadius: '4px',
            boxShadow: '0 6px 18px rgba(0, 0, 0, 0.8)',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px'
          }}
        >
          <span style={{ color: '#ffffff', fontWeight: 600, fontSize: '12px' }}>
            {formatItemTitle(hoveredItem.id)}
          </span>
          <span style={{ color: '#71717a', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
            minecraft:{hoveredItem.id.replace('minecraft:', '')}
          </span>
          {hoveredItem.count > 1 && (
            <span style={{ color: '#a1a1aa', fontSize: '11px', marginTop: '2px' }}>
              Количество: {hoveredItem.count}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
