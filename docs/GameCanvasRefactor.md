/**
 * GameCanvas 相机系统重构方案
 * 
 * 核心原则：
 * 1. Redux 是唯一数据源
 * 2. cameraRef 直接镜像 Redux 状态
 * 3. 交互直接修改 cameraRef 并通知 Redux
 * 4. ticker 从 cameraRef 读取并应用动画
 */

// 问题 1: cameraState 计算错误
// ❌ 错误：在组件内定义 defaultCamera，与 Redux 不一致
const defaultCamera = { centerX: 0, centerY: 0, ... };
const cameraState = externalCamera || defaultCamera;

// ✅ 正确：直接从 Redux 读取
const cameraState = useAppSelector((state) => state.camera.local);

// 问题 2: cameraRef 同步逻辑
// ❌ 错误：复杂的 useEffect 依赖
useEffect(() => {
  if (!externalCamera) {
    cameraRef.current = { ... };
  }
}, [cameraState, externalCamera]);

// ✅ 正确：简单直接的同步
useEffect(() => {
  cameraRef.current = {
    centerX: cameraState.centerX,
    centerY: cameraState.centerY,
    zoom: cameraState.zoom,
    // ...
  };
}, [cameraState]);

// 问题 3: 交互处理
// ✅ 正确：使用 ref 存储可变状态
const stateRef = useRef({
  isDragging: false,
  dragStart: { x: 0, y: 0 },
  lastCameraPos: { x: 0, y: 0 },
});

// 在事件处理中直接修改 ref
stateRef.current.isDragging = true;

// 问题 4: 背景视差
// ✅ 确保 BackgroundRenderer 使用正确的类型
updateParallax(layer, { centerX, centerY, zoom }, config);
