import React, { useEffect, useMemo, useState } from 'react';

export interface ActionCommand {
  id: string;
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
  hint?: string;
  active?: boolean;
  disabled?: boolean;
  onActivate: () => void;
}

export interface ActionCommandGroup {
  id: string;
  title: string;
  description?: string;
  actions: ActionCommand[];
}

interface ActionCommandDockProps {
  title?: string;
  subtitle?: string;
  groups: ActionCommandGroup[];
  storageKey?: string;
  defaultCollapsed?: boolean;
}

const styles = {
  container: {
    background: 'rgba(13, 40, 71, 0.72)',
    border: '2px solid rgba(74, 158, 255, 0.3)',
    borderRadius: '0',
    boxShadow: '0 0 28px rgba(74, 158, 255, 0.12)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 14px',
    borderBottom: '1px solid rgba(74, 158, 255, 0.18)',
    background: 'rgba(6, 16, 26, 0.45)',
  },
  titleWrap: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
  },
  title: {
    fontSize: '13px',
    fontWeight: 800,
    letterSpacing: '0.06em',
    color: '#e7f2ff',
  },
  subtitle: {
    fontSize: '10px',
    color: '#6f8ea8',
  },
  collapseButton: {
    padding: '6px 10px',
    borderRadius: '0',
    border: '1px solid rgba(74, 158, 255, 0.24)',
    background: 'rgba(26, 45, 66, 0.88)',
    color: '#cfe8ff',
    fontSize: '11px',
    cursor: 'pointer',
  },
  body: {
    padding: '12px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  group: {
    border: '1px solid rgba(74, 158, 255, 0.14)',
    borderRadius: '0',
    background: 'rgba(6, 16, 26, 0.35)',
    padding: '10px',
  },
  groupHeader: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: '8px',
    marginBottom: '10px',
  },
  groupTitle: {
    fontSize: '11px',
    fontWeight: 800,
    color: '#8fbfd4',
    letterSpacing: '0.04em',
  },
  groupDesc: {
    fontSize: '10px',
    color: '#6f8ea8',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '8px',
  },
  actionButton: {
    minHeight: '58px',
    borderRadius: '0',
    border: '1px solid rgba(74, 158, 255, 0.2)',
    background: 'rgba(26, 45, 66, 0.82)',
    color: '#cfe8ff',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    padding: '8px 6px',
    transition: 'all 0.18s ease',
  },
  actionButtonActive: {
    borderColor: '#4a9eff',
    background: 'rgba(74, 158, 255, 0.16)',
    boxShadow: '0 0 16px rgba(74, 158, 255, 0.18)',
  },
  actionButtonDisabled: {
    opacity: 0.38,
    cursor: 'not-allowed',
  },
  icon: {
    fontSize: '16px',
    lineHeight: 1,
  },
  label: {
    fontSize: '11px',
    fontWeight: 700,
  },
  shortcut: {
    fontSize: '9px',
    color: '#8ba4c7',
  },
};

export const ActionCommandDock: React.FC<ActionCommandDockProps> = ({
  title = '⚙️ 通用操作',
  subtitle = '地图、视图与辅助控制',
  groups,
  storageKey = 'stfcs_action_command_dock_collapsed',
  defaultCollapsed = false,
}) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const stored = window.localStorage.getItem(storageKey);
    if (stored !== null) {
      setCollapsed(stored === 'true');
    }
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(storageKey, String(collapsed));
  }, [collapsed, storageKey]);

  const renderedGroups = useMemo(() => groups.filter((group) => group.actions.length > 0), [groups]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.titleWrap}>
          <div style={styles.title}>{title}</div>
          <div style={styles.subtitle}>{subtitle}</div>
        </div>
        <button style={styles.collapseButton} onClick={() => setCollapsed((value) => !value)}>
          {collapsed ? '展开' : '收起'}
        </button>
      </div>

      {!collapsed && (
        <div style={styles.body}>
          {renderedGroups.map((group) => (
            <div key={group.id} style={styles.group}>
              <div style={styles.groupHeader}>
                <div style={styles.groupTitle}>{group.title}</div>
                {group.description && <div style={styles.groupDesc}>{group.description}</div>}
              </div>

              <div style={styles.grid}>
                {group.actions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    title={action.hint || action.label}
                    style={{
                      ...styles.actionButton,
                      ...(action.active ? styles.actionButtonActive : {}),
                      ...(action.disabled ? styles.actionButtonDisabled : {}),
                    }}
                    disabled={action.disabled}
                    onClick={action.onActivate}
                  >
                    <span style={styles.icon}>{action.icon}</span>
                    <span style={styles.label}>{action.label}</span>
                    {action.shortcut && <span style={styles.shortcut}>{action.shortcut}</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ActionCommandDock;
