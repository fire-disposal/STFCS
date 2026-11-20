function getDefaultWsUrl(): string {
	const envWsUrl = import.meta.env.VITE_WS_URL?.trim();
	if (envWsUrl) {
		return envWsUrl;
	}

	if (typeof window !== "undefined") {
		const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
		// 开发服务器只代理 /api，Socket 直连 3001；生产由同一进程托管，走当前源
		if (import.meta.env.DEV) {
			return `${wsProtocol}://${window.location.hostname}:3001`;
		}

		return `${wsProtocol}://${window.location.host}`;
	}

	return "ws://localhost:3001";
}

export const DEFAULT_WS_URL = getDefaultWsUrl();

/** 部署前缀，始终带尾斜杠："/" 或 "/stfcs/" */
const rawBase = import.meta.env.BASE_URL || "/";
export const BASE_PATH = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;
/** Socket.IO 端点路径，与服务端 BASE_PATH 对应 */
export const SOCKET_PATH = `${BASE_PATH}socket.io`;
/** 路由 basename："/" 或 "/stfcs" */
export const ROUTER_BASENAME = BASE_PATH.replace(/\/$/, "") || "/";

export const CLIENT_CONFIG = {
	ws: {
		reconnectAttempts: 5,
		reconnectDelay: 1000,
		pingInterval: 30000,
		requestTimeout: 10000,
	},
	player: {
		maxNameLength: 32,
	},
	ui: {
		defaultServerUrl: DEFAULT_WS_URL,
	},
} as const;

export default CLIENT_CONFIG;
