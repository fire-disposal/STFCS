# 远行星号桌面推演系统 (STFCS) V2

基于权威服务器模式 (Authoritative Server) 的《远行星号》(Starsector) 风格桌面推演系统。

## 项目简介

STFCS 是一个专为《远行星号》爱好者设计的 Web 桌面推演工具 (VTT)，支持多人在线推演。系统采用 Colyseus 状态同步引擎，实现实时数据同步和回合制推演。

### 核心特性

- **权威服务器架构**: 服务端验证所有操作，确保推演公平性
- **实时状态同步**: Colyseus 自动处理状态同步和补丁广播
- **三阶段机动系统**: 严格遵循《远行星号》的机动规则
- **6象限装甲机制**: 独立计算每个象限的护甲值
- **完整辐能系统**: 软/硬辐能、过载、排散机制
- **DM控制台**: 主持人可实时调控游戏状态

## 技术栈

### 核心引擎
- **Colyseus** - 状态同步与网络层
- **PixiJS + @pixi/react** - 2D渲染引擎
- **React** - UI框架
- **Zustand** - 客户端状态管理
- **gl-matrix** - 高性能向量计算
- **sat.js** - 碰撞检测 (Separating Axis Theorem)

### 项目结构
```
stfcs-v2/
├── packages/
│   ├── shared/          # 前后端共享逻辑
│   │   ├── schema/      # Colyseus 数据模型
│   │   ├── math/        # 向量计算与碰撞函数
│   │   └── constants/   # 游戏常量与配置
│   ├── server/          # Colyseus 权威服务端
│   │   ├── rooms/       # 房间系统
│   │   └── commands/    # 指令验证与处理
│   └── client/          # React + PixiJS 前端
│       ├── components/  # UI组件与地图渲染
│       ├── network/     # 网络管理
│       └── store/       # 本地状态
```

## 快速开始

### 环境要求
- Node.js >= 22.0.0
- pnpm >= 8.0.0

### 安装依赖
```bash
pnpm install
```

### 开发模式
```bash
# 同时启动服务端和客户端
pnpm dev

# 或分别启动
pnpm dev:server  # 服务端: ws://localhost:2567
pnpm dev:client  # 客户端: http://localhost:5173
```

### 开发访问地址
- Colyseus WS: `ws://localhost:2567`
- Health: `http://localhost:2567/health`
- Monitor: `http://localhost:2567/colyseus`

如需修改客户端连接地址，可在 client 侧设置：

```bash
VITE_SERVER_URL=ws://localhost:2567
```

### 构建
```bash
pnpm build
```

## 推演规则

### 回合流程

1. **部署阶段 (DEPLOYMENT)**: 双方部署初始位置
2. **玩家回合 (PLAYER_TURN)**: 玩家控制己方舰船行动
3. **DM回合 (DM_TURN)**: 主持人控制敌方舰船行动
4. **结束阶段 (END_PHASE)**: 结算辐能、解除过载

### 机动规则

每回合移动遵循三阶段算法：

1. **平移阶段 A**: 沿当前朝向前进/后退（最大 2X），或横移（最大 X）
2. **转向阶段**: 原地旋转，最大角度 Y
3. **平移阶段 B**: 沿新朝向前进/后退或横移

### 战斗系统

#### 伤害类型
| 类型 | 对护盾 | 对装甲 |
|------|--------|--------|
| 动能 (Kinetic) | 200% | 50% |
| 高爆 (HE) | 50% | 200% |
| 破片 (Frag) | 25% | 25% |
| 能量 (Energy) | 100% | 100% |

#### 6象限装甲
- 象限 0: 前 (0-60°)
- 象限 1: 前右 (60-120°)
- 象限 2: 后右 (120-180°)
- 象限 3: 后 (180-240°)
- 象限 4: 后左 (240-300°)
- 象限 5: 前左 (300-360°)

### 辐能机制

- **软辐能 (Flux Soft)**: 每回合自动衰减
- **硬辐能 (Flux Hard)**: 护盾吸收伤害产生，需关闭护盾才能排散
- **过载 (Overload)**: 总辐能 >= 容量时触发，无法行动
- **排散 (Vent)**: 放弃本回合行动，清空所有辐能

## 客户端指令

| 指令 | 描述 |
|------|------|
| `CMD_MOVE_TOKEN` | 移动舰船到指定位置 |
| `CMD_TOGGLE_SHIELD` | 开启/关闭护盾 |
| `CMD_FIRE_WEAPON` | 使用武器攻击目标 |
| `CMD_VENT_FLUX` | 主动排散辐能 |
| `CMD_NEXT_PHASE` | 推进到下一阶段 |

## DM控制台

主持人可通过 DM 面板执行以下操作：

- **清除过载**: 一键解除舰船过载状态
- **护甲编辑**: 修改指定象限的护甲值
- **创建测试舰船**: 快速生成测试单位

## 开发路线图

### 已实现 ✅
- [x] 基础架构 (Monorepo + Colyseus)
- [x] 三阶段机动算法
- [x] 6象限装甲系统
- [x] 护盾与辐能机制
- [x] 回合制状态机
- [x] DM控制台

### 计划中 📋
- [ ] 武器射界可视化
- [ ] 战斗日志系统
- [ ] 舰船数据导入 (JSON)
- [ ] 贴图导入支持
- [ ] 回放系统
- [ ] 场景编辑器

## 贡献

欢迎提交 Issue 和 PR！

## 许可证

MIT License

## 致谢

- [Starsector](https://fractalsoftworks.com/) - 灵感来源
- [Colyseus](https://colyseus.io/) - 多人游戏框架
- [PixiJS](https://pixijs.com/) - 2D渲染引擎
