# 贴图加载与渲染逻辑

## 1. 前端贴图处理工具

### 1.1 功能概述

前端提供贴图编辑工具，支持以下操作：

```
┌─────────────────────────────────────────────────────────────────┐
│                     贴图编辑工具                                 │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                     预览画布                              │   │
│  │                                                           │   │
│  │    ┌─────────────────────────────────────┐               │   │
│  │    │                                     │               │   │
│  │    │         [贴图预览]                  │               │   │
│  │    │         显示透明层网格              │               │   │
│  │    │         显示中心点标记              │               │   │
│  │    │         显示方向指示器              │               │   │
│  │    │                                     │               │   │
│  │    └─────────────────────────────────────┘               │   │
│  │                                                           │   │
│  │  尺寸: 256×256    中心: (128, 128)    方向: ↑             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                     工具栏                                │   │
│  │                                                           │   │
│  │  [去除背景]  [裁剪]  [扩展透明]  [缩放]  [旋转]  [保存]   │   │
│  │                                                           │   │
│  │  背景色选择: [▓▓▓] (点击选择/自动检测)                    │   │
│  │  目标尺寸:   [256] × [256]  px                            │   │
│  │  缩放比例:   [100] %                                      │   │
│  │  旋转角度:   [0] °                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 去除背景色

```typescript
interface RemoveBackgroundOptions {
  backgroundColor: string | null;  // 背景色，null表示自动检测
  tolerance: number;               // 颜色容差 (0-255)
  makeTransparent: boolean;        // 是否替换为透明
}

function removeBackground(
  imageData: ImageData,
  options: RemoveBackgroundOptions
): ImageData {
  const { data, width, height } = imageData;
  const result = new Uint8ClampedArray(data.length);
  
  // 自动检测背景色（取左上角像素）
  const bgColor = options.backgroundColor ?? detectBackgroundColor(imageData);
  
  // 解析背景色
  const bgR = parseInt(bgColor.slice(1, 3), 16);
  const bgG = parseInt(bgColor.slice(3, 5), 16);
  const bgB = parseInt(bgColor.slice(5, 7), 16);
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    
    // 计算与背景色的距离
    const distance = Math.sqrt(
      Math.pow(r - bgR, 2) +
      Math.pow(g - bgG, 2) +
      Math.pow(b - bgB, 2)
    );
    
    if (distance <= options.tolerance) {
      // 背景区域，设置为透明
      result[i] = r;
      result[i + 1] = g;
      result[i + 2] = b;
      result[i + 3] = 0;  // 透明
    } else {
      // 保留原像素
      result[i] = r;
      result[i + 1] = g;
      result[i + 2] = b;
      result[i + 3] = a;
    }
  }
  
  return new ImageData(result, width, height);
}

function detectBackgroundColor(imageData: ImageData): string {
  // 取四角像素，找最常见的颜色
  const { data, width, height } = imageData;
  const corners = [
    getPixelColor(data, 0, 0, width),               // 左上
    getPixelColor(data, width - 1, 0, width),       // 右上
    getPixelColor(data, 0, height - 1, width),      // 左下
    getPixelColor(data, width - 1, height - 1, width), // 右下
  ];
  
  // 返回最常见的颜色
  return corners[0]; // 简化：取左上角
}
```

### 1.3 裁剪与扩展透明层

```typescript
interface CropOptions {
  x: number;        // 裁剪起始X
  y: number;        // 裁剪起始Y
  width: number;    // 裁剪宽度
  height: number;   // 裁剪高度
}

interface ExtendOptions {
  targetWidth: number;   // 目标宽度
  targetHeight: number;  // 目标高度
  anchorX: number;       // 原图锚点X（中心点位置）
  anchorY: number;       // 原图锚点Y
  fillTransparent: boolean; // 扩展区域填充透明
}

function cropImage(imageData: ImageData, options: CropOptions): ImageData {
  const { data, width } = imageData;
  const { x, y, width: cropW, height: cropH } = options;
  
  const result = new Uint8ClampedArray(cropW * cropH * 4);
  
  for (let row = 0; row < cropH; row++) {
    for (let col = 0; col < cropW; col++) {
      const srcIdx = ((y + row) * width + (x + col)) * 4;
      const dstIdx = (row * cropW + col) * 4;
      
      result[dstIdx] = data[srcIdx];
      result[dstIdx + 1] = data[srcIdx + 1];
      result[dstIdx + 2] = data[srcIdx + 2];
      result[dstIdx + 3] = data[srcIdx + 3];
    }
  }
  
  return new ImageData(result, cropW, cropH);
}

function extendImage(imageData: ImageData, options: ExtendOptions): ImageData {
  const { data, width, height } = imageData;
  const { targetWidth, targetHeight, anchorX, anchorY } = options;
  
  const result = new Uint8ClampedArray(targetWidth * targetHeight * 4);
  
  // 计算原图在新画布中的位置（锚点对准中心）
  const offsetX = Math.floor(targetWidth / 2) - anchorX;
  const offsetY = Math.floor(targetHeight / 2) - anchorY;
  
  // 填充透明背景
  for (let i = 0; i < result.length; i += 4) {
    result[i] = 0;
    result[i + 1] = 0;
    result[i + 2] = 0;
    result[i + 3] = 0;  // 透明
  }
  
  // 复制原图像素
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const srcIdx = (row * width + col) * 4;
      
      const newX = col + offsetX;
      const newY = row + offsetY;
      
      if (newX >= 0 && newX < targetWidth && newY >= 0 && newY < targetHeight) {
        const dstIdx = (newY * targetWidth + newX) * 4;
        result[dstIdx] = data[srcIdx];
        result[dstIdx + 1] = data[srcIdx + 1];
        result[dstIdx + 2] = data[srcIdx + 2];
        result[dstIdx + 3] = data[srcIdx + 3];
      }
    }
  }
  
  return new ImageData(result, targetWidth, targetHeight);
}
```

### 1.4 缩放与预览

```typescript
interface ScaleOptions {
  scale: number;      // 缩放比例 (0.5 = 50%, 2.0 = 200%)
  smoothing: boolean; // 是否平滑插值
}

function scaleImage(imageData: ImageData, options: ScaleOptions): ImageData {
  const { data, width, height } = imageData;
  const { scale } = options;
  
  const newWidth = Math.floor(width * scale);
  const newHeight = Math.floor(height * scale);
  const result = new Uint8ClampedArray(newWidth * newHeight * 4);
  
  for (let row = 0; row < newHeight; row++) {
    for (let col = 0; col < newWidth; col++) {
      const srcX = Math.floor(col / scale);
      const srcY = Math.floor(row / scale);
      const srcIdx = (srcY * width + srcX) * 4;
      const dstIdx = (row * newWidth + col) * 4;
      
      result[dstIdx] = data[srcIdx];
      result[dstIdx + 1] = data[srcIdx + 1];
      result[dstIdx + 2] = data[srcIdx + 2];
      result[dstIdx + 3] = data[srcIdx + 3];
    }
  }
  
  return new ImageData(result, newWidth, newHeight);
}

// 预览渲染（带网格和标记）
function renderPreview(
  canvas: HTMLCanvasElement,
  imageData: ImageData,
  showGrid: boolean,
  showCenter: boolean,
  showDirection: boolean
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  // 清空画布
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // 绘制透明背景网格
  if (showGrid) {
    drawTransparencyGrid(ctx, canvas.width, canvas.height);
  }
  
  // 绘制贴图
  ctx.putImageData(imageData, 0, 0);
  
  // 绘制中心点标记
  if (showCenter) {
    const centerX = imageData.width / 2;
    const centerY = imageData.height / 2;
    
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX - 10, centerY);
    ctx.lineTo(centerX + 10, centerY);
    ctx.moveTo(centerX, centerY - 10);
    ctx.lineTo(centerX, centerY + 10);
    ctx.stroke();
  }
  
  // 绘制方向指示器（向上）
  if (showDirection) {
    const centerX = imageData.width / 2;
    
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, 20);
    ctx.lineTo(centerX - 8, 35);
    ctx.moveTo(centerX, 20);
    ctx.lineTo(centerX + 8, 35);
    ctx.stroke();
  }
}
```

---

## 2. 舰船贴图渲染逻辑

### 2.1 渲染坐标系

```
┌─────────────────────────────────────────────────────────────────┐
│                     舰船贴图渲染                                 │
│                                                                  │
│  贴图坐标系：                                                    │
│  ┌─────────────────────────────────────┐                        │
│  │                                     │                        │
│  │         (0, 0)                      │                        │
│  │            ↑                        │                        │
│  │            │                        │                        │
│  │            │ 船头方向               │                        │
│  │            │                        │                        │
│  │      ──────┼──────  中心点          │                        │
│  │            │  (width/2, height/2)   │                        │
│  │            │                        │                        │
│  │            ↓                        │                        │
│  │         (width, height)             │                        │
│  │                                     │                        │
│  └─────────────────────────────────────┘                        │
│                                                                  │
│  世界坐标系：                                                    │
│  ┌─────────────────────────────────────┐                        │
│  │                                     │                        │
│  │         Token位置                   │                        │
│  │            ↑                        │                        │
│  │            │ heading                │                        │
│  │            │ (船头朝向)             │                        │
│  │      ──────┼──────  center          │                        │
│  │            │  (position.x, y)       │                        │
│  │            │                        │                        │
│  │            ↓                        │                        │
│  │                                     │                        │
│  └─────────────────────────────────────┘                        │
│                                                                  │
│  映射规则：                                                      │
│  - 贴图中心点 (width/2, height/2) → Token中心点 (position.x, y) │
│  - 贴图向上方向 (Y轴负方向) → Token船头方向 (heading角度)        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 渲染实现

```typescript
interface TokenRenderConfig {
  position: { x: number; y: number };  // Token中心位置
  heading: number;                      // 船头朝向（角度，0=向上）
  texture: HTMLImageElement | null;     // 贴图
  textureWidth: number;                 // 贴图宽度
  textureHeight: number;                // 贴图高度
  scale: number;                        // 渲染缩放
}

function renderTokenTexture(
  ctx: CanvasRenderingContext2D,
  config: TokenRenderConfig
): void {
  if (!config.texture) return;
  
  const { position, heading, texture, textureWidth, textureHeight, scale } = config;
  
  // 1. 保存当前状态
  ctx.save();
  
  // 2. 移动到Token中心位置
  ctx.translate(position.x, position.y);
  
  // 3. 旋转（heading角度，顺时针）
  // 贴图默认向上（Y轴负方向），heading=0时不旋转
  ctx.rotate(heading * Math.PI / 180);
  
  // 4. 绘制贴图
  // 贴图中心点对准Token中心点，所以绘制位置需要偏移
  const renderWidth = textureWidth * scale;
  const renderHeight = textureHeight * scale;
  
  ctx.drawImage(
    texture,
    -renderWidth / 2,   // X偏移：贴图中心对准Token中心
    -renderHeight / 2,  // Y偏移：贴图中心对准Token中心
    renderWidth,
    renderHeight
  );
  
  // 5. 恢复状态
  ctx.restore();
}

// 示例：渲染舰船
function renderShip(
  ctx: CanvasRenderingContext2D,
  shipJson: ShipJSON
): void {
  const runtime = shipJson.runtime;
  if (!runtime) return;
  
  const textureAssetId = shipJson.ship.texture?.assetId;
  const texture = textureCache.get(textureAssetId);
  
  renderTokenTexture(ctx, {
    position: runtime.position,
    heading: runtime.heading,
    texture,
    textureWidth: shipJson.ship.texture?.width ?? 128,
    textureHeight: shipJson.ship.texture?.height ?? 128,
    scale: 1.0,
  });
}
```

### 2.3 贴图方向约定

```
┌─────────────────────────────────────────────────────────────────┐
│                     贴图方向约定                                 │
│                                                                  │
│  标准舰船贴图（heading = 0°）：                                   │
│  ┌─────────────────────────────────────┐                        │
│  │                                     │                        │
│  │              ↑                      │                        │
│  │              │                      │                        │
│  │             ██                      │                        │
│  │            ████                     │ ← 船头在贴图上方        │
│  │           ██████                    │                        │
│  │          ████████                   │                        │
│  │         ███████████                 │                        │
│  │        ████████████                 │                        │
│  │       ██████████████                │                        │
│  │      ████████████████               │ ← 船尾在贴图下方        │
│  │                                     │                        │
│  └─────────────────────────────────────┘                        │
│                                                                  │
│  heading = 90°（船头朝右）：                                      │
│  ┌─────────────────────────────────────┐                        │
│  │                                     │                        │
│  │      船尾 ← ──────────── → 船头     │                        │
│  │                                     │                        │
│  └─────────────────────────────────────┘                        │
│                                                                  │
│  heading = 180°（船头朝下）：                                     │
│  ┌─────────────────────────────────────┐                        │
│  │                                     │                        │
│  │      ████████████████               │ ← 船头在贴图下方        │
│  │       ██████████████                │                        │
│  │        ████████████                 │                        │
│  │         ███████████                 │                        │
│  │          ████████                   │                        │
│  │           ██████                    │                        │
│  │            ████                     │                        │
│  │             ██                      │                        │
│  │              │                      │                        │
│  │              ↓                      │                        │
│  │                                     │                        │
│  └─────────────────────────────────────┘                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. 武器贴图渲染逻辑

### 3.1 武器挂载点定义

```typescript
interface MountPoint {
  id: string;               // 挂载点ID
  type: "hardpoint" | "turret";  // 挂载点类型
  size: "SMALL" | "MEDIUM" | "LARGE";
  position: { x: number; y: number };  // 相对舰船中心的偏移
  facing: number;          // 挂载点朝向（角度）
  arc: number;             // 射界范围（度，左右各arc/2）
  weapon?: WeaponJSON;     // 当前挂载的武器
}

// 舰船规格中的挂载点定义示例
const shipSpec = {
  mounts: [
    {
      id: "mount_front_1",
      type: "hardpoint",
      size: "MEDIUM",
      position: { x: 0, y: -50 },  // 船头前方50像素
      facing: 0,                   // 朝向船头
      arc: 10,                     // 左右各10度
    },
    {
      id: "turret_left_1",
      type: "turret",
      size: "LARGE",
      position: { x: -30, y: 20 }, // 左侧偏后
      facing: 270,                 // 朝向左侧
      arc: 180,                    // 炮塔可旋转180度
    },
  ],
};
```

### 3.2 武器渲染坐标系

```
┌─────────────────────────────────────────────────────────────────┐
│                     武器贴图渲染                                 │
│                                                                  │
│  武器贴图坐标系：                                                │
│  ┌─────────────────────────────────────┐                        │
│  │                                     │                        │
│  │         (0, 0)                      │                        │
│  │            ↑                        │                        │
│  │            │                        │                        │
│  │            │ 武器前端               │                        │
│  │            │ (枪口/炮口)            │                        │
│  │      ──────┼──────  中心点          │                        │
│  │            │                        │                        │
│  │            ↓                        │                        │
│  │         (width, height)             │                        │
│  │                                     │                        │
│  └─────────────────────────────────────┘                        │
│                                                                  │
│  渲染规则：                                                      │
│  1. 武器贴图中心点 → 挂载点位置                                  │
│  2. 武器前端方向 → 挂载点朝向 + 武器当前指向                     │
│                                                                  │
│  挂载点位置计算：                                                │
│  mountWorldPosition = shipPosition + rotate(mountOffset, heading)│
│                                                                  │
│  武器朝向计算：                                                  │
│  weaponHeading = mountFacing + turretRotation (炮塔可旋转)       │
│                = mountFacing (硬点固定)                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 武器渲染实现

```typescript
interface WeaponRenderConfig {
  mountPosition: { x: number; y: number };  // 挂载点世界位置
  currentHeading: number;                    // 武器当前指向（开火时更新）
  weaponTexture: HTMLImageElement | null;    // 武器贴图
  textureWidth: number;
  textureHeight: number;
  scale: number;
}

function renderWeaponTexture(
  ctx: CanvasRenderingContext2D,
  config: WeaponRenderConfig
): void {
  if (!config.weaponTexture) return;
  
  const {
    mountPosition,
    currentHeading,
    weaponTexture,
    textureWidth,
    textureHeight,
    scale,
  } = config;
  
  ctx.save();
  
  // 1. 移动到挂载点位置
  ctx.translate(mountPosition.x, mountPosition.y);
  
  // 2. 旋转（统一使用 currentHeading）
  ctx.rotate(currentHeading * Math.PI / 180);
  
  // 3. 绘制武器贴图
  const renderWidth = textureWidth * scale;
  const renderHeight = textureHeight * scale;
  
  ctx.drawImage(
    weaponTexture,
    -renderWidth / 2,
    -renderHeight / 2,
    renderWidth,
    renderHeight
  );
  
  ctx.restore();
}

// 获取武器当前指向
function getWeaponCurrentHeading(
  weaponRuntime: WeaponRuntime | undefined
): number {
  // 开火后 currentHeading 指向目标
  // 未开火时使用默认值 0 或保持上次值
  return weaponRuntime?.currentHeading ?? 0;
}
```

### 3.4 武器贴图渲染规则

```
┌─────────────────────────────────────────────────────────────────┐
│                  武器贴图渲染规则（统一）                        │
│                                                                  │
│  所有武器贴图渲染逻辑统一：                                       │
│  - 贴图中心点 → 挂载点位置                                       │
│  - 贴图前端方向 → currentHeading（开火时指向目标）               │
│  - arc 仅用于游戏逻辑（射界判定），不影响渲染                    │
│                                                                  │
│  ┌─────────────────────────────────────┐                        │
│  │                                     │                        │
│  │            ████                     │                        │
│  │           ██████                    │                        │
│  │          ████████                   │ ← currentHeading        │
│  │         ██████████                  │   （指向目标）          │
│  │        ████████████                 │                        │
│  │                                     │                        │
│  └─────────────────────────────────────┘                        │
│                                                                  │
│  Schema 字段：                                                  │
│                                                                  │
│  MountSpec (挂载点规格):                                        │
│  {                                                              │
│    id: string,                  // 挂载点ID                     │
│    position: { x, y },          // 相对舰船中心的偏移            │
│    facing: number,              // 射界中心方向（度）            │
│    arc: number,                 // 射界范围（度）                │
│    size: "SMALL"|"MEDIUM"|"LARGE"                               │
│  }                                                              │
│                                                                  │
│  WeaponRuntime (武器运行时):                                    │
│  {                                                              │
│    mountId: string,             // 对应挂载点                   │
│    state: "READY"|"FIRED"|...,                                 │
│    currentHeading: number,      // 当前指向（渲染用）            │
│    cooldownRemaining: number    // 冷却剩余                     │
│  }                                                              │
│                                                                  │
│  currentHeading 更新逻辑：                                       │
│  - 开火时统一设置为指向目标的角度                                │
│  - currentHeading = angleBetween(attacker, target)              │
│  - 不影响游戏逻辑，仅用于渲染                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.5 武器尺寸匹配

```
武器尺寸匹配（SIZE_COMPATIBILITY）：
- LARGE mount: LARGE weapon only
- MEDIUM mount: MEDIUM or SMALL weapon
- SMALL mount: SMALL weapon only
```

---

## 4. 完整渲染流程

```typescript
// 主渲染循环
function renderGame(ctx: CanvasRenderingContext2D, gameState: GameRoomState): void {
  // 1. 清空画布
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  
  // 2. 渲染所有Token
  for (const [tokenId, tokenJson] of Object.entries(gameState.tokens)) {
    if (!tokenJson.runtime) continue;
    
    // 渲染舰船贴图
    renderShipTexture(ctx, tokenJson);
    
    // 渲染武器贴图
    renderShipWeapons(ctx, tokenJson);
    
    // 渲染护盾（如果有）
    if (tokenJson.runtime.shield?.active) {
      renderShield(ctx, tokenJson);
    }
  }
  
  // 3. 渲染选中Token的射界
  if (selectedTokenId) {
    renderWeaponArcs(ctx, gameState.tokens[selectedTokenId]);
  }
  
  // 4. 渲染选中武器攻击指示线
  if (selectedWeaponId && selectedTargetId) {
    renderAttackIndicator(ctx, selectedTokenId, selectedWeaponId, selectedTargetId);
  }
}

// 贴图缓存管理
class TextureCache {
  private cache = new Map<string, HTMLImageElement>();
  
  async load(assetId: string): Promise<HTMLImageElement | null> {
    if (this.cache.has(assetId)) {
      return this.cache.get(assetId)!;
    }
    
    // 通过 WebSocket 获取资产数据
    const response = await socket.emit("asset:get_data", { assetId });
    if (!response.success) return null;
    
    const img = new Image();
    img.src = `data:${response.mimeType};base64,${response.data}`;
    
    await new Promise(resolve => img.onload = resolve);
    
    this.cache.set(assetId, img);
    return img;
  }
  
  preloadAll(tokenJsonList: TokenJSON[]): Promise<void[]> {
    const promises: Promise<void>[] = [];
    
    for (const tokenJson of tokenJsonList) {
      // 加载舰船贴图
      const shipTextureId = tokenJson.ship.texture?.assetId;
      if (shipTextureId) {
        promises.push(this.load(shipTextureId).then(() => {}));
      }
      
      // 加载武器贴图
      for (const mount of tokenJson.ship.mounts ?? []) {
        const weaponTextureId = mount.weapon?.weapon?.texture?.assetId;
        if (weaponTextureId) {
          promises.push(this.load(weaponTextureId).then(() => {}));
        }
      }
    }
    
    return Promise.all(promises);
  }
}

const textureCache = new TextureCache();
```

---

## 5. 贴图格式要求

| 类型 | 格式 | 透明层 | 尺寸限制 |
|------|------|--------|----------|
| 舰船贴图 | PNG | 必须 | 64×64 ~ 1024×1024 |
| 武器贴图 | PNG | 必须 | 32×32 ~ 256×256 |
| 头像 | PNG/JPEG/GIF/WebP | 可选 | 32×32 ~ 512×512 |

### 透明层要求

舰船和武器贴图必须有透明层：
- 背景区域（船体外围）必须透明
- 船体/武器实体部分不透明
- 便于叠加渲染（护盾、特效等）