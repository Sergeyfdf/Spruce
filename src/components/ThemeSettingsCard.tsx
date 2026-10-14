import React from 'react';
import { Palette, Check } from 'lucide-react';
import brownLeaves from '../assets/spruce_leaves_brown.png';
import greenLeaves from '../assets/spruce_leaves_green.png';
import snowyLeaves from '../assets/spruce_leaves_snowy.png';

export type LeavesTheme = 'brown' | 'green' | 'snowy';

interface ThemeSettingsCardProps {
  currentTheme: LeavesTheme;
  onSelectTheme: (theme: LeavesTheme) => void;
}

interface ThemeOption {
  id: LeavesTheme;
  title: string;
  subtitle: string;
  preview: string;
}

export const ThemeSettingsCard: React.FC<ThemeSettingsCardProps> = ({
  currentTheme,
  onSelectTheme,
}) => {
  const options: ThemeOption[] = [
    {
      id: 'brown',
      title: 'Коричневая',
      subtitle: 'Теплый оттенок хвои пихты',
      preview: brownLeaves,
    },
    {
      id: 'green',
      title: 'Зелёная',
      subtitle: 'Классическая таёжная ель',
      preview: greenLeaves,
    },
    {
      id: 'snowy',
      title: 'Снежная',
      subtitle: 'Хвоя под зимним снегом',
      preview: snowyLeaves,
    },
  ];

  return (
    <div className="settings-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Palette size={20} color="var(--accent-spruce)" />
          <div style={{ fontSize: '16px', fontWeight: 700 }}>Оформление листвы</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <label className="form-label" style={{ margin: 0 }}>
          Выбери текстуру фона интерфейса
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          {options.map((opt) => {
            const isSelected = currentTheme === opt.id;
            return (
              <div
                key={opt.id}
                onClick={() => onSelectTheme(opt.id)}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: isSelected ? '1px solid var(--accent-spruce)' : '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  padding: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: '56px',
                    borderRadius: '6px',
                    backgroundImage: `url(${opt.preview})`,
                    backgroundRepeat: 'repeat',
                    backgroundSize: '32px 32px',
                    imageRendering: 'pixelated',
                    border: '1px solid rgba(0, 0, 0, 0.4)',
                    position: 'relative',
                  }}
                >
                  {isSelected && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '6px',
                        right: '6px',
                        background: 'var(--accent-spruce)',
                        color: '#ffffff',
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
                      }}
                    >
                      <Check size={12} strokeWidth={3} />
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: isSelected ? '#ffffff' : 'var(--text-primary)' }}>
                    {opt.title}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: '1.3' }}>
                    {opt.subtitle}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
