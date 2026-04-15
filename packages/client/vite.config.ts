import { resolve } from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			"@": resolve(__dirname, "src"),
			"@vt/data": resolve(__dirname, "../data/src/index.ts"),
			"@vt/rules": resolve(__dirname, "../rules/src/index.ts"),
		},
	},
	server: {
		port: 5173,
		strictPort: true,
		host: true,
		hmr: {
			protocol: "ws",
			host: "localhost",
			port: 5173,
			clientPort: 5173,
		},
	},
	build: {
		outDir: "dist",
		sourcemap: true,
		rollupOptions: {
			output: {
				manualChunks: {
					vendor: ["react", "react-dom", "react-router-dom"],
					ui: ["@pixi/react"],
					state: ["zustand"],
					graphics: ["pixi.js"],
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
			exclude: ["node_modules/", "src/test/", "**/*.d.ts", "**/*.config.*", "**/index.ts"],
		},
	},
});
