export { DEFAULT_WS_URL } from "@vt/shared/constants";

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
		defaultServerUrl: "ws://localhost:3001",
	},
} as const;

export default CLIENT_CONFIG;
