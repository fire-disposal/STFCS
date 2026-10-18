# STFCS

《远行星号》风格的俯视舰船对战推演，房主兼主持人，几个人连一台权威服务器；原型阶段，能打完一局，外围还糙。

**状态**：原型（能本地开局、能多人连，无正式发布）；**入口**：`pnpm dev` → client `:5173`、server `:3001`；**仓库**：[fire-disposal/STFCS](https://github.com/fire-disposal/STFCS)

## 本质

基于《远行星号》世界观的同人桌游推演工具。

## 选型

基于 pnpm workspace 的多包单仓，前端 React + PixiJS，后端 Node + Socket.IO，共享 zod schema，部署单容器。

- 运行时
  - Node 24
- 前端
  - React 19
    - React Router
    - Zustand
    - TanStack Query
    - Radix Themes
    - i18next
  - PixiJS 8
    - @pixi/react
    - pixi-filters
- 后端
  - Socket.IO 4
  - Node http
- 共享
  - @vt/data
    - zod 4
    - mutative
- 资产
  - sharp
- 桌面
  - Electron
    - electron-builder
- 工程
  - pnpm
  - turbo
  - tsup
  - vitest
  - Biome
- 部署
  - Docker Compose
  - GHCR
  - Nginx

## 功能

- 命中：基础 0.8，按距离比例最多减 0.4，PD 标签加 0.2，夹在 0.1–0.95；超射程或低于最小射程直接不中
- 伤害：射程修正 `1 - 0.5×比例`（下限 0.1）；被护盾拦下则转成硬辐能
- 装甲：六象限、每格 60°，按受击相对角取象限，穿透按 `D = X·Z/(Z+C)` 并受最小/最大减伤夹住
- 辐能：软硬分离（开火加软、护盾吃击加硬、EMP 加硬），到顶过载、护盾强制关、武器 `DISABLED` 一回合
- 机动：A 平移（选定前后或左右后锁方向）→ B 旋转 → C 平移，距离与角度必须是整数，A/C 共用预算，移动与旋转都做 OBB 碰撞
- 回合：`TurnFlowController` 按派系轮转，推进由房主用 `force_end_turn` 触发（就绪人数只是 UI 信号）；最后派系后进 `SETTLEMENT`，再 `turnCount+1` 回到首位
- 房间：内存 Map 管房（上限 100，空房 30 秒清、闲置 300 秒删），每房最多 8 人，房主断线自动转移；房间删除时若已有布局，快照写进房主存档
- 主持面：DM 侧栏改阶段/回合/派系、强制推进、直接编辑任意 token；overlay 支持画笔、便签、ping、视口同步
- 界面：Auth / Lobby / Game 三页，中英双语；玩家档案落在 `storage/players/*.json`
- 未完成：战报只覆盖 `game:action`，加入/退出仍是 notify（`todo.md` 就一行：把职责逐步迁到 battlelog）；测试只有 2 个文件、11 个用例，移动、护盾、装甲、目标选择、回合推进都没测

## 启动流程

```bash
pnpm install
pnpm dev            # 先构建 @vt/data，再起 server(:3001) + client(:5173)
pnpm build
pnpm typecheck && pnpm lint && pnpm test
docker compose up -d   # 生产形态，宿主 http://localhost:2567
```

client 的 vite 只把 `/api` 代理到 3001，WebSocket 直连 server 地址；`pnpm --filter @vt/server dev` 可只起服务端。

## 边界与已知问题

- 房间和战局全在内存里，进程一停就没了；落盘的只有玩家档案和房间删除时的快照。
- 权限有缺口：`edit:room` 要求房主，但 `edit:token` 只要求「在房间里」，任何玩家都能改别人的船，与「DM 编辑」的定位不一致。
- 没有 AI 对手，也没有对局回放/续局；多人测试靠手动开几个标签页。
- README 已过期：结构图漏了 `electron` 包，技术栈表写了依赖里并不存在的 Express。
- 引擎入口大量参数仍是 `any`，类型边界靠 `@vt/data` 的 schema 约定，写错字段只会在运行时炸。
- `sharp` 是原生依赖（资产缓存用），换平台或换 Node 大版本时它最先出问题。
- 没有对局数据的迁移机制：改状态结构就等于旧存档作废。

## 文档索引

- [docs/design/flux-balance.md](docs/design/flux-balance.md) — 通量平衡
- [docs/mount-coordinate-system.md](docs/mount-coordinate-system.md) — 挂载坐标
- [todo.md](todo.md) — 待办
- [AGENTS.md](AGENTS.md) — 开发约定
