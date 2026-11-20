/**
 * ConnectionBanner - 连接状态提示
 *
 * 首次连上之前保持静默；断线或重连失败时固定在顶部，说明原因并给出动作。
 */

import React, { useRef } from "react";
import { RadioTower } from "lucide-react";
import { useUIStore } from "@/state/stores/uiStore";
import "./connection-banner.css";

export const ConnectionBanner: React.FC = () => {
	const connected = useUIStore((state) => state.isConnected);
	const error = useUIStore((state) => state.connectionError);
	const everConnected = useRef(false);
	if (connected) everConnected.current = true;

	if (connected || (!everConnected.current && !error)) {
		return null;
	}

	return (
		<div className="connection-banner" role="status" aria-live="polite">
			<RadioTower size={14} className="connection-banner__icon" />
			<span className="connection-banner__title">连接中断</span>
			<span className="connection-banner__detail">{error || "正在自动重连"}</span>
			<button type="button" className="connection-banner__action" onClick={() => window.location.reload()}>
				重新载入
			</button>
		</div>
	);
};

export default ConnectionBanner;
