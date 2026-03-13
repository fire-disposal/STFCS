import WebSocket, { WebSocketServer } from 'ws';
import type { WSMessage } from '@vt/shared/ws';
import type { IWSServer } from '@vt/shared/ws';
import { config } from '../../config';

export interface WSServerOptions {
  port: number;
  onMessage?: (clientId: string, message: WSMessage) => void;
  onConnect?: (clientId: string) => void;
  onDisconnect?: (clientId: string) => void;
}

export class WSServer implements IWSServer {
  private _wss: WebSocketServer;
  private _clients: Map<string, WebSocket>;
  private _clientIdCounter: number;
  private _onMessage?: (clientId: string, message: WSMessage) => void;
  private _onConnect?: (clientId: string) => void;
  private _onDisconnect?: (clientId: string) => void;

  constructor(options: WSServerOptions) {
    this._clients = new Map();
    this._clientIdCounter = 0;
    this._onMessage = options.onMessage;
    this._onConnect = options.onConnect;
    this._onDisconnect = options.onDisconnect;

    this._wss = new WebSocketServer({ port: options.port });

    this._wss.on('connection', (ws: WebSocket) => {
      const clientId = `client_${++this._clientIdCounter}`;
      this._clients.set(clientId, ws);

      if (this._onConnect) {
        this._onConnect(clientId);
      }

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString()) as WSMessage;
          if (this._onMessage) {
            this._onMessage(clientId, message);
          }
        } catch (error) {
          console.error('Failed to parse WS message:', error);
        }
      });

      ws.on('close', () => {
        this._clients.delete(clientId);
        if (this._onDisconnect) {
          this._onDisconnect(clientId);
        }
      });

      ws.on('error', (error) => {
        console.error(`WS error for client ${clientId}:`, error);
      });
    });

    this._wss.on('error', (error) => {
      console.error('WS server error:', error);
    });
  }

  broadcast(message: WSMessage, excludeClientId?: string): void {
    const data = JSON.stringify(message);
    for (const [clientId, ws] of this._clients.entries()) {
      if (clientId !== excludeClientId && ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }

  sendTo(clientId: string, message: WSMessage): void {
    const ws = this._clients.get(clientId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  getConnectedClients(): Set<string> {
    return new Set(this._clients.keys());
  }

  close(): void {
    for (const ws of this._clients.values()) {
      ws.close();
    }
    this._clients.clear();
    this._wss.close();
  }

  get port(): number {
    return config.wsPort;
  }
}

export default WSServer;
