export interface ServerConfig {
  httpPort: number;
  wsPort: number;
  corsOrigins: string[];
  logLevel: string;
  maxPlayersPerRoom: number;
}

const getEnvNumber = (key: string, defaultValue: number): number => {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    return defaultValue;
  }
  return parsed;
};

const getEnvString = (key: string, defaultValue: string): string => {
  return process.env[key] ?? defaultValue;
};

const getEnvArray = (key: string, defaultValue: string[]): string[] => {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  return value.split(',').map((s) => s.trim()).filter(Boolean);
};

export const config: ServerConfig = {
  httpPort: getEnvNumber('HTTP_PORT', 3000),
  wsPort: getEnvNumber('WS_PORT', 3001),
  corsOrigins: getEnvArray('CORS_ORIGINS', ['http://localhost:5173', 'http://localhost:3000']),
  logLevel: getEnvString('LOG_LEVEL', 'info'),
  maxPlayersPerRoom: getEnvNumber('MAX_PLAYERS_PER_ROOM', 8),
};

export default config;
