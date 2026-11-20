/**
 * 剪贴板：navigator.clipboard 只在安全上下文可用，
 * 纯 HTTP 部署（公网 IP）下退回 textarea + execCommand。
 */
export async function copyText(text: string): Promise<boolean> {
	try {
		if (navigator.clipboard?.writeText) {
			await navigator.clipboard.writeText(text);
			return true;
		}
	} catch {
		// 权限或安全上下文限制，继续用回退路径
	}

	const textarea = document.createElement("textarea");
	textarea.value = text;
	textarea.setAttribute("readonly", "");
	textarea.style.position = "fixed";
	textarea.style.opacity = "0";
	textarea.style.pointerEvents = "none";
	document.body.appendChild(textarea);
	textarea.select();
	try {
		return document.execCommand("copy");
	} catch {
		return false;
	} finally {
		textarea.remove();
	}
}
