# 远行星号桌面推演系统 (Starsector Tabletop VTT) 开发参考文档

## 1. 核心数据结构 (Data Schema)

### 1.1 舰船 Token (Ship Token)

每个 Token 是一个独立的实体，包含以下可自定义属性：

* **基础属性**：
* `Hull_Max` / `Hull_Current`: 结构值（生命值）。
* `Armor_Max` / `Armor_Current[6]`: 6个象限（各60°）的独立护甲值。
* `Flux_Max` / `Flux_Dissipation`: 辐能容量与每回合基础辐散值。
* `Flux_Soft` / `Flux_Hard`: 当前软/硬辐能记录值。


* **机动属性**：
* `Speed_X`: 基础航速（单阶段移动单位）。
* `Turn_Rate_Y`: 单回合最大转向角度。


* **防护属性**：
* `Shield_Type`: 前盾（固定中心点）/ 全盾（自由中心点）。
* `Shield_Arc`: 护盾覆盖角度。
* `Shield_Radius`: 护盾圆周半径。
* `Shield_Efficiency`: 护盾吸收伤害转化为硬辐能的倍率。
* `Shield_Up_Cost`: 护盾维持产生的软辐能/每回合。


* **逻辑状态**：
* `Is_Overloaded`: 是否处于过载状态（持续至下回合结束）。
* `Heading`: 船头朝向（0-359°）。
* `Shield_Orientation`: 护盾中心朝向。



### 1.2 武器系统 (Weapon System)

武器作为子对象挂载于 Token 的插槽（Slot）上：

* **静态数据**：`Name`, `Damage_Type` (动能/高爆/破片/能量), `Damage_Per_Shot`, `Projectiles_Per_Burst`, `Range_Base`, `Flux_Per_Burst`, `Is_PD` (点防御)。
* **动态数据**：`Slot_Type` (挂载点/炮塔), `Arc_Limit` (挂载点±10°，炮塔自定义)。

---

## 2. 坐标与移动逻辑 (Movement Logic)

### 2.1 空间模型

* **二维平面坐标系**：支持像素或自定义单位，非方格限制。
* **中轴线定义**：Token 必须拥有明确的中心点 (Origin) 和中轴线 (Vector_Forward)。

### 2.2 三阶段移动算法

每回合移动必须严格遵守以下顺序：

1. **平移阶段 A**：沿当前 `Heading` 前进/后退（最大 $2X$），或沿中轴线切线横移（最大 $X$）。
2. **转向阶段**：原地旋转，最大角度为 $Y$。
3. **平移阶段 B**：重复阶段 A 的逻辑，沿**新朝向**前进/后退或横移。

---

## 3. 战斗与伤害结算 (Combat & Damage)

### 3.1 射界判定

* **测距**：实时计算 Token A 中心与 Token B 中心（或边缘）的距离 $L$。
* **有效射程**：$Range_{Real} = Range_{Base} \times Multiplier_{Global}$。
* **射界判定**：判断目标 Token 是否落在武器设定的扇形区域（Arc）内。

### 3.2 伤害公式 (Damage Calculation)

系统根据用户选择的攻击目标和象限自动计算：

1. **修正系数判定**：
| 伤害类型 | 穿甲强度 (Z) | 对盾伤害 (Y) |
| :--- | :--- | :--- |
| **高爆 (HE)** | $X \times 2.0$ | $X \times 0.5$ |
| **动能 (KIN)** | $X \times 0.5$ | $X \times 2.0$ |
| **破片 (FRAG)** | $X \times 0.25$ | $X \times 0.25$ |
| **能量 (NRG)** | $X$ | $X$ |
2. **护盾阶段**：
* 若判定命中护盾：产生硬辐能 $= Y \times Shield\_Efficiency$。
* 硬辐能无法通过回合步进排散，除非关闭护盾。


3. **护甲阶段**（若未开盾或不在护盾范围内）：
* 计算护甲 $C = \max(B, A \times Min\_Reduction\_Ratio)$。
* 基础伤害 $D = X \times \frac{Z}{Z + C}$。
* **减伤上限检查**：若 $\frac{X-D}{X} > Max\_Reduction\_Ratio$，则 $D = X \times (1 - Max\_Reduction\_Ratio)$。



---

## 4. 辐能机制 (Flux Mechanics)

* **回合更新**：
* `Flux_Total = (Flux_Soft + Flux_Hard)`。
* 若未过载：`Flux_Soft = max(0, Flux_Soft - Flux_Dissipation)`。
* **注意**：开启护盾时仍可排散软辐能。


* **过载 (Overload)**：
* 当 `Flux_Total >= Flux_Max` 时触发。
* 效果：无法移动、无法开火、护盾强制关闭。
* 恢复：下回合结束时，`Flux_Total = Flux_Max / 2`。


* **主动排散 (Venting)**：
* 本回合放弃所有行动（禁盾、禁火）。
* 效果：`Flux_Soft = 0`, `Flux_Hard = 0`。



---

## 5. 开发建议与交互需求 (VTT Features)

### 5.1 视觉层 (Visuals)

* **实时反馈**：点击 Token 显示各武器射程扇形（半透明蒙版）。
* **状态条**：Token 上方常驻显示 `Hull`（绿色/红色）和 `Flux`（蓝色/白色）进度条。
* **护甲视图**：侧边栏或悬浮窗显示 6 象限护甲剩余数值。

### 5.2 自定义系统 (Customization)

* **贴图导入**：支持 PNG/SVG 导入并自动设置中心点。
* **全局修正**：提供一个 Master Panel，可一键调整所有单位的 `Global_Range_Mod` 或 `Global_Damage_Taken_Mod`。

---
