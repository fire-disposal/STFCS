function getDefaultWsUrl(): string {
	const envWsUrl = import.meta.env.VITE_WS_URL?.trim();
	if (envWsUrl) {
		return envWsUrl;
	}

	if (typeof window !== "undefined") {
		const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
		const { hostname, host } = window.location;
		const isLocalHost =
			hostname === "localhost" ||
			hostname === "127.0.0.1" ||
			hostname === "::1";

		if (isLocalHost) {
			return `${wsProtocol}://${hostname}:2567`;
		}

		return `${wsProtocol}://${host}`;
	}

	return "ws://localhost:2567";
}

export const DEFAULT_WS_URL = getDefaultWsUrl();

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
