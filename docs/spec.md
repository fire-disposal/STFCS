## 📂 项目结构规范
- **Monorepo 管理**：保持 `packages` 下的 `client`、`server`、`shared` 三层结构，所有公共逻辑放在 `shared`。
- **文档**：所有设计文档放在 `docs`，与代码分离，避免混乱。
- **配置文件**：每个子包独立维护 `tsconfig.json`，但尽量继承根配置，减少重复。

---

## 📝 TypeScript 规范
- **严格模式**：所有 `tsconfig.json` 开启 `strict`。
- **类型优先**：禁止使用 `any`，优先 `unknown` + 类型守卫。
- **接口 vs 类型**：
  - 领域模型（DDD）用 `interface`。
  - 工具类型、联合类型用 `type`。
- **命名**：
  - 接口：`IShip`, `IMapTile`
  - 类型：`ShipStatus`, `ExplosionEffect`

---

## ⚙️ 后端（Fastify + tRPC）
- **路由层**：只负责协议转换，不写业务逻辑。
- **应用层**：tRPC procedure 映射到 DDD 的用例（UseCase）。
- **领域层**：聚合根、实体、值对象，全部放在 `packages/server/domain`。
- **事件通信**：WS 消息必须定义统一的 `MessageSchema`，避免魔法字符串。

---

## 🎨 前端（Vue + Pinia + Motion Vue）
- **组件划分**：
  - `components/`：纯 UI 组件。
  - `features/`：业务功能模块（如 `ShipControl`）。
  - `stores/`：Pinia 状态，必须有类型定义。
- **动画**：
  - Motion Vue 用于 UI 过渡。
  - Konva.js 专注路径、标记、交互。
  - PixiJS 专注粒子、护盾、爆炸。
- **命名规范**：
  - 组件：`ShipCanvas.vue`
  - Store：`useShipStore.ts`

---

## 🔄 通信规范
- **WS 消息格式**：
  ```ts
  type WSMessage =
    | { type: "PLAYER_JOINED"; payload: PlayerInfo }
    | { type: "SHIP_MOVED"; payload: ShipMovement }
    | { type: "EXPLOSION"; payload: ExplosionData };
  ```
- 所有消息必须在 `packages/shared/src/ws.ts` 定义，前后端共享。

---

## 🧪 测试规范
- **单元测试**：领域模型必须有测试，放在 `__tests__`。
- **集成测试**：tRPC procedure 必须测试输入输出。
- **前端测试**：关键交互（Konva 路径绘制、Pixi 粒子效果）需快照或渲染测试。

---

## 🛠️ 工具链规范
- **构建**：统一用 `tsup`。
- **运行**：开发环境用 `ts-node`。
- **包管理**：严格使用 `pnpm`，禁止混用 npm/yarn。
- **Lint & Format**：
  - ESLint + Prettier，规则写在根目录。
  - 提交前必须通过 `lint-staged`。

---

## ✅ 提交规范
- **Commit Message**：遵循 Conventional Commits
  - `feat(server): add ship movement usecase`
  - `fix(client): correct explosion particle rendering`
- **分支命名**：
  - `feature/ws-multiplayer`
  - `fix/pixi-shield-bug`
