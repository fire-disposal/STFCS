# 资产组件规范与接口接入指南

## 概述

统一资产组件：AvatarPicker / ShipTexturePicker / WeaponTexturePicker
共享核心逻辑，仅配置差异（类型限制、尺寸限制）。

---

## WebSocket 接口

### 上传资产
```typescript
// Request
socket.emit('request', {
  event: 'asset:upload',
  requestId: string,
  payload: {
    type: 'avatar' | 'ship_texture' | 'weapon_texture',
    filename: string,
    mimeType: 'image/png' | 'image/jpeg',
    data: string,  // base64
    name?: string,
    description?: string,
  }
})

// Response
socket.on('response', {
  requestId,
  success: boolean,
  data?: { assetId: string },
  error?: { code: string, message: string }
})
```

### 列出资产
```typescript
// Request
socket.emit('request', {
  event: 'asset:list',
  requestId: string,
  payload: {
    type?: 'avatar' | 'ship_texture' | 'weapon_texture',  // 留空返回全部
    ownerId?: string,  // 留空返回所有公开资产
  }
})

// Response
{ assets: AssetListItem[] }
```

### 批量获取（含数据）
```typescript
// Request
socket.emit('request', {
  event: 'asset:batch_get',
  requestId: string,
  payload: {
    assetIds: string[],
    includeData: boolean,  // true = 返回base64数据
  }
})

// Response
{ results: { assetId, info: AssetListItem, data?: string }[] }
```

### 删除资产
```typescript
// Request
socket.emit('request', {
  event: 'asset:delete',
  requestId: string,
  payload: { assetId: string }
})
```

---

## 资产类型限制

```typescript
const ASSET_LIMITS = {
  avatar: {
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif'],
    maxFileSize: 512 * 1024,       // 512KB
    minWidth: 64, maxWidth: 512,
    minHeight: 64, maxHeight: 512,
  },
  ship_texture: {
    allowedMimeTypes: ['image/png'],  // 仅PNG（透明层）
    maxFileSize: 2 * 1024 * 1024,     // 2MB
    minWidth: 128, maxWidth: 1024,
    minHeight: 128, maxHeight: 1024,
  },
  weapon_texture: {
    allowedMimeTypes: ['image/png'],  // 仅PNG（透明层）
    maxFileSize: 1 * 1024 * 1024,     // 1MB
    minWidth: 32, maxWidth: 256,
    minHeight: 32, maxHeight: 256,
  },
}
```

---

## 组件规范

### 核心 Props

```typescript
interface AssetPickerProps {
  type: 'avatar' | 'ship_texture' | 'weapon_texture'
  value?: string            // 当前选中的 assetId
  onChange: (assetId: string) => void
  ownerId?: string          // 筛选特定用户的资产
  disabled?: boolean
  showPreview?: boolean     // 显示预览图
  allowUpload?: boolean     // 允许上传
  allowDelete?: boolean     // 允许删除（仅owner）
}
```

### 组件结构

```
AssetPicker
├── Preview         // 当前选中预览（带placeholder）
├── AssetGrid       // 已上传资产网格列表
│   └── AssetCard   // 单项（缩略图 + 名称 + 删除按钮）
├── UploadButton    // 上传触发
└── UploadModal     // 上传弹窗
    ├── FileDrop    // 文件拖拽/选择
    ├── Preview     // 上传前预览
    ├── Validate    // 客户端验证（尺寸/格式）
    └── Submit      // 确认上传
```

---

## 前端实现示例

### Socket Hook

```typescript
// hooks/useAssetSocket.ts
export function useAssetSocket() {
  const socket = useSocket()
  
  const upload = async (payload: AssetUploadPayload): Promise<string> => {
    const requestId = crypto.randomUUID()
    return new Promise((resolve, reject) => {
      socket.once('response', (res) => {
        if (res.requestId === requestId) {
          if (res.success) resolve(res.data.assetId)
          else reject(new Error(res.error.message))
        }
      })
      socket.emit('request', { event: 'asset:upload', requestId, payload })
    })
  }
  
  const list = async (type?: AssetType, ownerId?: string): Promise<AssetListItem[]> => {
    const requestId = crypto.randomUUID()
    return new Promise((resolve) => {
      socket.once('response', (res) => {
        if (res.requestId === requestId && res.success) {
          resolve(res.data.assets)
        }
      })
      socket.emit('request', { event: 'asset:list', requestId, payload: { type, ownerId } })
    })
  }
  
  const batchGet = async (assetIds: string[], includeData = false) => {
    const requestId = crypto.randomUUID()
    return new Promise((resolve) => {
      socket.once('response', (res) => {
        if (res.requestId === requestId && res.success) {
          resolve(res.data.results)
        }
      })
      socket.emit('request', { event: 'asset:batch_get', requestId, payload: { assetIds, includeData } })
    })
  }
  
  const deleteAsset = async (assetId: string): Promise<void> => {
    const requestId = crypto.randomUUID()
    return new Promise((resolve, reject) => {
      socket.once('response', (res) => {
        if (res.requestId === requestId) {
          if (res.success) resolve()
          else reject(new Error(res.error.message))
        }
      })
      socket.emit('request', { event: 'asset:delete', requestId, payload: { assetId } })
    })
  }
  
  return { upload, list, batchGet, deleteAsset }
}
```

### AssetPicker 组件

```tsx
// components/AssetPicker.tsx
import { useAssetSocket } from '../hooks/useAssetSocket'
import { ASSET_LIMITS } from '@vt/data'

export function AssetPicker({ type, value, onChange, ownerId }: AssetPickerProps) {
  const { upload, list, batchGet, deleteAsset } = useAssetSocket()
  const [assets, setAssets] = useState<AssetListItem[]>([])
  const [previewUrl, setPreviewUrl] = useState<string>()
  const [uploading, setUploading] = useState(false)
  const limits = ASSET_LIMITS[type]
  
  useEffect(() => {
    list(type, ownerId).then(setAssets)
  }, [type, ownerId])
  
  useEffect(() => {
    if (value) {
      batchGet([value], true).then((results) => {
        if (results[0]?.data) {
          setPreviewUrl(`data:image/png;base64,${results[0].data}`)
        }
      })
    } else {
      setPreviewUrl(undefined)
    }
  }, [value])
  
  const handleFileSelect = async (file: File) => {
    // 客户端验证
    if (!limits.allowedMimeTypes.includes(file.type as any)) {
      alert(`仅支持: ${limits.allowedMimeTypes.join(', ')}`)
      return
    }
    if (file.size > limits.maxFileSize) {
      alert(`文件过大: 最大 ${limits.maxFileSize / 1024}KB`)
      return
    }
    
    // 尺寸验证（加载图片）
    const img = new Image()
    img.src = URL.createObjectURL(file)
    await new Promise((resolve) => img.onload = resolve)
    if (img.width < limits.minWidth || img.height < limits.minHeight) {
      alert(`尺寸过小: 最小 ${limits.minWidth}x${limits.minHeight}`)
      return
    }
    if (img.width > limits.maxWidth || img.height > limits.maxHeight) {
      alert(`尺寸过大: 最大 ${limits.maxWidth}x${limits.maxHeight}`)
      return
    }
    
    // 上传
    setUploading(true)
    const base64 = await fileToBase64(file)
    try {
      const assetId = await upload({
        type,
        filename: file.name,
        mimeType: file.type,
        data: base64,
      })
      onChange(assetId)
      list(type, ownerId).then(setAssets)
    } catch (e) {
      alert(e.message)
    }
    setUploading(false)
  }
  
  const handleDelete = async (assetId: string) => {
    if (!confirm('确认删除?')) return
    await deleteAsset(assetId)
    if (value === assetId) onChange(undefined)
    list(type, ownerId).then(setAssets)
  }
  
  return (
    <div className="asset-picker">
      {/* 预览 */}
      <div className="preview">
        {previewUrl ? <img src={previewUrl} /> : <Placeholder type={type} />}
      </div>
      
      {/* 资产网格 */}
      <div className="grid">
        {assets.map((asset) => (
          <AssetCard
            key={asset.$id}
            asset={asset}
            selected={value === asset.$id}
            onSelect={() => onChange(asset.$id)}
            onDelete={asset.ownerId === currentUserId ? handleDelete : undefined}
          />
        ))}
      </div>
      
      {/* 上传 */}
      <FileDrop onSelect={handleFileSelect} accept={limits.allowedMimeTypes.join(',')} />
    </div>
  )
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string.split(',')[1])
    reader.readAsDataURL(file)
  })
}
```

### AssetCard 组件

```tsx
function AssetCard({ asset, selected, onSelect, onDelete }: AssetCardProps) {
  const [thumbUrl, setThumbUrl] = useState<string>()
  const { batchGet } = useAssetSocket()
  
  useEffect(() => {
    batchGet([asset.$id], true).then((results) => {
      if (results[0]?.data) {
        setThumbUrl(`data:image/png;base64,${results[0].data}`)
      }
    })
  }, [asset.$id])
  
  return (
    <div className={`card ${selected ? 'selected' : ''}`} onClick={onSelect}>
      <img src={thumbUrl} alt={asset.filename} />
      <span>{asset.metadata?.name ?? asset.filename}</span>
      {onDelete && <button onClick={() => onDelete(asset.$id)}>×</button>}
    </div>
  )
}
```

---

## 专用组件

### AvatarPicker

```tsx
export function AvatarPicker(props: Omit<AssetPickerProps, 'type'>) {
  return <AssetPicker type="avatar" {...props} />
}
```

### ShipTexturePicker

```tsx
export function ShipTexturePicker(props: Omit<AssetPickerProps, 'type'>) {
  return <AssetPicker type="ship_texture" {...props} />
}
```

### WeaponTexturePicker

```tsx
export function WeaponTexturePicker(props: Omit<AssetPickerProps, 'type'>) {
  return <AssetPicker type="weapon_texture" {...props} />
}
```

---

## 集成示例

### 玩家档案头像设置

```tsx
function ProfileEditor() {
  const [profile, setProfile] = useState({ avatarAssetId: undefined })
  const { updateProfile } = usePlayerProfile()
  
  return (
    <div>
      <AvatarPicker
        value={profile.avatarAssetId}
        onChange={(id) => {
          setProfile({ ...profile, avatarAssetId: id })
          updateProfile({ avatar: id })
        }}
      />
    </div>
  )
}
```

### 舰船编辑器贴图设置

```tsx
function ShipEditor({ ship }: { ship: TokenJSON }) {
  const [textureAssetId, setTextureAssetId] = useState(ship.token.texture?.assetId)
  
  const handleSave = () => {
    ship.token.texture = { assetId: textureAssetId }
    saveShip(ship)
  }
  
  return (
    <div>
      <ShipTexturePicker
        value={textureAssetId}
        onChange={setTextureAssetId}
        showPreview
        allowUpload
        allowDelete
      />
      <button onClick={handleSave}>保存</button>
    </div>
  )
}
```

### 武器编辑器贴图设置

```tsx
function WeaponEditor({ weapon }: { weapon: WeaponJSON }) {
  const [textureAssetId, setTextureAssetId] = useState(weapon.weapon.texture?.assetId)
  
  return (
    <WeaponTexturePicker
      value={textureAssetId}
      onChange={(id) => {
        weapon.weapon.texture = { assetId: id }
      }}
    />
  )
}
```

---

## 缓存策略

```typescript
// 全局缓存（避免重复请求）
const assetCache = new Map<string, { info: AssetListItem; data?: string }>()

// useCachedAsset hook
export function useCachedAsset(assetId: string | undefined) {
  const { batchGet } = useAssetSocket()
  
  return useQuery(
    ['asset', assetId],
    () => {
      if (!assetId) return null
      if (assetCache.has(assetId)) return assetCache.get(assetId)
      return batchGet([assetId], true).then((results) => {
        const item = results[0]
        if (item?.info) assetCache.set(assetId, item)
        return item
      })
    },
    { staleTime: 5 * 60 * 1000 }  // 5分钟
  )
}
```

---

## 错误处理

| Code | Message | 前端处理 |
|------|---------|----------|
| NOT_AUTHED | Please auth first | 跳转登录 |
| INVALID_TYPE | Invalid asset type | 提示格式错误 |
| ASSET_UPLOAD_FAILED | 文件验证失败 | 显示具体错误 |
| ASSET_NOT_FOUND | Asset not found | 清除引用 |
| NOT_OWNER | Only owner can delete | 禁用删除按钮 |

---

## 数据结构

```typescript
// AssetListItem（列表项）
interface AssetListItem {
  $id: string               // "avatar:uuid"
  type: AssetType
  filename: string
  mimeType: string
  size: number
  metadata?: {
    name?: string
    width?: number
    height?: number
  }
  ownerId: string
  uploadedAt: number
}

// Texture（贴图引用）
interface Texture {
  assetId?: string          // 引用 AssetListItem.$id
  offsetX?: number          // 渲染偏移
  offsetY?: number
  scale?: number
}
```

---

## 文件命名规范

- 头像：自由命名，建议 `{playerName}_avatar.png`
- 舰船：建议 `{shipName}_texture.png`
- 武器：建议 `{weaponName}_texture.png`

---

## 最佳实践

1. **预加载**：进入房间时调用 `room:get_assets` 批量加载
2. **缓存**：使用 Map/React Query 缓存，避免重复请求
3. **懒加载**：网格缩略图仅加载 info（不含 data），选中时加载 data
4. **客户端验证**：上传前验证尺寸/格式，减少服务器压力
5. **PNG优先**：舰船/武器强制PNG（透明层），头像可选JPEG