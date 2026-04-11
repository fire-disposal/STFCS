/**
 * 全局通知组件 - 战术终端风格
 *
 * 固定位置显示，不影响 UI 布局
 * 使用 lucide-react 图标库
 */

import React, { useEffect, useState, useCallback } from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  duration?: number;
}

const styles = {
  container: {
    position: 'fixed' as const,
    top: '24px',
    right: '24px',
    zIndex: 1000000,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    pointerEvents: 'none' as const,
  },
  notification: {
    padding: '14px 20px',
    minWidth: '280px',
    maxWidth: '400px',
    border: '2px solid',
    backgroundColor: 'rgba(13, 40, 71, 0.95)',
    backdropFilter: 'blur(10px)',
    boxShadow: '0 0 30px rgba(0, 0, 0, 0.5)',
    pointerEvents: 'auto' as const,
    animation: 'slideIn 0.3s ease-out',
  },
  success: {
    borderColor: '#4ade80',
    color: '#86efac',
    boxShadow: '0 0 20px rgba(74, 222, 128, 0.3)',
  },
  error: {
    borderColor: '#f87171',
    color: '#fca5a5',
    boxShadow: '0 0 20px rgba(248, 113, 113, 0.3)',
  },
  info: {
    borderColor: '#4a9eff',
    color: '#8fbfd4',
    boxShadow: '0 0 20px rgba(74, 158, 255, 0.3)',
  },
  warning: {
    borderColor: '#fbbf24',
    color: '#fcd34d',
    boxShadow: '0 0 20px rgba(251, 191, 36, 0.3)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '8px',
  },
  iconWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  title: {
    fontSize: '13px',
    fontWeight: '700',
    letterSpacing: '1px',
    textTransform: 'uppercase' as const,
  },
  close: {
    background: 'transparent',
    border: 'none',
    color: 'inherit',
    cursor: 'pointer',
    padding: '0',
    width: '20px',
    height: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.7,
    transition: 'opacity 0.2s',
  },
  message: {
    fontSize: '13px',
    lineHeight: '1.5',
  },
};

const titles: Record<NotificationType, string> = {
  success: '成功',
  error: '错误',
  info: '信息',
  warning: '警告',
};

interface NotificationItemProps {
  notification: Notification;
  onClose: (id: string) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onClose }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (notification.duration !== 0) {
      const timer = setTimeout(() => {
        setIsExiting(true);
        setTimeout(() => onClose(notification.id), 300);
      }, notification.duration || 5000);

      return () => clearTimeout(timer);
    }
  }, [notification.id, notification.duration, onClose]);

  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => onClose(notification.id), 300);
  }, [notification.id, onClose]);

  const typeStyles = styles[notification.type];

  const getIcon = () => {
    const iconProps = { size: 18, strokeWidth: 2 };
    switch (notification.type) {
      case 'success':
        return <CheckCircle {...iconProps} />;
      case 'error':
        return <XCircle {...iconProps} />;
      case 'info':
        return <Info {...iconProps} />;
      case 'warning':
        return <AlertTriangle {...iconProps} />;
    }
  };

  return (
    <div
      style={{
        ...styles.notification,
        ...typeStyles,
        opacity: isExiting ? 0 : 1,
        transform: isExiting ? 'translateX(100%)' : 'translateX(0)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
      }}
    >
      <div style={styles.header}>
        <div style={styles.iconWrapper}>
          {getIcon()}
          <span style={styles.title}>{titles[notification.type]}</span>
        </div>
        <button
          style={styles.close}
          onClick={handleClose}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>
      <div style={styles.message}>{notification.message}</div>
    </div>
  );
};

/**
 * 通知容器组件
 */
export const NotificationContainer: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // 监听全局通知事件
  useEffect(() => {
    const handleNotification = (event: CustomEvent<Notification>) => {
      setNotifications((prev) => [...prev, event.detail]);
    };

    window.addEventListener('stfcs-notification' as any, handleNotification as any);

    return () => {
      window.removeEventListener('stfcs-notification' as any, handleNotification as any);
    };
  }, []);

  const handleClose = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return (
    <>
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
      <div style={styles.container}>
        {notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onClose={handleClose}
          />
        ))}
      </div>
    </>
  );
};

/**
 * 通知工具函数
 */
export const notify = {
  success: (message: string, duration?: number) => {
    const notification: Notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'success',
      message,
      duration,
    };
    window.dispatchEvent(new CustomEvent('stfcs-notification', { detail: notification }));
  },

  error: (message: string, duration?: number) => {
    const notification: Notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'error',
      message,
      duration: duration || 10000,
    };
    window.dispatchEvent(new CustomEvent('stfcs-notification', { detail: notification }));
  },

  info: (message: string, duration?: number) => {
    const notification: Notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'info',
      message,
      duration,
    };
    window.dispatchEvent(new CustomEvent('stfcs-notification', { detail: notification }));
  },

  warning: (message: string, duration?: number) => {
    const notification: Notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'warning',
      message,
      duration,
    };
    window.dispatchEvent(new CustomEvent('stfcs-notification', { detail: notification }));
  },
};

export default NotificationContainer;
