/**
 * 预设数据合法性验证脚本
 *
 * 使用 Zod schema 对预设舰船和武器 JSON 进行严格验证，
 * 输出所有不合规字段的详细报告。
 *
 * 用法：
 *   pnpm --filter @vt/data tsx scripts/validate-presets.ts
 *   或
 *   npx tsx packages/data/scripts/validate-presets.ts
 */

import {
    InventoryTokenSchema,
    WeaponJSONSchema,
    WeaponTagSchema,
    HullSizeSchema,
    HullSize,
} from "../src/core/GameSchemas.js";
import { presetShips } from "../src/presets/ships/index.js";
import { presetWeapons } from "../src/presets/weapons/index.js";

// ============================================================
// 辅助函数
// ============================================================

const VALID_WEAPON_TAGS: readonly string[] = WeaponTagSchema.options;

function formatZodError(err: unknown): string {
    if (err instanceof Array) {
        return (err as Array<{ path: (string | number)[]; message: string }>)
            .map((e) => `    [${e.path.join(".")}] ${e.message}`)
            .join("\n");
    }
    return String(err);
}

function findInvalidTags(tags: string[] | undefined): string[] {
    if (!tags) return [];
    return tags.filter((t) => !VALID_WEAPON_TAGS.includes(t));
}

function checkWeaponSpec(spec: Record<string, unknown>, path: string): string[] {
    const issues: string[] = [];

    // 检查 tags 合法性
    const tags = spec["tags"] as string[] | undefined;
    const invalidTags = findInvalidTags(tags);
    for (const tag of invalidTags) {
        issues.push(`  [${path}.tags] 非法标签 "${tag}"，合法值: ${VALID_WEAPON_TAGS.join(", ")}`);
    }

    return issues;
}

function checkMounts(mounts: Record<string, unknown>[] | undefined, shipId: string): string[] {
    const issues: string[] = [];
    if (!mounts) return issues;

    for (let i = 0; i < mounts.length; i++) {
        const mount = mounts[i];
        const mountPath = `spec.mounts[${i}]`;

        // 检查 mount 必填字段
        if (!mount["id"]) {
            issues.push(`  [${mountPath}.id] 缺少必填字段 "id"`);
        }
        if (!mount["position"]) {
            issues.push(`  [${mountPath}.position] 缺少必填字段 "position"`);
        } else {
            const pos = mount["position"] as Record<string, unknown>;
            if (typeof pos["x"] !== "number") issues.push(`  [${mountPath}.position.x] 必须为数字`);
            if (typeof pos["y"] !== "number") issues.push(`  [${mountPath}.position.y] 必须为数字`);
        }
        if (!mount["size"]) {
            issues.push(`  [${mountPath}.size] 缺少必填字段 "size"`);
        }

        // 检查 arc 范围
        if (mount["arc"] !== undefined) {
            const arc = mount["arc"] as number;
            if (arc < 0 || arc > 360) {
                issues.push(`  [${mountPath}.arc] 值 ${arc} 超出范围 [0, 360]`);
            }
        }

        // 检查内嵌武器 spec
        const weapon = mount["weapon"] as Record<string, unknown> | undefined;
        if (weapon) {
            const weaponSpec = weapon["spec"] as Record<string, unknown> | undefined;
            if (weaponSpec) {
                issues.push(...checkWeaponSpec(weaponSpec, `${mountPath}.weapon.spec`));
            }
        }
    }

    return issues;
}

// ============================================================
// 舰船验证
// ============================================================

console.log("=".repeat(60));
console.log("  预设舰船数据验证");
console.log("=".repeat(60));

let shipTotalIssues = 0;

for (const ship of presetShips) {
    const id = ship.$id;
    console.log(`\n📋 [${id}] ${ship.metadata?.name ?? "(unnamed)"}`);

    // 1. InventoryTokenSchema 严格验证
    const result = InventoryTokenSchema.safeParse(ship);
    if (!result.success) {
        const zodIssues = result.error.issues;
        console.log(`  ❌ Zod 验证失败 (${zodIssues.length} 个问题):`);
        for (const issue of zodIssues) {
            const received = (issue as any).received;
            console.log(`    [${issue.path.join(".")}] ${issue.message}${received !== undefined ? ` (received: ${JSON.stringify(received)})` : ""}`);
            shipTotalIssues++;
        }
    } else {
        console.log(`  ✅ InventoryTokenSchema 验证通过`);
    }

    // 2. 额外检查：HullSize 合法性
    const spec = ship.spec as Record<string, unknown>;
    const size = spec["size"] as string;
    if (!HullSizeSchema.safeParse(size).success) {
        console.log(`  ❌ [spec.size] "${size}" 不是合法的 HullSize，合法值: ${Object.values(HullSize).join(", ")}`);
        shipTotalIssues++;
    }

    // 3. 额外检查：mounts 中的武器 tags
    const mounts = spec["mounts"] as Record<string, unknown>[] | undefined;
    const mountIssues = checkMounts(mounts, id);
    if (mountIssues.length > 0) {
        console.log(`  ❌ 挂载点武器标签问题 (${mountIssues.length} 个):`);
        for (const issue of mountIssues) {
            console.log(issue);
            shipTotalIssues++;
        }
    }

    // 4. 检查 shield arc 范围
    const shield = spec["shield"] as Record<string, unknown> | undefined;
    if (shield) {
        const arc = shield["arc"] as number;
        if (arc < 0 || arc > 360) {
            console.log(`  ❌ [spec.shield.arc] 值 ${arc} 超出范围 [0, 360]`);
            shipTotalIssues++;
        }
        const radius = shield["radius"] as number;
        if (radius < 0) {
            console.log(`  ❌ [spec.shield.radius] 值 ${radius} 不能为负数`);
            shipTotalIssues++;
        }
    }

    if (mountIssues.length === 0 && result.success && HullSizeSchema.safeParse(size).success) {
        console.log(`  ✅ 全部检查通过`);
    }
}

// ============================================================
// 武器验证
// ============================================================

console.log(`\n${"=".repeat(60)}`);
console.log("  预设武器数据验证");
console.log("=".repeat(60));

let weaponTotalIssues = 0;

for (const weapon of presetWeapons) {
    const id = weapon.$id;
    console.log(`\n📋 [${id}] ${weapon.metadata?.name ?? "(unnamed)"}`);

    // 1. WeaponJSONSchema 严格验证
    const result = WeaponJSONSchema.safeParse(weapon);
    if (!result.success) {
        const zodIssues = result.error.issues;
        console.log(`  ❌ Zod 验证失败 (${zodIssues.length} 个问题):`);
        for (const issue of zodIssues) {
            const received = (issue as any).received;
            console.log(`    [${issue.path.join(".")}] ${issue.message}${received !== undefined ? ` (received: ${JSON.stringify(received)})` : ""}`);
            weaponTotalIssues++;
        }
    } else {
        console.log(`  ✅ WeaponJSONSchema 验证通过`);
    }

    // 2. 检查 tags 合法性
    const spec = weapon.spec as Record<string, unknown>;
    const tags = spec["tags"] as string[] | undefined;
    const invalidTags = findInvalidTags(tags);
    if (invalidTags.length > 0) {
        console.log(`  ❌ [spec.tags] 包含非法标签: ${invalidTags.join(", ")}`);
        console.log(`     合法值: ${VALID_WEAPON_TAGS.join(", ")}`);
        weaponTotalIssues += invalidTags.length;
    }

    if (result.success && invalidTags.length === 0) {
        console.log(`  ✅ 全部检查通过`);
    }
}

// ============================================================
// 汇总报告
// ============================================================

console.log(`\n${"=".repeat(60)}`);
console.log("  验证汇总");
console.log("=".repeat(60));
console.log(`  舰船预设: ${presetShips.length} 个，问题数: ${shipTotalIssues}`);
console.log(`  武器预设: ${presetWeapons.length} 个，问题数: ${weaponTotalIssues}`);
console.log(`  总计问题: ${shipTotalIssues + weaponTotalIssues}`);

if (shipTotalIssues + weaponTotalIssues === 0) {
    console.log("\n  🎉 所有预设数据均符合 schema 约束！");
} else {
    console.log("\n  ⚠️  发现上述问题，请修复后重新验证。");
}
