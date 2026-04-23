## 挂载点坐标系定义

### 标准定义（航海坐标系）

```
挂载点偏移坐标系（相对于舰船中心）：
- X轴：左舷为正，右舷为负
- Y轴：船头为正，船尾为负

示例：
- position: { x: 50, y: 100 } → 船头方向100像素，左舷方向50像素
- position: { x: -30, y: -80 } → 船尾方向80像素，右舷方向30像素

贴图偏移坐标系（与挂载点一致）：
- offsetX 正 → 左舷方向 → 世界 -X
- offsetY 正 → 船头方向 → 世界 -Y

示例：
- texture: { offsetX: 10, offsetY: 20 } → 向左舷偏移10像素，向船头偏移20像素
```

### 世界坐标转换公式

```typescript
// 舰船贴图偏移
const headingRad = heading * Math.PI / 180;
const worldX = shipX - offsetX * Math.cos(headingRad) + offsetY * Math.sin(headingRad);
const worldY = shipY - offsetX * Math.sin(headingRad) - offsetY * Math.cos(headingRad);

// 挂载点位置（同上）
// 武器贴图偏移（相对于挂载点，不考虑 heading）
const weaponWorldX = mountWorldX - weaponOffsetX;
const weaponWorldY = mountWorldY - weaponOffsetY;
```