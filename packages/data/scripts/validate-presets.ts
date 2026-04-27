/**
 * 预设数据合法性验证脚本（CLI 入口）
 *
 * 使用共享的 validatePresets() 函数验证所有预设数据，
 * 格式化输出详细报告。
 *
 * 用法：
 *   pnpm --filter @vt/data tsx scripts/validate-presets.ts
 *   或
 *   npx tsx packages/data/scripts/validate-presets.ts
 */

import { validatePresets } from "../src/core/validatePresets.js";

const result = validatePresets();

// ============================================================
// 格式化输出
// ============================================================

function printSeparator(title: string): void {
    console.log("=".repeat(60));
    console.log(`  ${title}`);
    console.log("=".repeat(60));
}

// ---- 舰船验证 ----
printSeparator("预设舰船数据验证");

for (const ship of result.ships) {
    console.log(`\n📋 [${ship.id}] ${ship.name}`);
    if (ship.passed) {
        console.log("  ✅ 全部检查通过");
    } else {
        for (const issue of ship.issues) {
            console.log(`  ❌ [${issue.path}] ${issue.message}`);
        }
    }
}

// ---- 武器验证 ----
console.log();
printSeparator("预设武器数据验证");

for (const weapon of result.weapons) {
    console.log(`\n📋 [${weapon.id}] ${weapon.name}`);
    if (weapon.passed) {
        console.log("  ✅ 全部检查通过");
    } else {
        for (const issue of weapon.issues) {
            console.log(`  ❌ [${issue.path}] ${issue.message}`);
        }
    }
}

// ---- 汇总 ----
console.log();
printSeparator("验证汇总");
console.log(`  舰船预设: ${result.totalShips} 个，问题数: ${result.totalShips - result.ships.filter(s => s.passed).length}`);
console.log(`  武器预设: ${result.totalWeapons} 个，问题数: ${result.totalWeapons - result.weapons.filter(w => w.passed).length}`);
console.log(`  总计问题: ${result.totalIssues}`);

if (result.passed) {
    console.log("\n  🎉 所有预设数据均符合 schema 约束！");
} else {
    const failedShips = result.ships.filter(s => !s.passed).length;
    const failedWeapons = result.weapons.filter(w => !w.passed).length;
    console.log(`\n  ⚠️  发现 ${result.totalIssues} 个问题（${failedShips} 艘舰船、${failedWeapons} 件武器），请修复后重新验证。`);
}
