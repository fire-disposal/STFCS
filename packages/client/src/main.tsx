import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";

import { store } from "@/store";
import App from "./App";
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
			<QueryClientProvider client={queryClient}>
				<BrowserRouter>
					<App />
				</BrowserRouter>
			</QueryClientProvider>
		</Provider>
	</React.StrictMode>,
);
