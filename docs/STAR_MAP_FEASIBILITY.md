# 可编辑双层星图（“恒星层 + 行星系统层”）可行性分析与优化方案

## 1. 目标理解
你提出的需求本质上是把当前“战术地图 + Token”的平面数据，扩展为可编辑、可存档、可逐层钻取（Drill-down）的**层级星图数据系统**：

- **第一层（Galaxy Layer）**：只显示恒星，可新增恒星并编辑描述。
- **第二层（System Layer）**：点击恒星后进入该恒星系统，可新增行星并编辑描述。
- **要求**：
  - 具备“类似数据库”的结构化数据能力（而不是临时 UI 状态）。
  - 地图机制和存档机制一起重构，支持长期演进。

## 2. 当前问题（代码现状）

### 2.1 地图状态耦合、缺少层级模型
当前 map slice 主要围绕 `TokenInfo`，没有独立的恒星/行星实体模型，导致“星图编辑”只能塞进 metadata，后续查询/索引会变差。

### 2.2 存档结构缺失版本化
目前没有统一的地图快照协议（snapshot schema），未来一旦字段变化，旧档兼容和迁移会变困难。

### 2.3 房间存储仍以内存为主
后端目前提供的是 `InMemoryRoomStore`，适合开发/测试，不适合真正持久化。

> 结论：需求是**可行的**，但必须先做“数据模型层 + 快照层”的基础重构，然后再接 UI 和后端 DB。

## 3. 建议架构（分层）

1. **领域模型层（Shared Schema）**
   - StarNode / PlanetNode / StarSystem / StarMap / MapSnapshot。
   - 所有读写都通过 schema 校验，确保协议稳定。

2. **前端状态层（Redux Slice）**
   - 新增 `starMap` 子状态：
     - `stars`（恒星表）
     - `systems`（按 starId 索引的行星系统）
     - `currentLayer` / `currentStarId`（层级导航上下文）
   - 新增增删改 action：星体、行星、层级切换。

3. **存档层（Snapshot）**
   - 把地图基础配置 + token + starMap 打包为统一 `MapSnapshot`。
   - 快照带 `version + savedAt`，为未来迁移留出空间。

4. **后端持久化层（下一阶段）**
   - 将 snapshot 入库（PostgreSQL JSONB 或文档库都可）。
   - 以房间/战役为主键，支持版本管理与回滚。

## 4. 本次已执行的优化（代码已落地）

- 在 shared 中新增星图与快照 schema/type。
- 在 map slice 中新增：
  - 双层导航状态（galaxy/system）；
  - 恒星/行星增删改；
  - `loadMapSnapshot`（存档恢复入口）。
- 在 client store utils 中新增：
  - `createMapSnapshot`（导出快照）；
  - `restoreMapSnapshot`（恢复快照）。
- 增加 reducer 测试覆盖关键路径：
  - 层级切换；
  - 恒星/行星描述编辑；
  - 删除恒星时上下文清理；
  - 快照恢复。

## 5. 风险与后续建议

### 5.1 风险
- 当前仅完成“数据与状态层”重构，UI 编辑器和后端 DB 持久化尚未联通。
- `Date.now()` 时间戳在测试中可重复性较弱（如后续要做严格快照测试，建议注入时钟）。

### 5.2 建议下一步（按优先级）
1. **后端持久化**：新增 `MapSnapshotRepository`，先文件/SQLite，再上 PostgreSQL。
2. **API/WS 协议**：增加 `map.snapshot.save/load` 和 `starmap.*` 事件。
3. **UI 编辑器**：
   - 星图层：新增“创建恒星 + 描述编辑”面板；
   - 系统层：新增“创建行星 + 描述编辑”面板；
   - 面包屑导航（Galaxy > Sol > Planet）。
4. **迁移机制**：`snapshot.version` + migrator（v1 -> v2）。

## 6. 可行性结论

该需求在当前项目中属于**中高可行性**，核心不是渲染而是“结构化数据与版本化存档”。
本次优化已经把最关键的底座（schema + state + snapshot）搭起来，可以作为后续地图系统重构的稳定起点。
