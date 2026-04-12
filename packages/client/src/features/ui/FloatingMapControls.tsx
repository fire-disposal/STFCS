import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { ShipState } from '@vt/contracts';

import { useUIStore } from '@/store/uiStore';
import { formatPosition } from '@/utils/spaceNav';
import { calculateViewRotationForAlignment, normalizeRotation, normalizeAngle } from '@/utils/angleSystem';
import { useSelectionStore } from '@/store/selectionStore';

const STORAGE_KEY = 'stfcs_floating_map_controls_open';

const styles = {
  wrapper: {
    position: 'absolute' as const,
    top: '16px',
    right: '16px',
    zIndex: 20,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-end',
    pointerEvents: 'none' as const,
  },
  toggleButton: {
    pointerEvents: 'auto' as const,
    padding: '8px 12px',
    borderRadius: '999px',
    border: '1px solid rgba(74, 158, 255, 0.5)',
    backgroundColor: 'rgba(6, 16, 26, 0.88)',
    color: '#cfe8ff',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
    backdropFilter: 'blur(10px)',
  },
  panel: {
    pointerEvents: 'auto' as const,
    marginTop: '10px',
    width: '320px',
    maxWidth: 'calc(100vw - 32px)',
    borderRadius: '14px',
    border: '1px solid rgba(74, 158, 255, 0.35)',
    backgroundColor: 'rgba(6, 16, 26, 0.92)',
    boxShadow: '0 18px 40px rgba(0, 0, 0, 0.35)',
    backdropFilter: 'blur(12px)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 14px',
    borderBottom: '1px solid rgba(74, 158, 255, 0.18)',
  },
  title: {
    fontSize: '13px',
    fontWeight: 800,
    color: '#e7f2ff',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  headerActions: {
    display: 'flex',
    gap: '8px',
  },
  tinyButton: {
    padding: '5px 8px',
    borderRadius: '8px',
    border: '1px solid rgba(74, 158, 255, 0.25)',
    backgroundColor: 'rgba(26, 45, 66, 0.9)',
    color: '#cfe8ff',
    fontSize: '11px',
    cursor: 'pointer',
  },
  body: {
    padding: '14px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  section: {
    padding: '12px',
    borderRadius: '12px',
    border: '1px solid rgba(74, 158, 255, 0.14)',
    backgroundColor: 'rgba(13, 40, 71, 0.35)',
  },
  sectionTitle: {
    fontSize: '11px',
    fontWeight: 800,
    color: '#8fbfd4',
    marginBottom: '10px',
    letterSpacing: '0.04em',
  },
  row: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
  },
  navGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
  },
  label: {
    fontSize: '10px',
    color: '#8ba4c7',
    marginBottom: '4px',
  },
  input: {
    width: '100%',
    padding: '8px 10px',
    borderRadius: '8px',
    border: '1px solid rgba(74, 158, 255, 0.25)',
    backgroundColor: '#1a2d42',
    color: '#e7f2ff',
    fontSize: '12px',
    outline: 'none',
  },
  primaryButton: {
    padding: '8px 10px',
    borderRadius: '8px',
    border: '1px solid #4a9eff',
    backgroundColor: 'rgba(74, 158, 255, 0.14)',
    color: '#e7f2ff',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  secondaryButton: {
    padding: '8px 10px',
    borderRadius: '8px',
    border: '1px solid rgba(74, 158, 255, 0.25)',
    backgroundColor: 'rgba(26, 45, 66, 0.85)',
    color: '#cfe8ff',
    fontSize: '12px',
    cursor: 'pointer',
  },
  ghostButton: {
    padding: '6px 8px',
    borderRadius: '8px',
    border: '1px solid rgba(74, 158, 255, 0.22)',
    backgroundColor: 'rgba(26, 45, 66, 0.65)',
    color: '#cfe8ff',
    fontSize: '11px',
    cursor: 'pointer',
  },
  hint: {
    fontSize: '10px',
    color: '#6f8ea8',
    lineHeight: 1.5,
  },
  value: {
    fontSize: '11px',
    color: '#d4e9ff',
  },
  field: {
    padding: '10px',
    borderRadius: '10px',
    border: '1px solid rgba(74, 158, 255, 0.16)',
    backgroundColor: 'rgba(10, 30, 50, 0.45)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  fieldTitle: {
    fontSize: '10px',
    color: '#8fbfd4',
    fontWeight: 800,
    letterSpacing: '0.04em',
  },
  fieldValue: {
    fontSize: '12px',
    color: '#eef6ff',
    fontWeight: 700,
  },
  fieldRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  },
  copyButton: {
    padding: '6px 9px',
    borderRadius: '8px',
    border: '1px solid rgba(74, 158, 255, 0.28)',
    backgroundColor: 'rgba(26, 45, 66, 0.88)',
    color: '#cfe8ff',
    fontSize: '11px',
    cursor: 'pointer',
    flexShrink: 0,
  },
};

interface FloatingMapControlsProps {
  selectedShip?: ShipState | null;
}

export const FloatingMapControls: React.FC<FloatingMapControlsProps> = ({ selectedShip }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [targetX, setTargetX] = useState('0');
  const [targetY, setTargetY] = useState('0');

  const {
    cameraPosition,
    zoom,
    viewRotation,
    coordinatePrecision,
    setCameraPosition,
    setZoom,
    setViewRotation,
    resetViewRotation,
  } = useUIStore();

  const { mouseWorldX, mouseWorldY } = useSelectionStore();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      setIsOpen(stored === 'true');
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, String(isOpen));
  }, [isOpen]);

  useEffect(() => {
    setTargetX(String(Math.round(mouseWorldX)));
    setTargetY(String(Math.round(mouseWorldY)));
  }, [mouseWorldX, mouseWorldY]);

  useEffect(() => {
    if (!copyFeedback) return;

    const timer = window.setTimeout(() => setCopyFeedback(null), 1200);
    return () => window.clearTimeout(timer);
  }, [copyFeedback]);

  const cameraLabel = useMemo(() => {
    return formatPosition(cameraPosition.x, cameraPosition.y, coordinatePrecision);
  }, [cameraPosition.x, cameraPosition.y, coordinatePrecision]);

  const pointerLabel = useMemo(() => {
    return formatPosition(mouseWorldX, mouseWorldY, coordinatePrecision);
  }, [mouseWorldX, mouseWorldY, coordinatePrecision]);

  const pointerAngle = useMemo(() => {
    return normalizeAngle(viewRotation);
  }, [viewRotation]);

  const moveCamera = useCallback((deltaX: number, deltaY: number) => {
    setCameraPosition(cameraPosition.x + deltaX, cameraPosition.y + deltaY);
  }, [cameraPosition.x, cameraPosition.y, setCameraPosition]);

  const applyTargetNavigation = useCallback(() => {
    const x = Number(targetX);
    const y = Number(targetY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return;
    }

    setCameraPosition(x, y);
  }, [targetX, targetY, setCameraPosition]);

  const alignToShip = useCallback(() => {
    if (!selectedShip) return;
    setViewRotation(calculateViewRotationForAlignment(selectedShip.transform.heading));
  }, [selectedShip, setViewRotation]);

  const rotateBy = useCallback((delta: number) => {
    setViewRotation(normalizeRotation(viewRotation + delta));
  }, [setViewRotation, viewRotation]);

  const copyText = useCallback(async (text: string, label: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      setCopyFeedback(`${label} 已复制`);
    } catch {
      setCopyFeedback('复制失败');
    }
  }, []);

  const copyPointerPosition = useCallback(() => {
    copyText(`X=${Math.round(mouseWorldX)}, Y=${Math.round(mouseWorldY)}, Rotation=${Math.round(viewRotation)}°`, '定位信息');
  }, [copyText, mouseWorldX, mouseWorldY, viewRotation]);

  const copyPointerAngle = useCallback(() => {
    copyText(`${Math.round(viewRotation)}°`, '角度');
  }, [copyText, viewRotation]);

  return (
    <div style={styles.wrapper}>
      <button
        style={styles.toggleButton}
        onClick={() => setIsOpen((open) => !open)}
      >
        {isOpen ? '收起地图控制' : '展开地图控制'}
      </button>

      {isOpen && (
        <div style={styles.panel}>
          <div style={styles.header}>
            <div style={styles.title}>🧭 地图导航 / 微调</div>
            <div style={styles.headerActions}>
              <button style={styles.tinyButton} onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}>-</button>
              <button style={styles.tinyButton} onClick={() => setZoom(Math.min(3, zoom + 0.1))}>+</button>
            </div>
          </div>

          <div style={styles.body}>
            <div style={styles.section}>
              <div style={styles.sectionTitle}>视图旋转</div>
              <div style={styles.row}>
                <span style={styles.value}>当前 {Math.round(viewRotation)}°</span>
                <button style={styles.ghostButton} onClick={() => rotateBy(-15)}>-15°</button>
                <button style={styles.ghostButton} onClick={() => rotateBy(-5)}>-5°</button>
                <button style={styles.ghostButton} onClick={() => rotateBy(5)}>+5°</button>
                <button style={styles.ghostButton} onClick={() => rotateBy(15)}>+15°</button>
                <button style={styles.secondaryButton} onClick={resetViewRotation}>重置</button>
              </div>
              <div style={{ ...styles.row, marginTop: '8px' }}>
                <button style={styles.secondaryButton} onClick={alignToShip} disabled={!selectedShip}>
                  对齐舰船朝向
                </button>
                <span style={styles.hint}>
                  这是备选微调入口，主视图保持稳定，旋转仅用于战术校正。
                </span>
              </div>
            </div>

            <div style={styles.section}>
              <div style={styles.sectionTitle}>定位坐标</div>
              <div style={styles.field}>
                <div style={styles.fieldRow}>
                  <div>
                    <div style={styles.fieldTitle}>当前指针世界坐标</div>
                    <div style={styles.fieldValue}>{pointerLabel}</div>
                  </div>
                  <button style={styles.copyButton} onClick={copyPointerPosition}>复制</button>
                </div>
                <div style={styles.fieldRow}>
                  <div>
                    <div style={styles.fieldTitle}>继承视图旋转角度</div>
                    <div style={styles.fieldValue}>{Math.round(pointerAngle)}°</div>
                  </div>
                  <button style={styles.copyButton} onClick={copyPointerAngle}>复制角度</button>
                </div>
                <div style={styles.row}>
                  <button style={styles.secondaryButton} onClick={copyPointerPosition}>复制定位</button>
                  <span style={styles.hint}>实时跟随鼠标更新，适合快速标记和转发坐标。</span>
                </div>
              </div>
            </div>

            <div style={styles.section}>
              <div style={styles.sectionTitle}>地图平移</div>
              <div style={styles.row}>
                <button style={styles.primaryButton} onClick={() => moveCamera(-250, 0)}>←</button>
                <button style={styles.primaryButton} onClick={() => moveCamera(250, 0)}>→</button>
                <button style={styles.primaryButton} onClick={() => moveCamera(0, -250)}>↑</button>
                <button style={styles.primaryButton} onClick={() => moveCamera(0, 250)}>↓</button>
                <button style={styles.secondaryButton} onClick={() => setCameraPosition(0, 0)}>回中</button>
              </div>
              <div style={{ ...styles.hint, marginTop: '8px' }}>
                支持直接拖拽地图；这里是精调补充，不影响主交互。
              </div>
            </div>

            <div style={styles.section}>
              <div style={styles.sectionTitle}>星区位置导航</div>
              <div style={styles.navGrid}>
                <div>
                  <div style={styles.label}>X 坐标</div>
                  <input style={styles.input} value={targetX} onChange={(e) => setTargetX(e.target.value)} inputMode="decimal" />
                </div>
                <div>
                  <div style={styles.label}>Y 坐标</div>
                  <input style={styles.input} value={targetY} onChange={(e) => setTargetY(e.target.value)} inputMode="decimal" />
                </div>
              </div>
              <div style={{ ...styles.row, marginTop: '8px' }}>
                <button style={styles.primaryButton} onClick={applyTargetNavigation}>居中到坐标</button>
                <button style={styles.secondaryButton} onClick={() => {
                  setTargetX(String(Math.round(cameraPosition.x)));
                  setTargetY(String(Math.round(cameraPosition.y)));
                }}>
                  填入当前视图
                </button>
              </div>
              <div style={{ ...styles.hint, marginTop: '8px' }}>
                当前中心：{cameraLabel}
              </div>
            </div>

            {selectedShip && (
              <div style={styles.section}>
                <div style={styles.sectionTitle}>选中舰船</div>
                <div style={styles.value}>
                  {selectedShip.id.slice(-6)} · 朝向 {Math.round(selectedShip.transform.heading)}°
                </div>
                <div style={{ ...styles.hint, marginTop: '6px' }}>
                  用于快速对齐视角，作为主导航的备选工具。
                </div>
              </div>
            )}

            {copyFeedback && (
              <div style={{ ...styles.hint, color: '#4ade80', textAlign: 'center' as const }}>
                {copyFeedback}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FloatingMapControls;
