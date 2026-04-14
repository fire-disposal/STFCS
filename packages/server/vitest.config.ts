import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		include: ["src/**/*.{test,spec}.{ts,js}"],
	},
	resolve: {
		alias: {
			"@vt/types": path.resolve(__dirname, "../types/src"),
			"@vt/data": path.resolve(__dirname, "../data/src"),
			"@vt/rules": path.resolve(__dirname, "../rules/src"),
		},
	},
});
