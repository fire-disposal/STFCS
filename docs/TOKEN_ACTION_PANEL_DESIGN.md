# 战舰/Token 对象操作面板 (Action Panel) 封装机制设计

## 一、 背景与痛点
在桌面推演 VTT 中，随着游戏深度增加，玩家需要对棋子（战舰 Token）进行多种维度的操作（移动、旋转、开启护盾、选择武器、绘制射界、排散等）。
如果不加以抽象：
1. `ShipToken.tsx` 代码会严重膨胀（所有的点击、拖拽、菜单逻辑都在同一个组件内）。
2. UI（例如弹出的选项面板）会和 PIXI 渲染层耦合过深，导致坐标计算复杂。
3. 状态机的“操作锁”很难传递（例如在“选择射击目标”模式下，点击另一个船不应该算作“选中它”，而应算作“朝它开火”）。

## 二、 封装机制核心：分层与状态机模式 (Interaction Mode)

我们将采取 **"状态机驱动的 HUD + 纯虚的 PIXI Token"** 架构。

### 1. 本地视图状态库扩展 (UI Store 升级)
我们需要在当前的 Zustand `uiStore` 中引入 `interactionMode`（交互模式）的概念。

```typescript
// 交互状态机枚举
export type InteractionMode = 
  | 'IDLE'              // 游手好闲模式 (可以随便点选棋子)
  | 'DRAWING_MOVE'      // 绘制机动路线模式 (按下后出现三个阶段的标尺)
  | 'SELECTING_TARGET'  // 射击瞄准模式 (武器高亮、显示扇形射界，期待点击下一个敌人)
  | 'DM_OVERRIDING';    // DM特殊修改模式

interface UIState {
  selectedShipId: string | null;
  interactionMode: InteractionMode;   // 当前本地操作的心智模型
  activeWeaponId: string | null;      // 如果在射击模式, 是哪把武器
  actionPanelPosition: { x: number, y: number } | null; // HUD 悬浮面板在屏幕上的绝对坐标
}
```

### 2. 纯显示的 PIXI 层 (View Layer)
`ShipToken.tsx` (在 `@pixi/react` 内) **不包含任何 HTML 弹出的逻辑**。它只需要监听四个基础事件，并向 Store 发射信号：

1. `pointerdown`: 判断 `interactionMode` 是否为 `SELECTING_TARGET`。若是，则发射“开火指令”；若否，则选中自己。
2. 接收 `uiStore.selectedShipId === this.id` 时：绘制选中光环框 （如果是自己的船，画绿色；如果不是，画灰色虚线）。
3. 接收 `interactionMode === 'DRAWING_MOVE'` 时：显示预构建的移动标尺 Sprite 区块。

### 3. 解耦的 HTML HUD 层 (HUD Layer)
在 `<GameCanvas>` 之上的一个 `<div>`，它专门用于监听 `uiStore.selectedShipId`。当有值被选中时，它根据战舰的实时 PIXI 屏幕坐标（反算到 HTML 视口坐标），生成一个悬浮菜单 (Token Context Menu)。

**`TokenActionMenu.tsx` 结构预想：**
```tsx
const TokenActionMenu = () => {
    const { selectedShipId, actionPanelPosition } = useUIStore();
    const ship = useShipState(selectedShipId); // 从 Colyseus/状态引用的 hooks
    const mySessionId = network.getSessionId();
    
    if(!selectedShipId || !actionPanelPosition) return null;

    // 鉴权判断 (基于 Phase 3 的核心设定)
    const isMine = ship.ownerId === mySessionId;
    const isPlayerTurn = phase === 'PLAYER_TURN';
    const isDM = myRole === 'dm';
    
    // 如果没有权限，或者过载，则显示「只读属性面板」，不能有操作按钮！
    if((!isMine && !isDM) || !isPlayerTurn) {
        return <ReadOnlyPropertyPanel ship={ship} />
    }

    // 有权限，渲染全功能 Action Panel
    return (
        <div style={{ left: actionPanelPosition.x, top: actionPanelPosition.y }}>
            <h3>{ship.hullType} {ship.id}</h3>
            <button onClick={startMoveDrawing}>机动规划 (Move)</button>
            <button onClick={toggleShield}>
                状态: {ship.isShieldUp ? '降下护盾' : '升起护盾'}
            </button>
            <button onClick={ventFlux}>主动排散 (Vent)</button>
            
            <WeaponList weapons={ship.weapons} onFireClick={modeSelectTarget} />
        </div>
    )
}
```

## 三、 面板操作工作流示例 (以开火为例)

1. **选中并呼出面板**: 
   玩家在 PIXI 视图中点击战舰 A。
   `ShipToken.tsx` 调用 `uiStore.selectShip('A', {x: 300, y: 150})`。
   HTML 层的 `TokenActionMenu` 在屏幕 (300, 150) 处渲染出菜单。
2. **切入瞄准模式**:
   玩家点击菜单中的【开炮: 针刺机炮】按钮。
   不发送请求，而是调用 `uiStore.setInteractionMode('SELECTING_TARGET', 'weapon_1')`。
   **面板关闭/隐藏 (避免挡住目标)**。
3. **视觉辅助 (射界高亮)**:
   PIXI 视图监听到模式变为 `SELECTING_TARGET`。自动在战舰 A 前方画出一个 90 度的扇形 `Graphics` 辅助瞄准；
   同时，所有在扇形内且是敌方的单位，被套上一层红色的 `DropShadowFilter` 提示可以点击。
4. **命中目标**:
   玩家鼠标点击敌军战舰 B。
   敌军 B 的 `ShipToken.tsx` 的 `pointerdown` 回调中，检测到 `interactionMode === SELECTING_TARGET`。
   此时直接调用：`network.sendFireWeapon('A', 'weapon_1', 'B')`。
5. **重置模式**:
   发请求后，系统自动重置 `uiStore.setInteractionMode('IDLE')`。

## 四、 后续开发建议

按照这个套路，您接下来（Phase 5 后）的步骤建议为：
1. 在 `client/src/store/uiStore.ts` 中引入 `interactionMode`。
2. 新建 `components/ui/TokenActionMenu.tsx` 吸附式浮空面板（不要放在 Canvas Pixi 容器内，而是作为绝对定位的 DIV 盖在上面）。
3. 剥离 PIXI 组件 (`ShipToken.tsx`) 里复杂的 DOM 状态，使得它彻底退化为**纯正的视图函数**，专注于执行平滑移动动画、伤害飘字、射界几何图形渲染。