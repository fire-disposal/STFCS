## 挂载点坐标系定义

### 标准定义（航海坐标系）

```
挂载点偏移坐标系（相对于舰船中心）：
- X轴：左舷为正，右舷为负
- Y轴：船头为正，船尾为负

示例：
- position: { x: 50, y: 100 } → 船头方向100像素，左舷方向50像素
- position: { x: -30, y: -80 } → 船尾方向80像素，右舷方向30像素

舰船 heading=0（船头向上）时的世界坐标转换：
- worldX = shipX + offsetX（左舷偏移直接映射到世界X）
- worldY = shipY - offsetY（船头偏移映射到世界Y负方向）

任意 heading 时的世界坐标转换（标准公式）：
- 航海角度转数学角度：headingRad = (heading - 90) * PI / 180
- worldX = shipX + offsetX * cos(headingRad) - offsetY * sin(headingRad)
- worldY = shipY + offsetX * sin(headingRad) + offsetY * cos(headingRad)

验证：
- heading=0（船头向上）：
  - worldX = shipX + offsetX * cos(-90) - offsetY * sin(-90) = shipX + offsetY（错误！）
  
正确公式（航海坐标系专用）：
- heading=0（船头向上，-Y方向）：
  - offsetX（左舷）映射到世界X正方向
  - offsetY（船头）映射到世界Y负方向
  
- heading=90（船头向右，+X方向）：
  - offsetX（左舷）映射到世界Y正方向
  - offsetY（船头）映射到世界X正方向

转换公式（航海坐标系）：
```
headingRad = heading * PI / 180  // 航海角度直接转弧度

// 左舷方向在世界坐标系的投影
leftX = -sin(headingRad)  // heading=0时，左舷在-X方向（错误，应在+X）
leftY = cos(headingRad)   // heading=0时，左舷在+Y方向（错误，应在-Y方向）

// 正确：航海角度中，左舷=+X方向（heading=0时）
// 船头方向在世界坐标系的投影
forwardX = cos(headingRad)   // heading=0时，船头在-X方向（错误）
forwardY = -sin(headingRad)  // heading=0时，船头在-Y方向

// 实际正确公式：
headingRad = (heading - 90) * PI / 180  // 航海角度转数学角度

// 数学坐标系中：
// heading=0（航海） → headingRad=-90（数学）
// cos(-90)=0, sin(-90)=-1
// offsetX（左舷正）→ 世界X正方向 ✓
// offsetY（船头正）→ 世界Y负方向 ✓

worldX = shipX + offsetX * cos(headingRad) + offsetY * sin(headingRad)
       = shipX + offsetX * 0 + offsetY * (-1)
       = shipX - offsetY  // 错误！offsetY正数应向船头（-Y），这里变成+Y

// 正确公式应该是：
worldX = shipX + offsetX * cos(headingRad) + offsetY * (-sin(headingRad))
worldY = shipY + offsetX * sin(headingRad) + offsetY * cos(headingRad)
```

### 最简公式（推荐）

```
// 航海坐标系偏移 → 世界坐标（数学坐标系）
headingRad = (heading - 90) * PI / 180

worldX = shipX + offsetX * cos(headingRad) + offsetY * (-sin(headingRad))
worldY = shipY + offsetX * sin(headingRad) + offsetY * cos(headingRad)

验证：
- heading=0（船头向上）：headingRad=-90
  - cos(-90)=0, sin(-90)=-1
  - worldX = shipX + offsetX*0 + offsetY*(-(-1)) = shipX + offsetY
    → offsetY正数向右？错误！
  - worldY = shipY + offsetX*(-1) + offsetY*0 = shipY - offsetX
    → offsetX正数向上？错误！

// 正确映射：
// heading=0时：
//   offsetX正 → 左舷 → 世界+X
//   offsetY正 → 船头 → 世界-Y

// 因此：
headingRad = heading * PI / 180

// offsetX（左舷）在世界的投影
leftWorldX = cos(headingRad + 90) = -sin(headingRad)  // heading=0 → 1（+X）正确！
leftWorldY = sin(headingRad + 90) = cos(headingRad)   // heading=0 → 0

// offsetY（船头）在世界的投影
forwardWorldX = cos(headingRad)  // heading=0 → 1（+X）错误！船头应向-Y
forwardWorldY = -sin(headingRad) // heading=0 → 0

// 最终正确公式：
worldX = shipX + offsetX * (-sin(headingRad)) + offsetY * cos(headingRad)
worldY = shipY + offsetX * cos(headingRad) + offsetY * sin(headingRad)

验证 heading=0：
- worldX = shipX + offsetX * (-sin(0)) + offsetY * cos(0) = shipX + offsetY
  → offsetY正数向+X（右）错误！
- worldY = shipY + offsetX * cos(0) + offsetY * sin(0) = shipY + offsetX
  → offsetX正数向+Y（下）错误！

// 正确：heading=0（船头向上）
// offsetX正 → 左舷 → 世界+X（右）错误！应该是右舷负，左舷正
// offsetY正 → 船头 → 世界-Y（上）正确

// 等等，用户定义是：
// X轴：左舷为正 → heading=0时，左舷在世界+X方向？不，左舷在观察者视角是左侧（-X）
// Y轴：船头为正 → heading=0时，船头在世界-Y方向（向上）

// 观察者视角：屏幕坐标系
// +X向右，+Y向下
// heading=0时船头向上（-Y方向）

// 因此：
// offsetX正（左舷）→ 世界-X（屏幕左侧）
// offsetY正（船头）→ 世界-Y（屏幕上方）

// 正确公式：
headingRad = heading * PI / 180

worldX = shipX + offsetX * (-cos(headingRad + 90)) + offsetY * cos(headingRad)
       = shipX - offsetX * sin(headingRad) + offsetY * cos(headingRad)

worldY = shipY + offsetX * sin(headingRad + 90) + offsetY * sin(headingRad)
       = shipY + offsetX * cos(headingRad) + offsetY * sin(headingRad)

验证 heading=0：
- worldX = shipX - offsetX * sin(0) + offsetY * cos(0) = shipX + offsetY
  → offsetY正数向+X（右）错误！船头应向-Y
  
// 我搞混了。重新定义：
```

### 最终标准定义

```
挂载点偏移（舰船坐标系）：
- X：左舷方向偏移（正数向左舷，负数向右舷）
- Y：船头方向偏移（正数向船头，负数向船尾）

屏幕世界坐标系：
- +X 向右
- +Y 向下

heading=0（船头向上）时：
- 船头方向 = -Y（屏幕上方）
- 左舷方向 = -X（屏幕左侧）
- 右舷方向 = +X（屏幕右侧）
- 船尾方向 = +Y（屏幕下方）

转换公式：
headingRad = heading * PI / 180

// 船头方向向量（航海角度 heading）
forwardX = cos(headingRad - 90) = sin(headingRad)
forwardY = sin(headingRad - 90) = -cos(headingRad)

// 左舷方向向量（航海角度 heading + 90）
leftX = cos(headingRad) 
leftY = sin(headingRad)

// 世界坐标
worldX = shipX + offsetX * leftX + offsetY * forwardX
       = shipX + offsetX * cos(headingRad) + offsetY * sin(headingRad)

worldY = shipY + offsetX * leftY + offsetY * forwardY
       = shipY + offsetX * sin(headingRad) + offsetY * (-cos(headingRad))

验证 heading=0：
- worldX = shipX + offsetX * cos(0) + offsetY * sin(0) = shipX + offsetX
  → offsetX正数向+X（右）？不对！左舷应该是-X（左）
- worldY = shipY + offsetX * sin(0) + offsetY * (-cos(0)) = shipY - offsetY
  → offsetY正数向-Y（上）正确！

// 问题：左舷正数应该向-X（屏幕左侧）
// 但公式给出的是+X

// 修正：X轴方向反转
// 定义改为：X轴右舷为正，左舷为负
// 或者公式改为：

worldX = shipX - offsetX * cos(headingRad) + offsetY * sin(headingRad)
worldY = shipY - offsetX * sin(headingRad) - offsetY * cos(headingRad)

验证 heading=0：
- worldX = shipX - offsetX * 1 + 0 = shipX - offsetX
  → offsetX正数向-X（左）正确！
- worldY = shipY - 0 - offsetY = shipY - offsetY
  → offsetY正数向-Y（上）正确！

验证 heading=90（船头向右）：
- worldX = shipX - offsetX * 0 + offsetY * 1 = shipX + offsetY
  → offsetY正数向+X（右）正确！船头向右
- worldY = shipY - offsetX * 1 - offsetY * 0 = shipY - offsetX
  → offsetX正数向-Y（上）正确！左舷向上
```

### 最终统一公式

```typescript
// 挂载点偏移坐标系定义：
// X轴：左舷为正（heading=0时指向屏幕左侧 -X）
// Y轴：船头为正（heading=0时指向屏幕上方 -Y）

// 世界坐标转换公式：
const headingRad = heading * Math.PI / 180;

const worldX = shipX - offsetX * Math.cos(headingRad) + offsetY * Math.sin(headingRad);
const worldY = shipY - offsetX * Math.sin(headingRad) - offsetY * Math.cos(headingRad);

// 验证：
// heading=0（船头向上）：
//   worldX = shipX - offsetX（左舷正→屏幕左侧-X）✓
//   worldY = shipY - offsetY（船头正→屏幕上方-Y）✓
// heading=90（船头向右）：
//   worldX = shipX + offsetY（船头正→屏幕右侧+X）✓
//   worldY = shipY - offsetX（左舷正→屏幕上方-Y）✓
```