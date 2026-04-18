# STFCS JSON Schema 定义

本目录包含 STFCS 项目激进 JSON 化方案的核心 JSON Schema 定义文件。

## 文件结构

```
schemas/
├── common.schema.json   # 通用类型定义（Texture, Faction, Metadata 等跨模块复用类型）
├── ship.schema.json     # 舰船JSON统一模型
├── weapon.schema.json   # 武器JSON统一模型
├── save.schema.json     # 游戏存档JSON格式
├── export.schema.json   # 导出分享JSON格式
├── presets.schema.json  # 预设集合格式
└── index.ts             # Schema索引和辅助函数
```

## Schema 依赖关系

```
common.schema.json
    ↑
    ├── ship.schema.json
    │       ↑
    │       ├── save.schema.json
    │       ├── export.schema.json
    │       └── presets.schema.json
    │
    └── weapon.schema.json
            ↑
            ├── ship.schema.json (武器挂点引用)
            ├── export.schema.json
            └── presets.schema.json
```

## 核心设计理念

### 1. 统一舰船模型 (ShipJSON)

预设舰船、自定义舰船、存档舰船使用**完全相同的 JSON 结构**：

```json
{
  "$schema": "ship-v1",
  "$id": "preset:frigate",          // 或 "ship:xxx" / "save:xxx"
  "$source": "preset",              // 或 "custom" / "save"
  "$presetRef": "preset:frigate",   // 可选，引用原型
  
  "spec": { ... },                  // 静态规格
  "runtime": { ... },               // 运行时状态（存档时才有）
  "metadata": { ... }               // 元数据
}
```

### 2. 武器内嵌规格

武器不再仅引用预设ID，而是**内嵌完整规格**：

```json
{
  "weaponMounts": [
    {
      "id": "m1",
      "size": "SMALL",
      "weapon": {                    // 内嵌武器规格
        "$id": "weapon:custom_001",
        "$source": "custom",
        "spec": { ... }
      }
      // 或使用预设引用：
      // "weaponRef": "preset:light_autocannon"
    }
  ]
}
```

### 3. 存档即舰船数组

存档不再需要"重建"逻辑，直接包含完整舰船 JSON：

```json
{
  "$schema": "save-v1",
  "ships": [
    { "$schema": "ship-v1", "spec": {...}, "runtime": {...} },
    { "$schema": "ship-v1", "spec": {...}, "runtime": {...} }
  ]
}
```

## 使用方式

### 验证 JSON 数据

```typescript
import Ajv from "ajv";
import { SCHEMA_FILES } from "./schemas";

const ajv = new Ajv({ schemas: [
  require(SCHEMA_FILES.common),
  require(SCHEMA_FILES.ship),
  require(SCHEMA_FILES.weapon),
  require(SCHEMA_FILES.save),
]});

const validateShip = ajv.getSchema("ship-v1");
if (validateShip(shipJson)) {
  // 验证通过
}
```

### TypeScript 类型生成

可使用 `json-schema-to-typescript` 从 Schema 生成类型：

```bash
json2ts -i schemas/ship.schema.json -o types/ShipJson.ts
```

### Colyseus Schema 生成

Schema Generator 可从 JSON Schema 自动生成 Colyseus Schema 类。

## 版本控制

所有 Schema 使用 `$version` 字段标识版本。数据迁移时检查版本兼容性。

## 扩展指南

新增字段时：
1. 在对应 Schema 的 `definitions` 中添加
2. 在 `properties` 中引用
3. 更新 `$version`
4. 编写迁移脚本处理旧数据