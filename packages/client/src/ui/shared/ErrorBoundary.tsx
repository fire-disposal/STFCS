import React from "react";

interface ErrorBoundaryProps {
	children: React.ReactNode;
	fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
	error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = { error: null };
	}

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { error };
	}

	componentDidCatch(error: Error, info: React.ErrorInfo) {
		console.error("[ErrorBoundary]", error, info.componentStack);
	}

	render() {
		if (this.state.error) {
			return this.props.fallback ?? (
				<div style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					height: "100%",
					background: "#0a0a1a",
					color: "#c0c0d0",
					fontSize: 14,
					flexDirection: "column",
					gap: 12,
					padding: 40,
				}}>
					<h2 style={{ color: "#ff6f8f", margin: 0 }}>渲染错误</h2>
					<p style={{ color: "#8a8aa8", margin: 0, maxWidth: 400, textAlign: "center" }}>
						{this.state.error.message}
					</p>
				</div>
			);
		}
		return this.props.children;
	}
}
