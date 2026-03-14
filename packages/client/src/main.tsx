import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";

import { store } from "@/store";
import i18n from "./locales"; // i18n 配置
import App from "./App";
import "./styles/fonts.css"; // 字体样式
import "./styles.css";

// 创建React Query客户端
const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 1000 * 60 * 5, // 5分钟
			retry: 1,
			refetchOnWindowFocus: false,
		},
	},
});



const root = ReactDOM.createRoot(
	document.getElementById("root") as HTMLElement,
);

root.render(
	<React.StrictMode>
		<Provider store={store}>
			<I18nextProvider i18n={i18n}>
				<QueryClientProvider client={queryClient}>
					<BrowserRouter>
						<App />
					</BrowserRouter>
				</QueryClientProvider>
			</I18nextProvider>
		</Provider>
	</React.StrictMode>,
);
