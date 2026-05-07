/**
 * 预设数据验证 CLI 脚本
 *
 * 用法：tsx packages/data/src/scripts/validate-presets.ts
 *
 * 验证所有预设（舰船、武器、世界地图）的数据完整性。
 * 在 CI/CD 或开发阶段手动运行，确保预设数据合法。
 */

import { validatePresets, validateWorldPresets } from "../core/index.js";

let hasError = false;

// ── 舰船 + 武器 ──
const result = validatePresets();
if (result.passed) {
	console.log(`✅ 舰船 (${result.totalShips}) / 武器 (${result.totalWeapons}) — 全部通过`);
} else {
	hasError = true;
	console.log(`❌ 发现 ${result.totalIssues} 个问题:`);

	for (const ship of result.ships) {
		if (!ship.passed) {
			for (const issue of ship.issues) {
				console.log(`  [舰船] ${ship.name}: ${issue.path} — ${issue.message}`);
			}
		}
	}
	for (const weapon of result.weapons) {
		if (!weapon.passed) {
			for (const issue of weapon.issues) {
				console.log(`  [武器] ${weapon.name}: ${issue.path} — ${issue.message}`);
			}
		}
	}
}

// ── 世界地图 ──
const worldResult = validateWorldPresets() as any;
if (worldResult.worlds?.length) {
	const worlds = worldResult.worlds as any[];
	const passed = worlds.filter((w: any) => w.passed);
	const failed = worlds.filter((w: any) => !w.passed);

	if (failed.length === 0) {
		console.log(`✅ 世界地图 (${worlds.length}) — 全部通过`);
	} else {
		hasError = true;
		for (const w of failed) {
			for (const issue of w.issues) {
				console.log(`  [世界] ${w.name}: ${issue.path} — ${issue.message}`);
			}
		}
	}
}

if (hasError) {
	console.log("\n⚠️  存在验证错误，请修复后重新运行");
	process.exit(1);
} else {
	console.log("\n✨ 所有预设验证通过");
}
