## Git 使用规范

### 1. Commit 信息
- 每条 commit 信息的 **第一个字符必须是 emoji**，用于快速识别提交类型。
- 推荐常用 emoji：
  - ✨ 新功能
  - 🐛 修复 bug
  - 📚 文档更新
  - 🎨 样式调整
  - ♻️ 重构
  - ✅ 测试
- 示例：
  ```bash
  git commit -m "✨ 添加玩家加入的 WS 消息协议"
  git commit -m "🐛 修复 PixiJS 粒子渲染错误"
  ```

---

### 2. 分支管理
- **大功能开发必须建立独立分支**，避免直接在主分支修改。
- 分支命名规则：
  - 功能分支：`feature/<功能名>`
  - 修复分支：`fix/<问题名>`
- 示例：
  - `feature/ws-multiplayer`
  - `fix/pixi-shield-bug`

---

### 3. 合并流程
- 小改动（文档、样式修复）可以直接在主分支提交。
- 大功能完成后，直接将开发分支合并回主分支：
  ```bash
  git checkout main
  git merge feature/ws-multiplayer
  ```
- 合并后删除临时分支，保持仓库整洁。

---

### 4. 其他约定
- 提交前请确认代码能正常运行。
- 禁止提交临时文件、编译产物（确保 `.gitignore` 正确配置）。
- 文档更新也必须走 commit，保持版本可追溯。

---
