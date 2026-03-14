/**
 * 设计令牌
 * 定义颜色、间距、字体等统一样式变量
 */

export const tokens = {
	// 颜色系统
	colors: {
		// 主色调
		primary: {
			50: "#e6f0ff",
			100: "#b3d4ff",
			200: "#80b8ff",
			300: "#4d9cff",
			400: "#1a80ff",
			500: "#4a9eff",
			600: "#0066cc",
			700: "#004d99",
			800: "#003366",
			900: "#001a33",
		},
		// 危险色
		danger: {
			50: "#ffe6e6",
			100: "#ffb3b3",
			200: "#ff8080",
			300: "#ff4d4d",
			400: "#ff1a1a",
			500: "#ff4444",
			600: "#cc0000",
			700: "#990000",
			800: "#660000",
			900: "#330000",
		},
		// 成功色
		success: {
			50: "#e6ffe6",
			100: "#b3ffb3",
			200: "#80ff80",
			300: "#4aff4a",
			400: "#1aff1a",
			500: "#4ade80",
			600: "#00cc00",
			700: "#009900",
			800: "#006600",
			900: "#003300",
		},
		// 警告色
		warning: {
			50: "#fff8e6",
			100: "#ffe6b3",
			200: "#ffd480",
			300: "#ffc24d",
			400: "#ffb01a",
			500: "#fbbf24",
			600: "#cc8800",
			700: "#996600",
			800: "#664400",
			900: "#332200",
		},
		// 中性色
		neutral: {
			50: "#f8f8fc",
			100: "#e8e8f0",
			200: "#d0d0e0",
			300: "#b0b0c8",
			400: "#8a8aa8",
			500: "#6a6a88",
			600: "#4a4a68",
			700: "#3a3a52",
			800: "#2a2a3c",
			900: "#1a1a26",
		},
		// 背景色
		background: {
			primary: "#0a0a1a",
			secondary: "#141428",
			tertiary: "#1e1e3c",
			elevated: "#2a2a50",
		},
		// 边框色
		border: {
			subtle: "rgba(74, 158, 255, 0.2)",
			default: "rgba(74, 158, 255, 0.3)",
			strong: "rgba(74, 158, 255, 0.5)",
		},
	},

	// 间距系统 (px)
	spacing: {
		xs: 4,
		sm: 8,
		md: 16,
		lg: 24,
		xl: 32,
		"2xl": 48,
		"3xl": 64,
	},

	// 字体系统
	typography: {
		fontFamily: {
			sans: "'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif",
			mono: "'Fira Code', 'Consolas', 'Monaco', monospace",
		},
		fontSize: {
			xs: "10px",
			sm: "12px",
			md: "14px",
			lg: "16px",
			xl: "18px",
			"2xl": "20px",
			"3xl": "24px",
			"4xl": "32px",
		},
		fontWeight: {
			normal: 400,
			medium: 500,
			semibold: 600,
			bold: 700,
		},
		lineHeight: {
			tight: 1.25,
			normal: 1.5,
			relaxed: 1.75,
		},
	},

	// 圆角系统 (px)
	radius: {
		none: 0,
		sm: 4,
		md: 8,
		lg: 12,
		xl: 16,
		"2xl": 24,
		full: 9999,
	},

	// 阴影系统
	shadows: {
		sm: "0 1px 3px rgba(0, 0, 0, 0.3)",
		md: "0 4px 15px rgba(0, 0, 0, 0.4)",
		lg: "0 8px 25px rgba(0, 0, 0, 0.5)",
		xl: "0 12px 35px rgba(0, 0, 0, 0.6)",
		glow: {
			primary: "0 0 20px rgba(74, 158, 255, 0.3)",
			danger: "0 0 20px rgba(255, 68, 68, 0.3)",
			success: "0 0 20px rgba(74, 222, 128, 0.3)",
		},
	},

	// 过渡系统
	transitions: {
		fast: "150ms ease",
		normal: "250ms ease",
		slow: "350ms ease",
	},

	// 断点 (用于响应式设计)
	breakpoints: {
		sm: 640,
		md: 768,
		lg: 1024,
		xl: 1280,
		"2xl": 1536,
	},

	// 层级系统
	zIndex: {
		dropdown: 1000,
		sticky: 1100,
		fixed: 1200,
		modalBackdrop: 1300,
		modal: 1400,
		popover: 1500,
		tooltip: 1600,
	},
} as const;

/**
 * 工具函数：获取颜色值
 */
export function getColor(path: string): string {
	const keys = path.split(".");
	let value: unknown = tokens.colors;

	for (const key of keys) {
		if (value && typeof value === "object" && key in value) {
			value = (value as Record<string, unknown>)[key];
		} else {
			throw new Error(`Color path not found: ${path}`);
		}
	}

	return value as string;
}

/**
 * 工具函数：获取间距值
 */
export function getSpacing(key: keyof typeof tokens.spacing): number {
	return tokens.spacing[key];
}
