// 导出 JSON 核心类型模块（含类型定义 + 运行时常量）
export * from "./core/index.js";

// 导出数据注册器
export { DataRegistry, dataRegistry } from "./core/DataRegistry.js";

// 导出配置加载器（含游戏规则 + 服务器配置）
export * from "./configs/index.js";
