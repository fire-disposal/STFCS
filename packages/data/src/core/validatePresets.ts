/**
 * 预设数据合法性验证函数
 *
 * 提供可复用的验证逻辑，供 CLI 脚本和服务端启动时调用。
 * 基于 Zod schema 对预设舰船和武器 JSON 进行严格验证。
 */

import {
    InventoryTokenSchema,
    WeaponJSONSchema,
    HullSizeSchema,
    HullSize,
} from "./GameSchemas.js";
import { presetShips } from "../presets/ships/index.js";
import { presetWeapons } from "../presets/weapons/index.js";

// ============================================================
// 类型定义
// ============================================================

export interface PresetValidationIssue {
    path: string;
    message: string;
}

export interface PresetValidationItem {
    id: string;
    name: string;
    issues: PresetValidationIssue[];
    passed: boolean;
}

export interface PresetValidationResult {
    ships: PresetValidationItem[];
    weapons: PresetValidationItem[];
    totalShips: number;
    totalWeapons: number;
    totalIssues: number;
    passed: boolean;
}

// ============================================================
// 辅助函数
// ============================================================



function checkMounts(mounts: Record<string, unknown>[] | undefined): PresetValidationIssue[] {
    const issues: PresetValidationIssue[] = [];
    if (!mounts) return issues;

    for (let i = 0; i < mounts.length; i++) {
        const mount = mounts[i];
        if (!mount) continue;
        const mountPath = `spec.mounts[${i}]`;

        if (!mount["id"]) {
            issues.push({ path: `${mountPath}.id`, message: `缺少必填字段 "id"` });
        }
        if (!mount["position"]) {
            issues.push({ path: `${mountPath}.position`, message: `缺少必填字段 "position"` });
        } else {
            const pos = mount["position"] as Record<string, unknown>;
            if (typeof pos["x"] !== "number") issues.push({ path: `${mountPath}.position.x`, message: "必须为数字" });
            if (typeof pos["y"] !== "number") issues.push({ path: `${mountPath}.position.y`, message: "必须为数字" });
        }
        if (!mount["size"]) {
            issues.push({ path: `${mountPath}.size`, message: `缺少必填字段 "size"` });
        }

        if (mount["arc"] !== undefined) {
            const arc = mount["arc"] as number;
            if (arc < 0 || arc > 360) {
                issues.push({ path: `${mountPath}.arc`, message: `值 ${arc} 超出范围 [0, 360]` });
            }
        }

        
    }

    return issues;
}

// ============================================================
// 主验证函数
// ============================================================

export function validatePresets(): PresetValidationResult {
    const ships: PresetValidationItem[] = [];
    const weapons: PresetValidationItem[] = [];
    let totalIssues = 0;

    // ---- 舰船验证 ----
    for (const ship of presetShips) {
        const id = ship.$id;
        const name = ship.metadata?.name ?? "(unnamed)";
        const issues: PresetValidationIssue[] = [];

        // 1. InventoryTokenSchema 严格验证
        const result = InventoryTokenSchema.safeParse(ship);
        if (!result.success) {
            for (const issue of result.error.issues) {
                const received = (issue as any).received;
                issues.push({
                    path: issue.path.join("."),
                    message: `${issue.message}${received !== undefined ? ` (received: ${JSON.stringify(received)})` : ""}`,
                });
                totalIssues++;
            }
        }

        // 2. HullSize 合法性
        const spec = ship.spec as Record<string, unknown>;
        const size = spec["size"] as string;
        if (!HullSizeSchema.safeParse(size).success) {
            issues.push({
                path: "spec.size",
                message: `"${size}" 不是合法的 HullSize，合法值: ${Object.values(HullSize).join(", ")}`,
            });
            totalIssues++;
        }

        // 3. mounts 中的武器 tags
        const mounts = spec["mounts"] as Record<string, unknown>[] | undefined;
        const mountIssues = checkMounts(mounts);
        for (const mi of mountIssues) {
            issues.push(mi);
            totalIssues++;
        }

        // 4. shield arc 范围
        const shield = spec["shield"] as Record<string, unknown> | undefined;
        if (shield) {
            const arc = shield["arc"] as number;
            if (arc < 0 || arc > 360) {
                issues.push({ path: "spec.shield.arc", message: `值 ${arc} 超出范围 [0, 360]` });
                totalIssues++;
            }
            const radius = shield["radius"] as number;
            if (radius < 0) {
                issues.push({ path: "spec.shield.radius", message: `值 ${radius} 不能为负数` });
                totalIssues++;
            }
        }

        ships.push({ id, name, issues, passed: issues.length === 0 });
    }

    // ---- 武器验证 ----
    for (const weapon of presetWeapons) {
        const id = weapon.$id;
        const name = weapon.metadata?.name ?? "(unnamed)";
        const issues: PresetValidationIssue[] = [];

        // 1. WeaponJSONSchema 严格验证
        const result = WeaponJSONSchema.safeParse(weapon);
        if (!result.success) {
            for (const issue of result.error.issues) {
                const received = (issue as any).received;
                issues.push({
                    path: issue.path.join("."),
                    message: `${issue.message}${received !== undefined ? ` (received: ${JSON.stringify(received)})` : ""}`,
                });
                totalIssues++;
            }
        }

        weapons.push({ id, name, issues, passed: issues.length === 0 });
    }

    return {
        ships,
        weapons,
        totalShips: presetShips.length,
        totalWeapons: presetWeapons.length,
        totalIssues,
        passed: totalIssues === 0,
    };
}
