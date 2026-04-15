/**
 * 全局通知组件 - 战术终端风格
 *
 * 固定位置显示，不影响 UI 布局
 * 使用 lucide-react 图标库
 */

import { AlertTriangle, CheckCircle, Info, X, XCircle } from "lucide-react";
import React, { useEffect, useState, useCallback } from "react";

export type NotificationType = "success" | "error" | "info" | "warning";

export interface Notification {
	id: string;
	type: NotificationType;
	message: string;
	duration?: number;
}

const titles: Record<NotificationType, string> = {
	success: "成功",
	error: "错误",
	info: "信息",
	warning: "警告",
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

	const getIcon = () => {
		const iconProps = { size: 18, strokeWidth: 2 };
		switch (notification.type) {
			case "success":
				return <CheckCircle {...iconProps} />;
			case "error":
				return <XCircle {...iconProps} />;
			case "info":
				return <Info {...iconProps} />;
			case "warning":
				return <AlertTriangle {...iconProps} />;
		}
	};

	return (
		<div
			className={`notification-tactical notification-tactical--${notification.type} ${isExiting ? "exiting" : ""}`}
		>
			<div className="notification-tactical-header">
				<div className="notification-tactical-icon-wrapper">
					{getIcon()}
					<span className="notification-tactical-title">{titles[notification.type]}</span>
				</div>
				<button className="notification-tactical-close" onClick={handleClose}>
					<X size={16} strokeWidth={2} />
				</button>
			</div>
			<div className="notification-tactical-message">{notification.message}</div>
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

		window.addEventListener("stfcs-notification" as any, handleNotification as any);

		return () => {
			window.removeEventListener("stfcs-notification" as any, handleNotification as any);
		};
	}, []);

	const handleClose = useCallback((id: string) => {
		setNotifications((prev) => prev.filter((n) => n.id !== id));
	}, []);

	return (
		<div className="notification-tactical-container">
			{notifications.map((notification) => (
				<NotificationItem key={notification.id} notification={notification} onClose={handleClose} />
			))}
		</div>
	);
};

/**
 * 通知工具函数
 */
export const notify = {
	success: (message: string, duration?: number) => {
		const notification: Notification = {
			id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
			type: "success",
			message,
			duration,
		};
		window.dispatchEvent(new CustomEvent("stfcs-notification", { detail: notification }));
	},

	error: (message: string, duration?: number) => {
		const notification: Notification = {
			id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
			type: "error",
			message,
			duration: duration || 10000,
		};
		window.dispatchEvent(new CustomEvent("stfcs-notification", { detail: notification }));
	},

	info: (message: string, duration?: number) => {
		const notification: Notification = {
			id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
			type: "info",
			message,
			duration,
		};
		window.dispatchEvent(new CustomEvent("stfcs-notification", { detail: notification }));
	},

	warning: (message: string, duration?: number) => {
		const notification: Notification = {
			id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
			type: "warning",
			message,
			duration,
		};
		window.dispatchEvent(new CustomEvent("stfcs-notification", { detail: notification }));
	},
};

export default NotificationContainer;
