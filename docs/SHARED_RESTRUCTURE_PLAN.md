# Shared 包必要性与重构方案（稳定性优先）

## 1. 现状结论

`@vt/shared` 当前承担了过多职责：

1. Colyseus Schema 运行时类（带 decorators）
2. 纯类型（TypeScript type/interface）
3. 协议常量与枚举
4. 资产/规则数据与数学工具

在 `turbo dev --parallel` + `tsx watch` 场景下，这会带来高风险：

- **运行时类与纯类型耦合**：任一导入链变化都可能影响 Schema 初始化顺序。
- **decorator 产物脆弱**：不同编译器/转译路径（tsup/tsx）对 decorator 处理不一致，容易出现 `Symbol.metadata` 相关崩溃。
- **barrel 导出放大依赖图**：`@vt/shared` 入口聚合过多导出，循环依赖更难定位。

结论：`shared` 仍有必要，但必须拆分职责。

---

## 2. 目标架构（建议）

建议拆为 3 个 workspace 包：

### A. `@vt/contracts`（纯 TS）

- 仅放：类型、协议 DTO、常量、版本号
- **禁止**：Schema class、decorators、运行时副作用
- client/server 均可安全依赖

### B. `@vt/rules`（纯函数 + 静态数据）

- 仅放：数学、判定算法、资产规格读取
- 可被 client/server 复用
- 不依赖 Schema runtime

### C. `@vt/server-schema`（服务端专属）

- 仅放：Colyseus `Schema` 类
- 只给 server 使用（client 不直接 import）
- 使用单一构建链（建议 `tsc` 或 `tsup` 固化到 `dist` 后再运行）

---

## 3. 安全迁移路线（分阶段）

### 阶段 0（立即止血）

- server 侧禁止从 `@vt/shared` 根入口导入 Schema 相关对象。
- 只从稳定子路径或专属包导入。
- 对 room state 初始化增加 schema 自检（metadata/type 检查）。

### 阶段 1（解耦协议）

- 把 `types/protocol/constants/core-types` 从 `shared` 迁移到 `@vt/contracts`。
- client/server 的非 Schema import 全量切到 `@vt/contracts`。

### 阶段 2（解耦规则）

- 把 `math/config/assets` 迁移到 `@vt/rules`。
- server `CommandDispatcher` 和 client 计算逻辑改依赖 `@vt/rules`。

### 阶段 3（收敛 Schema）

- 创建 `@vt/server-schema`，迁移 `GameRoomState/ShipState/PlayerState`。
- server room 与 command 仅依赖 `@vt/server-schema`。
- client 改为消费状态快照类型（来自 `@vt/contracts`），不直接依赖 Schema class。

### 阶段 4（治理）

- 增加 lint 规则：
  - client 禁止 import `@vt/server-schema`
  - contracts 禁止依赖 `@colyseus/schema`
  - rules 禁止依赖 server
- 在 CI 增加 `dep-cruise` 或 `madge` 循环依赖检测。

---

## 4. 目录建议

```text
packages/
  contracts/        # 纯类型与协议
  rules/            # 纯函数与静态规则
  server-schema/    # Colyseus Schema（server only）
  client/
  server/
```

---

## 5. 风险与回滚

- 风险：迁移期间 import 路径混用。
- 缓解：每阶段都提供兼容导出（deprecated alias），并在下一阶段移除。
- 回滚：保留 `@vt/shared` 只读桥接导出一段时间，快速回退路径。

---

## 6. 最小可执行清单（本周）

1. 新建 `@vt/contracts` 并迁移 `types/protocol/constants`。
2. server/client 非 Schema import 改到 `@vt/contracts`。
3. 在 CI 增加“禁止从 shared root 导入 Schema”的检查。
4. 再启动 `@vt/server-schema` 迁移。

## 7. 已执行（2026-04-12）

- ✅ 新建 `@vt/server-schema`，并将 server 运行时 Schema 依赖切换到该包。
- ✅ 新建 `@vt/rules` 与 `@vt/contracts` 包（首版桥接层），为后续彻底迁移提供边界。
- ✅ `server` 改为依赖 `@vt/server-schema` / `@vt/rules`。
- ✅ `dev` 启动链改为先构建 `@vt/server-schema`、`@vt/contracts`、`@vt/rules`，再启动 server/client。
- ✅ `@vt/rules` / `@vt/contracts` 已从桥接层改为源码独立，client/server 不再直接依赖 `@vt/shared`。
- ✅ 已删除 `packages/shared` 旧目录与 client/server 的兼容路径别名。

> 当前状态：迁移已收敛到三包架构（contracts/rules/server-schema），后续仅做功能迭代与治理规则加固。

---

该方案的核心是：

- **共享的是“协议与规则”**，
- **不共享运行时 Schema 类本身**。

这能显著降低你当前遇到的 `Symbol.metadata` 类问题的系统性概率。