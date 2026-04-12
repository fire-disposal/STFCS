import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			"@": resolve(__dirname, "src"),
			"@vt/contracts": resolve(__dirname, "../contracts/src/index.ts"),
			"@vt/contracts/types": resolve(__dirname, "../contracts/src/types/index.ts"),
			"@vt/contracts/constants": resolve(__dirname, "../contracts/src/constants/index.ts"),
			"@vt/contracts/protocol": resolve(__dirname, "../contracts/src/protocol/index.ts"),
			"@vt/contracts/core-types": resolve(__dirname, "../contracts/src/core-types.ts"),
			"@vt/contracts/config": resolve(__dirname, "../contracts/src/config/index.ts"),
			"@vt/rules": resolve(__dirname, "../rules/src/index.ts"),
			"@vt/rules/math": resolve(__dirname, "../rules/src/math/index.ts"),
			"@vt/rules/data/ShipHullSchema": resolve(__dirname, "../rules/src/data/ShipHullSchema.ts"),
			"@vt/rules/data/WeaponSchema": resolve(__dirname, "../rules/src/data/WeaponSchema.ts"),
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
