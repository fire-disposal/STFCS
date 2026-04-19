# STFCS 后端开发进度与TODO清单

## 项目概述
基于 @docs/design/issues.md 需求和 @packages/server/tree.md 架构设计，结合 @packages/data/ 权威数据结构。

## 当前完成进度评估

### ✅ 已完成的核心模块

#### 1. 几何计算模块 (src/core/engine/geometry/)
- ✅ 距离计算 (distance.ts)
- ✅ 角度计算 (angle.ts) - 包含角度规范化、差值计算、扇形角度判断
- ✅ 扇形区域计算 (sector.ts) - **已添加最小射程（内半径）支持**
  - 支持扇环（带内半径的扇形）计算
  - 新增函数：`createAnnularSector`, `isValidAnnularSector`, `calculateAnnularSectorArea`, `getAnnularSectorValidZone`
- ✅ 象限计算 (quadrant.ts)

#### 2. 游戏状态管理 (src/core/state/)
- ✅ GameState.ts - 基于 @vt/data 的权威数据结构 **（已简化：移除游戏结束判定和复杂派系逻辑）**
- ✅ Token.ts - Token状态管理
- ✅ Component.ts - 组件状态管理
- ✅ GameStateManager.ts - 游戏状态管理器 **（已简化）**

#### 3. 游戏引擎核心 (src/core/engine/)
- ✅ applyAction.ts - Action应用入口
- ✅ context.ts - 执行上下文
- ✅ modules/ - 子系统模块
  - ✅ movement.ts - 移动系统
  - ✅ combat.ts - 战斗系统
  - ✅ flux.ts - 辐能系统
  - ✅ shield.ts - 护盾系统
  - ✅ turn.ts - 回合系统
  - ✅ modifier.ts - 修正系统
- ✅ rules/ - 规则实现
  - ✅ damage.ts - 伤害计算
  - ✅ armor.ts - 护甲计算
  - ✅ weapon.ts - 武器规则

#### 4. Action/Event 系统
- ✅ actions/ - Action定义
  - ✅ move.ts - 移动Action
  - ✅ attack.ts - 攻击Action
  - ✅ rotate.ts - 旋转Action
  - ✅ endTurn.ts - 结束回合Action
- ✅ events/ - Event定义
  - ✅ damage.ts - 伤害事件
  - ✅ moved.ts - 移动事件
  - ✅ fluxChanged.ts - 辐能变化事件
  - ✅ turnChanged.ts - 回合变化事件

#### 5. 运行时服务 (src/runtime/)
- ✅ GameRuntime.ts - 游戏运行时管理
- ✅ Match.ts - 单局封装 **（已简化：移除自动游戏结束判定）**
- ✅ TurnManager.ts - 回合管理器

#### 6. 基础设施
- ✅ Dockerfile - 容器化配置
- ✅ package.json - 依赖管理
- ✅ tsconfig.json - TypeScript配置
- ✅ vitest.config.ts - 测试配置

### ⚠️ 部分完成/需要完善的模块

#### 1. 网络层 (src/server/)
- ⚠️ ws/server.ts - WebSocket服务器（基础框架）
- ⚠️ ws/connection.ts - 连接管理（需要完善）
- ⚠️ ws/protocol.ts - 消息协议（需要完善）
- ⚠️ rooms/ - 房间系统（基础框架）
- ⚠️ handlers/ - 消息处理器（需要实现）
- ⚠️ broadcast/ - 广播策略（需要实现）

#### 2. 数据层 (src/data/)
- ⚠️ 数据加载和验证（需要实现与@vt/data的集成）

#### 3. 基础设施 (src/infra/)
- ⚠️ logger.ts - 日志系统（需要完善）
- ⚠️ errors.ts - 错误处理（需要完善）
- ⚠️ config.ts - 配置管理（需要实现）

## 🚀 下一步需要实现的内容

### 高优先级（核心功能）

#### 1. 网络层完善
- [ ] 实现完整的WebSocket协议处理
- [ ] 完成连接生命周期管理（连接、断开、重连）
- [ ] 实现消息序列化/反序列化
- [ ] 完成房间系统的玩家加入/离开逻辑
- [ ] 实现Action消息处理器
- [ ] 实现广播策略（全房间广播、特定玩家广播）

#### 2. 数据集成
- [ ] 实现@vt/data包的完整集成
- [ ] 舰船数据加载和验证
- [ ] 武器数据加载和验证
- [ ] 预设数据管理

#### 3. 数据集成
- [ ] 实现@vt/data包的完整集成
- [ ] 舰船数据加载和验证
- [ ] 武器数据加载和验证
- [ ] 预设数据管理

### 中优先级（用户体验）

#### 3. 用户系统与头像存储
- [ ] 用户认证系统（基于session）
- [ ] 用户信息管理（昵称、角色等）
- [ ] **头像存储系统**：
  - 支持base64格式头像存储（data:image/*格式）
  - 头像大小限制和验证（建议最大256KB）
  - 头像缓存机制（Redis + 内存缓存）
  - 默认头像生成（基于用户ID的确定性生成）
  - **参考前端接口实现**：
    - 前端使用`SystemService.updateProfile()`和`getProfile()`接口
    - 消息协议：`PROFILE_UPDATE_REQUEST` / `PROFILE_UPDATE_RESPONSE`
    - 数据结构：`{ nickname?: string; avatar?: string }`
    - 后端需要实现的接口：
    ```typescript
    // 参考前端SystemService接口
    interface ProfileUpdateRequest {
      playerId: string;
      nickname?: string;
      avatar?: string; // base64 data URL
    }
    
    interface ProfileUpdateResponse {
      success: boolean;
      nickname: string;
      avatar: string;
      error?: string;
    }
    
    // 头像存储服务接口
    interface AvatarStorageService {
      // 存储头像（base64 data URL）
      storeAvatar(userId: string, avatarDataUrl: string): Promise<string>;
      
      // 获取头像（返回base64 data URL）
      getAvatar(userId: string): Promise<string | null>;
      
      // 删除头像
      deleteAvatar(userId: string): Promise<boolean>;
      
      // 验证头像数据
      validateAvatarData(avatarDataUrl: string): {
        valid: boolean;
        error?: string;
        mimeType?: string;
        size?: number;
      };
      
      // 生成默认头像（基于用户ID）
      generateDefaultAvatar(userId: string): string;
    }
    ```

#### 4. 持久化基础设施
- [ ] 数据库选型与配置（建议PostgreSQL + Redis）
- [ ] 数据模型设计：
  - 用户数据表（包含avatar字段）
  - 游戏房间表
  - 游戏状态快照表
  - 对战记录表
- [ ] 数据迁移脚本
- [ ] 缓存层实现（Redis）

#### 5. API接口
- [ ] RESTful API for 用户管理
- [ ] WebSocket API for 实时游戏
- [ ] 健康检查接口
- [ ] 监控和统计接口

### 低优先级（优化和扩展）

#### 7. 性能优化
- [ ] 游戏状态序列化优化
- [ ] WebSocket消息压缩
- [ ] 数据库查询优化
- [ ] 缓存策略优化


## 📋 详细实现计划

### 阶段1：网络层完善（预计2周）
1. 完善WebSocket服务器（1周）
2. 实现房间和连接管理（3天）
3. 完成消息协议和处理器（4天）

### 阶段2：运行时服务（预计1.5周）
1. 实现GameRuntime和Match（4天）
2. 完成TurnManager和游戏流程（3天）
3. 集成@vt/data数据验证（2天）

### 阶段3：持久化与用户系统（预计2周）
1. 数据库设计和迁移（3天）
2. 用户系统和头像存储（4天）
3. 游戏状态持久化（3天）

### 阶段4：API和监控（预计1周）
1. RESTful API实现（3天）
2. 监控和运维工具（2天）
3. 文档和部署脚本（2天）

## 🔧 技术栈建议

### 数据库
- **主数据库**: PostgreSQL（关系型数据、JSON支持）
- **缓存**: Redis（会话、实时状态）
- **文件存储**: 本地文件系统 + CDN（头像等静态资源）

### 头像存储方案
1. **存储格式**: base64直接存入数据库（小尺寸头像）
2. **大小限制**: 最大256KB，自动压缩
3. **验证**: MIME类型验证、尺寸验证
4. **缓存**: Redis缓存热门头像
5. **默认头像**: 系统生成或使用gravatar

### 持久化策略
1. **游戏状态**: 每回合结束后快照到数据库
2. **用户数据**: 实时更新，事务保证
3. **对战记录**: 游戏结束后归档
4. **日志**: 结构化日志 + 日志聚合

## 🎯 成功标准

### 功能完成度
- [ ] 支持完整的游戏流程（部署→战斗→结束）
- [ ] 支持多房间并发游戏
- [ ] 用户系统完整（注册、登录、头像）
- [ ] 数据持久化可靠
- [ ] API接口完备

### 性能指标
- [ ] 单房间支持8-16名玩家
- [ ] 游戏状态更新延迟 < 100ms
- [ ] 数据库查询响应 < 50ms
- [ ] 头像加载时间 < 200ms

### 质量指标
- [ ] 代码测试覆盖率 > 80%
- [ ] 类型安全（TypeScript严格模式）
- [ ] 错误处理完备
- [ ] 文档完整

## 📝 注意事项

1. **向后兼容**: 确保新实现与现有前端兼容
2. **数据迁移**: 设计平滑的数据迁移方案
3. **安全考虑**: 输入验证、SQL注入防护、XSS防护
4. **扩展性**: 设计支持未来功能扩展
5. **监控告警**: 关键指标监控和异常告警

## 🔄 更新记录

- **2026-04-19**: 创建TODO文档，评估当前进度
- **2026-04-19**: 已添加扇形几何模块的最小射程支持（扇环功能）

---

*最后更新: 2026-04-19*