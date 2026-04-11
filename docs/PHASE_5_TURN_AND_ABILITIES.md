# Phase 5: 玩家全局能力配置化与回合流转深度设计

## 一、 现状与痛点分析
当前的回合流转（`advancePhase`）仅仅是一个“死循环”：`DEPLOYMENT` -> `PLAYER_TURN` -> `DM_TURN` -> `END_PHASE`，然后又错误的回到了 `DEPLOYMENT` 重新开始。
而且，我们刚才已经将“针对对象的动作”抽象为了 Token Action Panel。但是玩家（或DM）还有很多**不依附于特定战舰的操作**：
- **玩家操作回合**: 玩家需要一个途径点击“结束我的行动（准备完毕）”。
- **战术技能 (Abilities)**: 例如全场性的电子干扰 (ECM)、扫描 (Sensor Ping) 等。
- **DM 特权操作**: 添加新棋子、强行跳过阶段、清空所有人过载等。

## 二、 全局操作面板架构设计 (Global Action Bar)

不再将这些功能硬编码在侧边栏中，而是设计一个**配置化的底部操作条 (Bottom Toolbar)**。根据当前玩家的 `role` 鉴定加载不同的组件模块。

### 1. 状态树扩展 (PlayerSchema 升级)
为了支撑能力的配置化，我们在 `PlayerState` 中引入全局指令权限字典。

```typescript
// shared/src/schema/GameSchema.ts
export class PlayerState extends Schema {
  @type("string") sessionId: string = "";
  @type("string") role: "dm" | "player" = "player";
  @type("string") name: string = "";
  @type("boolean") isReady: boolean = false;
  @type("boolean") connected: boolean = true;
  
  // 新增：玩家拥有的全局技能组/权限组 (字符串ID列表)
  @type(["string"]) abilities = new ArraySchema<string>();
}
```

### 2. 回合流转逻辑闭环 (Server Fix)
严格规范状态机转换节点。

- **DEPLOYMENT (部署期)**：
  - 只有 DM 可以向场上 `CREATE_SHIP` 并且分配给玩家 (`ASSIGN_SHIP`)。
  - 所有玩家配置好位置后。**DM 强制推进进入 `PLAYER_TURN`。**（此阶段开始即绝缘 `DEPLOYMENT`，不再返回）。
  
- **PLAYER_TURN (玩家行动期)**：
  - 玩家只能操作自己的单位进行移动或攻击。操作完毕后，必须点击右下角的【结束回合】按钮 (`CMD_TOGGLE_READY`)。
  - 当所有玩家的 `isReady === true` 时，触发 `checkAutoAdvancePhase` 自动进入 `DM_TURN`。

- **DM_TURN (DM行动期)**：
  - DM 执行敌舰机的动作。DM 点击【结束 DM 回合】触发进入 `END_PHASE`。

- **END_PHASE (结算期)**：
  - 服务器瞬间计算（自动触发）：
    1. 清算所有舰船软辐能、维护护盾消耗。
    2. 计算过载惩罚衰减。
    3. `turnCount++`。
  - 处理完毕后，**自动跳转回 `PLAYER_TURN`。** 

### 3. UI 层的 Toolbar 驱动 (Client Store)
我们在 `uiStore.ts` 已经有了 `activePanel` 之类的状态，接下来规划一个 `Toolbar.tsx`。

```tsx
// src/components/ui/Toolbar.tsx
const abilitiesDefinition = {
  'sensor_ping': { icon: '📡', label: '全域扫描', onClick: () => sendPing() },
  'ecm_burst': { icon: '⚡', label: '电子干扰', onClick: () => sendECM() },
};

export const Toolbar = () => {
  const { currentPhase } = useGameState();
  const myPlayer = useMyPlayerState(); // 根据 sessionId 获取
  
  return (
    <div className="bottom-toolbar">
      {/* 技能区 */}
      <div className="abilities">
        {myPlayer.abilities.map(ab => (
           <button onClick={abilitiesDefinition[ab].onClick}>
             {abilitiesDefinition[ab].label}
           </button>
        ))}
      </div>
      
      {/* 回合与状态流转区 */}
      <div className="turn-controls">
         {myPlayer.role === 'dm' ? <DMControls phase={currentPhase} /> : <PlayerControls player={myPlayer} phase={currentPhase} />}
      </div>
    </div>
  );
}

const PlayerControls = ({ player, phase }) => {
  if (phase !== 'PLAYER_TURN') return <span>等待其它阶段...</span>;
  return (
    <button onClick={() => network.sendToggleReady(!player.isReady)} className={player.isReady ? 'ready' : ''}>
      {player.isReady ? '取消结束 (取消Ready)' : '结束我的行动'}
    </button>
  );
}
```

## 三、 Step-by-Step 执行计划

1. **修正循环链**: 修改 `BattleRoom.ts` 的 `advancePhase()` 逻辑。当 `END_PHASE` 处理完毕（或计算出 nextIndex 是 END_PHASE 后的处理），强制将其置为 `PLAYER_TURN`，而不是从头回到 `DEPLOYMENT`。
2. **扩充 Player Schema**: 为玩家增加全局技能列表。
3. **建立前端 Toolbar UI**:
   - 提取出当前的行动阶段显示。
   - 放置可以改变 Ready 状态与强制流转的回合控制大按钮。