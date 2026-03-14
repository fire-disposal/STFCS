/** @type {import('tailwindcss').Config} */
export default {
	content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
	darkMode: "class",
	theme: {
		extend: {
			colors: {
				// 太空主题颜色
				space: {
					50: "#f0f2ff",
					100: "#e0e4ff",
					200: "#c7cfff",
					300: "#a5b4fc",
					400: "#818cf8",
					500: "#6366f1",
					600: "#4f46e5",
					700: "#4338ca",
					800: "#3730a3",
					900: "#312e81",
					950: "#1e1b4b",
				},
				// 游戏UI颜色
				game: {
					primary: "#4a9eff",
					secondary: "#aaccff",
					accent: "#ff6b6b",
					success: "#4ade80",
					warning: "#fbbf24",
					danger: "#ef4444",
					info: "#3b82f6",
				},
				// 深色主题
				dark: {
					bg: "#0a0a1a",
					surface: "#151530",
					border: "#1a1a3e",
					text: "#c0c0d0",
					"text-secondary": "#8a8aa8",
				},
				// 护盾颜色
				shield: {
					front: "#4a9eff",
					full: "#3b82f6",
					broken: "#ef4444",
				},
				// 通量颜色
				flux: {
					soft: "#60a5fa",
					hard: "#f59e0b",
					overload: "#ef4444",
				},
			},
			fontFamily: {
				sans: [
					"-apple-system",
					"BlinkMacSystemFont",
					"Segoe UI",
					"Roboto",
					"Oxygen",
					"Ubuntu",
					"Cantarell",
					"Fira Sans",
					"Droid Sans",
					"Helvetica Neue",
					"sans-serif",
				],
				mono: [
					"source-code-pro",
					"Menlo",
					"Monaco",
					"Consolas",
					"Courier New",
					"monospace",
				],
				"game-ui": ["Orbitron", "sans-serif"],
			},
			animation: {
				"pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
				"pulse-shield": "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
				"spin-slow": "spin 3s linear infinite",
				float: "float 6s ease-in-out infinite",
				glow: "glow 2s ease-in-out infinite",
				scan: "scan 4s linear infinite",
				blink: "blink 1s step-end infinite",
			},
			keyframes: {
				float: {
					"0%, 100%": { transform: "translateY(0)" },
					"50%": { transform: "translateY(-10px)" },
				},
				glow: {
					"0%, 100%": { opacity: "1" },
					"50%": { opacity: "0.5" },
				},
				scan: {
					"0%": { transform: "translateY(-100%)" },
					"100%": { transform: "translateY(100%)" },
				},
				blink: {
					"0%, 100%": { opacity: "1" },
					"50%": { opacity: "0" },
				},
			},
			backdropBlur: {
				xs: "2px",
			},
			boxShadow: {
				game: "0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)",
				"game-lg":
					"0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.3)",
				"game-inner": "inset 0 2px 4px 0 rgba(0, 0, 0, 0.6)",
				glow: "0 0 20px rgba(74, 158, 255, 0.5)",
				"glow-red": "0 0 20px rgba(239, 68, 68, 0.5)",
				"glow-green": "0 0 20px rgba(74, 222, 128, 0.5)",
			},
			backgroundImage: {
				"space-gradient":
					"linear-gradient(135deg, #0a0a1a 0%, #151530 50%, #1a1a3e 100%)",
				"shield-gradient":
					"radial-gradient(circle, rgba(74, 158, 255, 0.1) 0%, transparent 70%)",
				"flux-gradient":
					"linear-gradient(90deg, #60a5fa 0%, #f59e0b 50%, #ef4444 100%)",
				"grid-pattern":
					"linear-gradient(rgba(74, 158, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(74, 158, 255, 0.1) 1px, transparent 1px)",
			},
			spacing: {
				128: "32rem",
				144: "36rem",
				160: "40rem",
			},
			borderRadius: {
				game: "0.5rem",
				"game-lg": "1rem",
				"game-xl": "1.5rem",
			},
			borderWidth: {
				3: "3px",
				5: "5px",
			},
		},
	},
	plugins: [],
};
