# 战役 Markdown/YAML 格式设计

## 核心理念

**JSON Schema = 运行时格式。MD/YAML = 创作格式。**

两者之间的转换由解析器在加载时完成，前端和后端都不需要知道 MD/YAML 的存在。

```
作者                          STFCS 系统
───                          ──────────
campaign.md ──→ parser ──→ WorldMap (Zod 验证) ──→ PixiJS 渲染
                      ↑
                Zod 验证失败时给出
                清晰的错误行号
```

## 示例文件

````yaml
---
# 战役元数据
name: "猎户座远征"
author: "GM 小明"
version: 1
start: 星门

# 节点定义
nodes:
  - id: 星门
    name: "星门站"
    type: safe_haven
    pos: [0, 0]
    desc: >
      一座繁忙的空间站，联盟在此维持着强大的巡逻力量。
      这里是远征的起点。

  - id: 矿区
    name: "碎岩带"
    type: star_system  
    pos: [200, -150]
    state: threat
    terrain: 
      density: 0.4
      types: [asteroid, debris]
    desc: |
      富含矿藏的小行星带。
      最近有海盗活动迹象。

      > 领航员：「头儿，检测到异常信号。」

  - id: 星云
    name: "翡翠帷幕"
    type: nebula
    pos: [-180, -120]
    desc: 一片稠密的星际尘埃云，传感器在这里几乎失效。

  - id: 废墟
    name: "远古遗迹" 
    type: anomaly
    pos: [-100, 180]
    desc: 轨道上有不明残骸，能量读数异常。

  - id: 前哨
    name: "前哨-7"
    type: waypoint
    pos: [250, 100]
    desc: 小型军事前哨站，提供基本维修服务。

# 航线定义
edges:
  - from: 星门
    to: 矿区
    cost: 2
    encounter: 0.3
  - from: 星门
    to: 星云
    cost: 3
    encounter: 0.4
  - from: 星门
    to: 前哨
    cost: 1
    encounter: 0.1
  - from: 星门
    to: 废墟
    cost: 2
    encounter: 0.5
  - from: 矿区
    to: 前哨
    cost: 1
    encounter: 0.2
  - from: 星云
    to: 废墟
    hidden: true
    cost: 1
    encounter: 0.6
````

## 解析器架构

```typescript
// 1. 读取 .md 文件
const raw = fs.readFileSync("campaign.md", "utf-8");

// 2. 提取 YAML frontmatter
const { frontmatter, body } = parseFrontmatter(raw);
// frontmatter = { name, author, nodes: [...], edges: [...] }
// body = markdown content（目前忽略，将来用于叙事文本）

// 3. 验证并转换为 WorldMap
const worldMap = campaignYamlToWorldMap(frontmatter);
// 内部调用 WorldMapSchema.parse() 做 Zod 验证

// 4. 输出给游戏
return worldMap;
```

## 映射规则

| YAML | Schema | 说明 |
|------|--------|------|
| `pos: [x, y]` | `{ position: { x, y } }` | 数组转对象 |
| `terrain: { density: 0.4, types: [...] }` | `{ terrainProfile: { density, preferredTypes } }` | 直接映射 |
| `encounter: 0.3` | `{ encounterChance: 0.3 }` | 简写，省去 `encounterChance` 键名 |
| `hidden: true` | `{ hidden: true, discovered: false }` | 自动补充 `discovered` |
| `desc: \| ...` | `{ description: "..." }` 和 `{ hiddenDescription: "..." }` | 用 `>` 和 `\|` 区分 |

## 为什么比纯 JSON 好

| | JSON | MD+YAML |
|--|------|---------|
| 可读性 | 括号地狱 | 缩进结构 |
| 编辑体验 | 需要 IDE | 任何文本编辑器 + Obsidian |
| 注释 | 不支持 | `#` 原生支持 |
| 多行文本 | `\n` 转义 | `\|` 块文字 |
| 合并 | 冲突难以解决 | 行级 diff |
| 叙事嵌入 | 需要额外字段 | 正文就是 MD |
| GM 学习成本 | 需要懂 schema | YAML 基础即可 |

## 与现有系统的关系

```
campaign.md ──→ parser ──→ WorldMapSchema ──→ GameRoomState.world
                                 ↑
                    Zod 验证层保证类型安全
```

- 现有 `WorldMapSchema` / `WorldNodeSchema` **完全不变**
- `campaignYamlToWorldMap()` 产出 `WorldMap` 类型
- 前端/后端不知道也不关心数据来源是 MD 还是 JSON
- `set_world` 可以接受 MD 内容（通过 parser 转换）

## 后续扩展方向

1. **内联遭遇定义**：在节点中直接写遭遇配置（舰船类型、数量、AI 行为）
2. **分支叙事**：使用 MD 的 blockquote 表示可选叙事段
3. **条件节点**：YAML 中支持 `requires` 字段（需要特定条件才能解锁的节点/航线）
4. **GM 笔记**：使用 HTML 注释 `<!-- GM only -->` 标记仅 GM 可见的内容
5. **多文件战役**：一个目录下的多个 .md 文件组成一个战役
