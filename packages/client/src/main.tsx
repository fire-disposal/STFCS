import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";

import i18n from "./locales";
import App from "./App";
import "./styles/fonts.css";
import "./styles.css";
import { MagneticPointerProvider } from "@/ui/shared/MagneticPointer";
import { NotificationContainer } from "@/ui/shared/Notification";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 1000 * 60 * 5,
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
		<I18nextProvider i18n={i18n}>
			<QueryClientProvider client={queryClient}>
				<BrowserRouter
					future={{
						v7_startTransition: true,
						v7_relativeSplatPath: true,
					}}
				>
					<MagneticPointerProvider>
						<App />
						<NotificationContainer />
					</MagneticPointerProvider>
				</BrowserRouter>
			</QueryClientProvider>
		</I18nextProvider>
	</React.StrictMode>,
);