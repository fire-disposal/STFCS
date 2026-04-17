/**
 * TextureSection - 贴图管理区
 *
 * 管理舰船贴图：
 * - 来源选择（URL/上传/预设）
 * - 透明色设置
 * - 贴图定位（中心点对齐）
 * - 缩放调整
 */

import React, { useState, useCallback, useRef } from "react";
import { Upload, Link, Palette, Move, ZoomIn } from "lucide-react";
import type { TextureConfig, TextureSourceTypeValue } from "@vt/data";
import { DEFAULT_TEXTURE_CONFIG } from "@vt/data";

interface TextureSectionProps {
	textureConfig: TextureConfig;
	onChange: (config: TextureConfig) => void;
	disabled?: boolean;
	shipWidth: number;
	shipLength: number;
}

export const TextureSection: React.FC<TextureSectionProps> = ({
	textureConfig,
	onChange,
	disabled = false,
	shipWidth,
	shipLength,
}) => {
	// URL输入状态
	const [urlInput, setUrlInput] = useState<string>("");
	// 文件上传ref
	const fileInputRef = useRef<HTMLInputElement>(null);

	// 更新贴图配置
	const updateConfig = useCallback(
		(updates: Partial<TextureConfig>) => {
			onChange({ ...textureConfig, ...updates });
		},
		[textureConfig, onChange]
	);

	// 切换来源类型
	const handleSourceTypeChange = useCallback(
		(type: TextureSourceTypeValue) => {
			updateConfig({ sourceType: type, source: "" });
		},
		[updateConfig]
	);

	// URL导入
	const handleUrlImport = useCallback(() => {
		if (!urlInput.trim()) return;
		updateConfig({ sourceType: "url", source: urlInput.trim() });
	}, [urlInput, updateConfig]);

	// 文件上传
	const handleFileUpload = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			const file = event.target.files?.[0];
			if (!file) return;

			// 检查文件类型
			if (!file.type.startsWith("image/")) {
				alert("请选择图片文件");
				return;
			}

			// 转换为Base64
			const reader = new FileReader();
			reader.onload = (e) => {
				const base64 = e.target?.result as string;
				updateConfig({ sourceType: "uploaded", source: base64 });
			};
			reader.readAsDataURL(file);
		},
		[updateConfig]
	);

	// 透明色设置
	const handleTransparentColorChange = useCallback(
		(color: string) => {
			updateConfig({ transparentColor: color });
		},
		[updateConfig]
	);

	// 容差调整
	const handleToleranceChange = useCallback(
		(tolerance: number) => {
			updateConfig({ transparencyTolerance: tolerance });
		},
		[updateConfig]
	);

	// 偏移调整
	const handleOffsetChange = useCallback(
		(axis: "x" | "y", value: number) => {
			if (axis === "x") {
				updateConfig({ offsetX: value });
			} else {
				updateConfig({ offsetY: value });
			}
		},
		[updateConfig]
	);

	// 缩放调整
	const handleScaleChange = useCallback(
		(scale: number) => {
			updateConfig({ scale });
		},
		[updateConfig]
	);

	// 预设颜色选择
	const presetColors = ["#FFFFFF", "#000000", "#808080", "#C0C0C0", "#FF00FF"];

	return (
		<div className="ship-customization-texture-section">
			{/* 来源选择 */}
			<div className="ship-customization-texture-source">
				<div className="ship-customization-texture-source__tabs">
					<button
						className={`ship-customization-texture-source__tab ${
							textureConfig.sourceType === "url" ? "active" : ""
						}`}
						onClick={() => handleSourceTypeChange("url")}
						disabled={disabled}
					>
						<Link className="ship-customization-texture-source__tab-icon" />
						URL
					</button>
					<button
						className={`ship-customization-texture-source__tab ${
							textureConfig.sourceType === "uploaded" ? "active" : ""
						}`}
						onClick={() => handleSourceTypeChange("uploaded")}
						disabled={disabled}
					>
						<Upload className="ship-customization-texture-source__tab-icon" />
						上传
					</button>
					<button
						className={`ship-customization-texture-source__tab ${
							textureConfig.sourceType === "preset" ? "active" : ""
						}`}
						onClick={() => handleSourceTypeChange("preset")}
						disabled={disabled}
					>
						<Palette className="ship-customization-texture-source__tab-icon" />
						预设
					</button>
					<button
						className={`ship-customization-texture-source__tab ${
							textureConfig.sourceType === "none" ? "active" : ""
						}`}
						onClick={() => handleSourceTypeChange("none")}
						disabled={disabled}
					>
						无
					</button>
				</div>

				{/* URL输入 */}
				{textureConfig.sourceType === "url" && (
					<div className="ship-customization-texture-source__url">
						<input
							className="ship-customization-field__input"
							type="text"
							value={urlInput}
							onChange={(e) => setUrlInput(e.target.value)}
							placeholder="输入图片URL"
							disabled={disabled}
						/>
						<button
							className="ship-customization-panel__button ship-customization-panel__button--primary"
							onClick={handleUrlImport}
							disabled={disabled || !urlInput.trim()}
						>
							加载
						</button>
					</div>
				)}

				{/* 文件上传 */}
				{textureConfig.sourceType === "uploaded" && (
					<div className="ship-customization-texture-source__upload">
						<input
							ref={fileInputRef}
							type="file"
							accept="image/*"
							onChange={handleFileUpload}
							style={{ display: "none" }}
							disabled={disabled}
						/>
						<button
							className="ship-customization-panel__button ship-customization-panel__button--primary"
							onClick={() => fileInputRef.current?.click()}
							disabled={disabled}
						>
							<Upload className="ship-customization-panel__button-icon" />
							选择文件
						</button>
						{textureConfig.source && (
							<span className="ship-customization-texture-source__status">
								已加载 ({Math.round(textureConfig.source.length / 1024)}KB)
							</span>
						)}
					</div>
				)}

				{/* 预设选择 */}
				{textureConfig.sourceType === "preset" && (
					<div className="ship-customization-texture-source__preset">
						<span className="ship-customization-empty">预设贴图功能待实现</span>
					</div>
				)}
			</div>

			{/* 贴图预览 */}
			{textureConfig.source && (
				<div className="ship-customization-texture-preview">
					<img
						className="ship-customization-texture-preview__image"
						src={textureConfig.source}
						alt="舰船贴图"
						style={{
							transform: `translate(${textureConfig.offsetX}px, ${textureConfig.offsetY}px) scale(${textureConfig.scale})`,
						}}
					/>
					<div className="ship-customization-texture-preview__center" />
					{/* 透明色效果预览 */}
					{textureConfig.transparentColor && (
						<div className="ship-customization-texture-preview__transparency-indicator">
							透明色: {textureConfig.transparentColor}
						</div>
					)}
				</div>
			)}

			{/* 透明色设置 */}
			{textureConfig.source && (
				<div className="ship-customization-texture-transparency">
					<div className="ship-customization-section__title" style={{ fontSize: "9px" }}>
						<Palette className="ship-customization-section__title-icon" />
						透明色设置
					</div>
					<div className="ship-customization-section__grid">
						{/* 预设颜色选择 */}
						<div className="ship-customization-field">
							<label className="ship-customization-field__label">预设颜色</label>
							<div className="ship-customization-texture-colors">
								{presetColors.map((color) => (
									<button
										key={color}
										className={`ship-customization-texture-color ${
											textureConfig.transparentColor === color ? "active" : ""
										}`}
										style={{ backgroundColor: color }}
										onClick={() => handleTransparentColorChange(color)}
										disabled={disabled}
									/>
								))}
							</div>
						</div>
						{/* 自定义颜色输入 */}
						<div className="ship-customization-field">
							<label className="ship-customization-field__label">自定义颜色</label>
							<input
								className="ship-customization-field__input"
								type="text"
								value={textureConfig.transparentColor || ""}
								onChange={(e) => handleTransparentColorChange(e.target.value)}
								placeholder="#FFFFFF"
								disabled={disabled}
							/>
						</div>
						{/* 容差调整 */}
						<div className="ship-customization-field">
							<label className="ship-customization-field__label">容差 (0-255)</label>
							<input
								className="ship-customization-field__input"
								type="number"
								value={textureConfig.transparencyTolerance || 32}
								onChange={(e) => handleToleranceChange(Number(e.target.value))}
								min={0}
								max={255}
								disabled={disabled}
							/>
						</div>
						{/* 清除透明色 */}
						{textureConfig.transparentColor && (
							<button
								className="ship-customization-panel__button ship-customization-panel__button--secondary"
								onClick={() => handleTransparentColorChange("")}
								disabled={disabled}
							>
								清除
							</button>
						)}
					</div>
				</div>
			)}

			{/* 定位调整 */}
			{textureConfig.source && (
				<div className="ship-customization-texture-positioning">
					<div className="ship-customization-section__title" style={{ fontSize: "9px" }}>
						<Move className="ship-customization-section__title-icon" />
						贴图定位
					</div>
					<div className="ship-customization-section__grid">
						<div className="ship-customization-field">
							<label className="ship-customization-field__label">X偏移</label>
							<input
								className="ship-customization-field__input"
								type="number"
								value={textureConfig.offsetX}
								onChange={(e) => handleOffsetChange("x", Number(e.target.value))}
								disabled={disabled}
							/>
						</div>
						<div className="ship-customization-field">
							<label className="ship-customization-field__label">Y偏移</label>
							<input
								className="ship-customization-field__input"
								type="number"
								value={textureConfig.offsetY}
								onChange={(e) => handleOffsetChange("y", Number(e.target.value))}
								disabled={disabled}
							/>
						</div>
					</div>
				</div>
			)}

			{/* 缩放调整 */}
			{textureConfig.source && (
				<div className="ship-customization-texture-scale">
					<div className="ship-customization-section__title" style={{ fontSize: "9px" }}>
						<ZoomIn className="ship-customization-section__title-icon" />
						缩放比例
					</div>
					<div className="ship-customization-field">
						<input
							className="ship-customization-field__input ship-customization-field__input--slider"
							type="range"
							value={textureConfig.scale}
							onChange={(e) => handleScaleChange(Number(e.target.value))}
							min={0.1}
							max={3}
							step={0.1}
							disabled={disabled}
							style={{ width: "100%" }}
						/>
						<span className="ship-customization-field__value">
							{(textureConfig.scale * 100).toFixed(0)}%
						</span>
					</div>
				</div>
			)}
		</div>
	);
};

export default TextureSection;