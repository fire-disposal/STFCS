/**
 * 共享样式模块
 * 提供常用的 CSS 类和样式工具
 */

/**
 * 通用面板样式
 */
export const panelStyles = {
	base: `
		padding: 12px;
		background: rgba(20, 20, 40, 0.7);
		border-radius: 4px;
		border: 1px solid rgba(74, 158, 255, 0.2);
	`,
	hover: `
		border-color: rgba(74, 158, 255, 0.4);
		box-shadow: 0 0 15px rgba(74, 158, 255, 0.1);
	`,
};

/**
 * 按钮样式变体
 */
export const buttonVariants = {
	primary: `
		background: rgba(74, 158, 255, 0.2);
		border: 1px solid #4a9eff;
		color: #aaccff;
	`,
	primaryHover: `
		background: rgba(74, 158, 255, 0.3);
		box-shadow: 0 0 15px rgba(74, 158, 255, 0.2);
	`,
	danger: `
		background: rgba(255, 68, 68, 0.2);
		border: 1px solid #ff4444;
		color: #ffaaaa;
	`,
	dangerHover: `
		background: rgba(255, 68, 68, 0.3);
		box-shadow: 0 0 15px rgba(255, 68, 68, 0.2);
	`,
	ghost: `
		background: transparent;
		border: 1px solid rgba(74, 158, 255, 0.2);
		color: #8a9ebf;
	`,
	ghostHover: `
		border-color: rgba(74, 158, 255, 0.4);
		color: #aaccff;
	`,
};

/**
 * 输入框样式
 */
export const inputStyles = `
	background: rgba(10, 10, 30, 0.8);
	border: 1px solid rgba(100, 100, 150, 0.3);
	border-radius: 4px;
	padding: 8px 12px;
	color: #c0c0d0;
	font-size: 14px;
	transition: all 0.2s ease;
`;

export const inputFocusStyles = `
	border-color: #4a9eff;
	box-shadow: 0 0 10px rgba(74, 158, 255, 0.2);
	outline: none;
`;

/**
 * 滚动条样式（Webkit）
 */
export const scrollbarStyles = `
	&::-webkit-scrollbar {
		width: 8px;
		height: 8px;
	}
	
	&::-webkit-scrollbar-track {
		background: rgba(10, 10, 30, 0.5);
		border-radius: 4px;
	}
	
	&::-webkit-scrollbar-thumb {
		background: rgba(74, 158, 255, 0.3);
		border-radius: 4px;
	}
	
	&::-webkit-scrollbar-thumb:hover {
		background: rgba(74, 158, 255, 0.5);
	}
`;

/**
 * 文本截断工具类
 */
export const textTruncate = `
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
`;

/**
 * 响应式工具
 */
export const responsiveHide = {
	sm: "@media (max-width: 640px) { display: none; }",
	md: "@media (max-width: 768px) { display: none; }",
	lg: "@media (max-width: 1024px) { display: none; }",
};

/**
 * 动画关键帧
 */
export const keyframes = {
	pulse: `
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	`,
	spin: `
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	`,
	slideIn: `
		from { transform: translateX(-100%); opacity: 0; }
		to { transform: translateX(0); opacity: 1; }
	`,
	fadeIn: `
		from { opacity: 0; }
		to { opacity: 1; }
	`,
	scaleIn: `
		from { transform: scale(0.9); opacity: 0; }
		to { transform: scale(1); opacity: 1; }
	`,
};

/**
 * 通用过渡效果
 */
export const transitions = {
	smooth: "transition: all 0.2s ease;",
	smoothSlow: "transition: all 0.35s ease;",
	instant: "transition: none;",
};
