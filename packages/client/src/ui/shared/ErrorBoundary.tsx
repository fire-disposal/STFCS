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

	private handleRetry = () => {
		this.setState({ error: null });
	};

	render() {
		if (this.state.error) {
			return this.props.fallback ?? (
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						height: "100vh",
						background: "#0a0e14",
						color: "#c0c0d0",
						fontSize: 14,
						flexDirection: "column",
						gap: 12,
						padding: 40,
					}}
				>
					<h2 style={{ color: "#ff6f8f", margin: 0 }}>渲染错误</h2>
					<p style={{ color: "#8a8aa8", margin: 0, maxWidth: 480, textAlign: "center" }}>
						{this.state.error.message}
					</p>
					<div style={{ display: "flex", gap: 8 }}>
						<button
							type="button"
							onClick={this.handleRetry}
							style={{
								padding: "6px 14px",
								borderRadius: 4,
								border: "1px solid rgba(74,158,255,0.4)",
								background: "transparent",
								color: "#cfe8ff",
								cursor: "pointer",
							}}
						>
							重试渲染
						</button>
						<button
							type="button"
							onClick={() => window.location.reload()}
							style={{
								padding: "6px 14px",
								borderRadius: 4,
								border: "1px solid rgba(255,111,143,0.4)",
								background: "transparent",
								color: "#ff6f8f",
								cursor: "pointer",
							}}
						>
							重新载入
						</button>
					</div>
				</div>
			);
		}
		return this.props.children;
	}
}
