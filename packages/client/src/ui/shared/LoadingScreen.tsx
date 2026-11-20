/**
 * LoadingScreen - 全屏加载态
 *
 * 统一终端风格：细环 + 等宽标签，避免各处复制内联 spinner。
 */

import React from "react";
import "./loading-screen.css";

interface LoadingScreenProps {
	label?: string;
	hint?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ label = "载入中", hint }) => (
	<div className="loading-screen" role="status" aria-live="polite">
		<div className="loading-screen__ring" aria-hidden="true" />
		<div className="loading-screen__label">{label}</div>
		{hint ? <div className="loading-screen__hint">{hint}</div> : null}
	</div>
);

export default LoadingScreen;
