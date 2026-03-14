# CI/CD 配置汇总（Lint 与工具链优化）

## 本次优化目标

- 将 Lint 工具链统一到 **Biome**，避免 ESLint/Biome 混用导致规则冲突。
- 在 Monorepo 中引入 **Turborepo** 统一调度 `lint / typecheck / test / build`。
- 优化 GitHub Actions 的 Lint 阶段，使用 Turbo 本地缓存加速。

## 关键变更

### 1) Biome 正确集成

- 在仓库根目录新增 `biome.json`，作为全局基线配置。
- `packages/client/biome.json` 改为 `extends ../../biome.json`，避免重复配置与版本漂移。
- 为 server/shared/client 统一补齐 `lint / lint:fix / format / format:check` 脚本。
- Lint 仅作用于 `src`，并用 `--diagnostic-level=error` 先做“可落地的渐进式治理”。

> 说明：当前仓库历史代码存在较多 warning（如 `any`、unused import），先不阻断流水线，后续可逐步收紧规则。

### 2) Turborepo 引入与脚本收敛

- 新增 `turbo.json`，定义任务图与缓存行为。
- 根 `package.json` 脚本从 `pnpm -r` 切换为 `turbo run`：
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
- 这样可以在 PR/CI 中实现更清晰的任务编排，并利用缓存减少重复执行。

### 3) GitHub Actions（CI）调整

- Lint Job 改为：
  - `pnpm lint`（Biome + Turbo pipeline）
  - `pnpm typecheck`（Turbo pipeline）
- 新增 `.turbo` 缓存恢复步骤（`actions/cache@v4`），提升重复构建效率。

## 关于“是否需要引入 Turborepo”的结论

**建议引入，且已引入。**

原因：
1. 项目已经是 pnpm workspace Monorepo（client/server/shared），天然适配 Turbo。
2. CI 需要跨包任务编排与缓存；仅靠 `pnpm -r` 在依赖图感知和缓存上较弱。
3. 后续若接入 Remote Cache（Vercel/自建），收益会进一步放大。

## 后续建议（分阶段）

1. **Phase 1（已完成）**：Biome + Turbo 跑通，并让 CI 可执行。
2. **Phase 2**：按包逐步将 warning 提升为 error（先 shared，再 server，再 client）。
3. **Phase 3**：启用 Turbo Remote Cache，减少 PR 反馈时间。
4. **Phase 4**：在 PR 中增加仅检查变更文件的策略（进一步降低历史代码债务影响）。
