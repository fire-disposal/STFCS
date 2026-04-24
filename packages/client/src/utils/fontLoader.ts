/**
 * 字体预加载工具
 *
 * 确保 Fira Code 等字体在 PixiJS 创建 Text 对象之前已加载完成。
 * PixiJS 的 Text 使用 Canvas2D 渲染，依赖浏览器字体加载状态。
 * 如果字体未加载，PixiJS 会使用回退字体，且不会在字体加载后自动重绘。
 *
 * 使用 document.fonts API（CSS Font Loading API）等待字体加载。
 */

const FONT_CONFIGS = [
    { family: "Fira Code", weight: "400", style: "normal" },
    { family: "Fira Code", weight: "500", style: "normal" },
    { family: "Fira Code", weight: "700", style: "normal" },
] as const;

/**
 * 预加载所有已通过 @font-face 注册的字体
 * 返回一个 Promise，在所有字体加载完成后 resolve
 */
export function preloadFonts(): Promise<void[]> {
    // 检查浏览器是否支持 CSS Font Loading API
    if (typeof document === "undefined" || !document.fonts) {
        console.warn("[fontLoader] document.fonts API not available, skipping font preload");
        return Promise.resolve([]);
    }

    const loadPromises = FONT_CONFIGS.map(({ family, weight, style }) => {
        // 使用 document.fonts.load 触发字体加载
        // 参数: (font, text) - font 格式同 CSS font 简写
        return document.fonts.load(`${style} ${weight} 1em "${family}"`).then(
            (loadedFonts) => {
                if (loadedFonts.length > 0) {
                    console.log(`[fontLoader] Font loaded: ${family} weight=${weight}`);
                } else {
                    console.warn(`[fontLoader] Font not found: ${family} weight=${weight}`);
                }
            },
            (error) => {
                console.warn(`[fontLoader] Failed to load font: ${family} weight=${weight}`, error);
            }
        );
    });

    return Promise.all(loadPromises);
}

/**
 * 等待字体就绪 + 额外延迟确保 PixiJS 缓存更新
 * 在应用初始化时调用
 */
export async function ensureFontsReady(): Promise<void> {
    try {
        await preloadFonts();
        // 等待一帧，确保 PixiJS 的 Canvas 缓存更新
        await new Promise((resolve) => requestAnimationFrame(resolve));
    } catch (error) {
        console.warn("[fontLoader] Font preload failed, will use fallback fonts", error);
    }
}
