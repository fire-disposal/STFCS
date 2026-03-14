import React from "react";
import { useAppDispatch, useAppSelector } from "@/store";
import { setSelectedTool, toggleGrid, toggleCoordinates } from "@/store/slices/uiSlice";

interface ToolbarProps {
	selectedTool: string;
	onToolSelect: (tool: string) => void;
	onDisconnect: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
	selectedTool,
	onToolSelect,
	onDisconnect,
}) => {
	const dispatch = useAppDispatch();
	const { showGrid, showCoordinates } = useAppSelector((state) => state.ui);

	const tools = [
		{ id: "select", label: "Select", icon: "🖱️" },
		{ id: "pan", label: "Pan", icon: "✋" },
		{ id: "draw", label: "Draw", icon: "✏️" },
		{ id: "measure", label: "Measure", icon: "📏" },
		{ id: "place", label: "Place", icon: "📍" },
	];

	const handleToolClick = (toolId: string) => {
		onToolSelect(toolId);
		dispatch(setSelectedTool(toolId as any));
	};

	return (
		<div className="toolbar">
			<div className="toolbar-section">
				<div className="toolbar-title">Tools</div>
				<div className="tool-buttons">
					{tools.map((tool) => (
						<button
							key={tool.id}
							className={`tool-button ${selectedTool === tool.id ? "active" : ""}`}
							onClick={() => handleToolClick(tool.id)}
							title={tool.label}
						>
							<span className="tool-icon">{tool.icon}</span>
							<span className="tool-label">{tool.label}</span>
						</button>
					))}
				</div>
			</div>

			<div className="toolbar-section">
				<div className="toolbar-title">View</div>
				<div className="view-controls">
					<button
						className={`view-button ${showGrid ? "active" : ""}`}
						onClick={() => dispatch(toggleGrid())}
						title="Toggle Grid"
					>
						<span className="view-icon">📊</span>
						<span className="view-label">Grid</span>
					</button>
					<button
						className={`view-button ${showCoordinates ? "active" : ""}`}
						onClick={() => dispatch(toggleCoordinates())}
						title="Toggle Coordinates"
					>
						<span className="view-icon">📍</span>
						<span className="view-label">Coords</span>
					</button>
					<button
						className="view-button"
						onClick={() => {
							// 重置视图逻辑
							console.log("Reset view");
						}}
						title="Reset View"
					>
						<span className="view-icon">🔄</span>
						<span className="view-label">Reset</span>
					</button>
				</div>
			</div>

			<div className="toolbar-section">
				<div className="toolbar-title">Game</div>
				<div className="game-controls">
					<button
						className="game-button"
						onClick={() => {
							// 保存游戏状态
							console.log("Save game");
						}}
						title="Save Game"
					>
						<span className="game-icon">💾</span>
						<span className="game-label">Save</span>
					</button>
					<button
						className="game-button"
						onClick={() => {
							// 加载游戏状态
							console.log("Load game");
						}}
						title="Load Game"
					>
						<span className="game-icon">📂</span>
						<span className="game-label">Load</span>
					</button>
					<button
						className="game-button danger"
						onClick={onDisconnect}
						title="Disconnect"
					>
						<span className="game-icon">🚪</span>
						<span className="game-label">Disconnect</span>
					</button>
				</div>
			</div>

			<div className="toolbar-section">
				<div className="toolbar-title">Quick Actions</div>
				<div className="quick-actions">
					<button
						className="quick-action"
						onClick={() => {
							// 结束当前回合
							console.log("End turn");
						}}
						title="End Turn"
					>
						<span className="action-icon">⏭️</span>
						<span className="action-label">End Turn</span>
					</button>
					<button
						className="quick-action"
						onClick={() => {
							// 清除绘图
							console.log("Clear drawings");
						}}
						title="Clear Drawings"
					>
						<span className="action-icon">🧹</span>
						<span className="action-label">Clear Draw</span>
					</button>
					<button
						className="quick-action"
						onClick={() => {
							// 显示帮助
							console.log("Show help");
						}}
						title="Help"
					>
						<span className="action-icon">❓</span>
						<span className="action-label">Help</span>
					</button>
				</div>
			</div>
		</div>
	);
};

export default Toolbar;
