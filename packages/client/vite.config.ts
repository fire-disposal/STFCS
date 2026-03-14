import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			"@": resolve(__dirname, "src"),
			"@vt/shared": resolve(__dirname, "../shared/src"),
			"@vt/shared/ws": resolve(__dirname, "../shared/src/ws/index.ts"),
			"@vt/shared/types": resolve(__dirname, "../shared/src/types/index.ts"),
		},
	},
	server: {
		port: 5173,
		host: true,
		proxy: {
			"/api": {
				target: "http://localhost:3000",
				changeOrigin: true,
				secure: false,
			},
			"/ws": {
				target: "ws://localhost:3000",
				ws: true,
				changeOrigin: true,
				secure: false,
			},
		},
	},
	build: {
		outDir: "dist",
		sourcemap: true,
		rollupOptions: {
			output: {
				manualChunks: {
					vendor: ["react", "react-dom", "react-router-dom"],
					ui: ["@pixi/react", "react-konva", "framer-motion"],
					state: ["@reduxjs/toolkit", "react-redux", "zustand"],
					graphics: ["pixi.js", "konva"],
				},
			},
		},
	},
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: ["./src/test/setup.ts"],
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			exclude: [
				"node_modules/",
				"src/test/",
				"**/*.d.ts",
				"**/*.config.*",
				"**/index.ts",
			],
		},
	},
});
