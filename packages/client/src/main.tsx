import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Theme } from "@radix-ui/themes";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";

import i18n from "./locales";
import App from "./App";
import "@radix-ui/themes/styles.css";
import "./styles/fonts.css";
import "./styles.css";
import { NotificationContainer } from "@/ui/shared/Notification";
import { ensureFontsReady } from "@/utils/fontLoader";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 1000 * 60 * 5,
			retry: 1,
			refetchOnWindowFocus: false,
		},
	},
});

async function main() {
	// 预加载 Fira Code 字体，确保 PixiJS Text 渲染前字体已就绪
	await ensureFontsReady();

	const root = ReactDOM.createRoot(
		document.getElementById("root") as HTMLElement,
	);

	root.render(
		<React.StrictMode>
			<I18nextProvider i18n={i18n}>
				<QueryClientProvider client={queryClient}>
					<Theme appearance="dark" accentColor="blue" grayColor="slate" radius="none">
						<BrowserRouter
							future={{
								v7_startTransition: true,
								v7_relativeSplatPath: true,
							}}
						>
							<App />
							<NotificationContainer />
						</BrowserRouter>
					</Theme>
				</QueryClientProvider>
			</I18nextProvider>
		</React.StrictMode>,
	);
}

main();