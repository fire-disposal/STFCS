/**
 * 简化测试服务器
 * 测试基本功能完整性
 */

import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { MemoryStorage } from './storage/MemoryStorage.js';
import { PlayerProfileService } from './services/PlayerProfileService.js';

// 创建HTTP服务器
const server = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    status: 'ok', 
    service: 'STFCS Backend Test',
    timestamp: new Date().toISOString()
  }));
});

// 创建WebSocket服务器
const wss = new WebSocketServer({ server });

// 初始化服务
const storage = new MemoryStorage();
const profileService = new PlayerProfileService(storage);

console.log('初始化测试服务器...');

// 测试玩家档案服务
async function testProfileService() {
  console.log('测试玩家档案服务...');
  
  try {
    // 测试创建玩家档案
    const profile = await profileService.getOrCreateProfile('test_user_1');
    console.log('✓ 玩家档案创建成功:', profile.$id);
    
    // 测试列出舰船
    const ships = await profileService.listPlayerShips('test_user_1');
    console.log(`✓ 列出舰船成功: ${ships.length} 艘舰船`);
    
    // 测试创建存档
    const gameState = {
      turn: 1,
      phase: 'DEPLOYMENT',
      players: new Map([['player1', { name: '测试玩家' }]])
    };
    
    const saveRequest = {
      name: '测试存档',
      description: '测试存档描述',
      tags: ['test'],
      gameState
    };
    
    const save = await profileService.createSave('test_user_1', saveRequest, gameState);
    console.log('✓ 存档创建成功:', save.$id);
    
    // 测试列出存档
    const saves = await profileService.listSaves('test_user_1');
    console.log(`✓ 列出存档成功: ${saves.length} 个存档`);
    
    // 测试存档统计
    const stats = await profileService.getSaveStats('test_user_1');
    console.log('✓ 存档统计:', stats);
    
    return true;
    } catch (error) {
      console.error('✗ 玩家档案服务测试失败:', error instanceof Error ? error.message : String(error));
      return false;
  }
}

// WebSocket连接处理
wss.on('connection', (ws) => {
  console.log('新的WebSocket连接');
  
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('收到消息:', message.type);
      
      // 简单响应
      const response = {
        type: 'TEST_RESPONSE',
        payload: {
          received: message.type,
          timestamp: Date.now(),
          status: 'ok'
        }
      };
      
      ws.send(JSON.stringify(response));
    } catch (error) {
      console.error('消息处理错误:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('WebSocket连接关闭');
  });
});

// 启动服务器
const PORT = (process.env as any).PORT || 3000;

async function startServer() {
  // 测试服务
  const profileTestPassed = await testProfileService();
  
  if (!profileTestPassed) {
    console.error('玩家档案服务测试失败，服务器可能无法正常工作');
  }
  
  server.listen(PORT, () => {
    console.log(`\n=== STFCS 后端测试服务器已启动 ===`);
    console.log(`HTTP服务: http://localhost:${PORT}`);
    console.log(`WebSocket服务: ws://localhost:${PORT}`);
    console.log(`玩家档案服务: ${profileTestPassed ? '✓ 正常' : '✗ 异常'}`);
    console.log(`==================================\n`);
  });
}

startServer().catch(console.error);