import { Container, Graphics, Sprite, Texture, BlurFilter } from "pixi.js";

/**
 * 背景渲染器配置
 */
export interface BackgroundConfig {
	width: number;
	height: number;
	backgroundColor?: number;
	starCount?: number;
	nebulaCount?: number;
	showGrid?: boolean;
}

/**
 * 默认背景配置
 */
const DEFAULT_BACKGROUND_CONFIG: BackgroundConfig = {
	width: 4096,
	height: 4096,
	backgroundColor: 0x050510,
	starCount: 800,
	nebulaCount: 5,
	showGrid: true,
};

/**
 * 星空层级配置
 * 视差系数越小，看起来越远（移动越慢）
 */
const STAR_LAYERS = [
	// 远景层：非常远的星星，几乎不动
	{ count: 300, sizeMin: 0.3, sizeMax: 1.0, brightnessMin: 0.2, brightnessMax: 0.6, parallax: 0.05, color: 0x667799 },
	// 中景层：中等距离的星星
	{ count: 400, sizeMin: 0.8, sizeMax: 2.0, brightnessMin: 0.4, brightnessMax: 0.9, parallax: 0.1, color: 0xffffff },
	// 近景层：相对较近的星星，稍微明显移动
	{ count: 200, sizeMin: 1.5, sizeMax: 3.0, brightnessMin: 0.6, brightnessMax: 1.0, parallax: 0.2, color: 0xaaccff },
];

/**
 * 渲染星空背景（带视差效果）
 * @param layer 背景图层
 * @param config 背景配置
 * @param cameraPosition 相机位置（用于视差）
 */
export function renderBackground(
	layer: Container,
	config: BackgroundConfig,
	cameraPosition?: { centerX: number; centerY: number; zoom: number }
): void {
	layer.removeChildren();

	const cfg = { ...DEFAULT_BACKGROUND_CONFIG, ...config };
	const camera = cameraPosition || { centerX: 0, centerY: 0, zoom: 1 };

	// 1. 创建深空渐变背景
	const background = createDeepSpaceBackground(cfg);
	layer.addChild(background);

	// 2. 创建星云层（底层）
	const nebulaLayer = createNebulaLayer(cfg);
	nebulaLayer.position.x = -camera.centerX * 0.1;
	nebulaLayer.position.y = -camera.centerY * 0.1;
	layer.addChild(nebulaLayer);

	// 3. 创建多层星空（带视差）
	STAR_LAYERS.forEach((starLayer, index) => {
		const stars = createStarLayer(starLayer, cfg, camera);
		stars.position.x = -camera.centerX * starLayer.parallax;
		stars.position.y = -camera.centerY * starLayer.parallax;
		layer.addChild(stars);
	});

	// 4. 添加闪烁效果
	addStarTwinkling(layer, cfg);
}

/**
 * 创建深空渐变背景
 */
function createDeepSpaceBackground(config: BackgroundConfig): Graphics {
	const background = new Graphics();
	
	// 创建渐变效果
	const gradient = background.context;
	const centerX = config.width / 2;
	const centerY = config.height / 2;
	
	background.rect(0, 0, config.width, config.height);
	background.fill({
		color: config.backgroundColor!,
		alpha: 1.0,
	});

	// 添加微妙的紫色/蓝色渐变光晕
	const glow = new Graphics();
	glow.circle(centerX, centerY, Math.max(config.width, config.height) * 0.6);
	glow.fill({
		color: 0x1a1a3e,
		alpha: 0.3,
	});
	glow.blendMode = "screen";

	return background;
}

/**
 * 创建星云层
 */
function createNebulaLayer(config: BackgroundConfig): Container {
	const nebulaContainer = new Container();
	const nebulaCount = config.nebulaCount ?? 5;
	const nebulaPositions = generateNebulaPositions(nebulaCount, config.width, config.height, 54321);

	nebulaPositions.forEach(({ x, y, radius, color }) => {
		const nebula = new Graphics();
		nebula.circle(x, y, radius);
		
		// 添加模糊效果
		const blurFilter = new BlurFilter({ strength: 8 });
		nebula.filters = [blurFilter];
		
		nebula.fill({ color, alpha: 0.08 });
		nebula.blendMode = "screen";
		nebulaContainer.addChild(nebula);

		// 添加第二层更淡的星云
		const nebula2 = new Graphics();
		nebula2.circle(x + radius * 0.3, y + radius * 0.2, radius * 0.7);
		nebula2.filters = [blurFilter];
		nebula2.fill({ color, alpha: 0.05 });
		nebula2.blendMode = "screen";
		nebulaContainer.addChild(nebula2);
	});

	return nebulaContainer;
}

/**
 * 创建单层星空
 */
function createStarLayer(
	layerConfig: typeof STAR_LAYERS[0],
	config: BackgroundConfig,
	camera: { centerX: number; centerY: number; zoom: number }
): Container {
	const starContainer = new Container();
	const starPositions = generateStarPositions(
		layerConfig.count,
		config.width,
		config.height,
		12345 + layerConfig.count // 不同层级使用不同种子
	);

	starPositions.forEach(({ x, y, size, brightness }) => {
		const star = new Graphics();
		star.circle(x, y, size * (layerConfig.sizeMax - layerConfig.sizeMin) / 2 + layerConfig.sizeMin);
		star.fill({ 
			color: layerConfig.color, 
			alpha: brightness * (layerConfig.brightnessMax - layerConfig.brightnessMin) / 2 + layerConfig.brightnessMin
		});
		
		// 添加发光效果
		star.filters = [new BlurFilter({ strength: size * 0.3 })];
		
		starContainer.addChild(star);
	});

	return starContainer;
}

/**
 * 添加星星闪烁效果（使用固定种子确保所有玩家看到相同的闪烁）
 */
function addStarTwinkling(layer: Container, config: BackgroundConfig): void {
	// 在 PixiJS ticker 中更新星星透明度
	// 这里只标记需要闪烁的星星
	const allChildren = layer.children.flat();
	let starIndex = 0;
	allChildren.forEach((child) => {
		if (child instanceof Graphics) {
			// 使用固定种子生成闪烁参数，确保所有客户端一致
			const twinkleSeed = 12345 + starIndex;
			const twinkleSpeed = 0.02 + ((twinkleSeed * 1664525 + 1013904223) % 4294967296) / 4294967296 * 0.03;
			const twinkleOffset = ((twinkleSeed * 1103515245 + 12345) % 4294967296) / 4294967296 * Math.PI * 2;
			(child as any).twinkleSpeed = twinkleSpeed;
			(child as any).twinkleOffset = twinkleOffset;
			starIndex++;
		}
	});
}

/**
 * 更新背景（包括相机位置用于视差效果）
 */
export function updateBackground(
	layer: Container,
	config: BackgroundConfig,
	cameraPosition?: { centerX: number; centerY: number; zoom: number }
): void {
	renderBackground(layer, config, cameraPosition);
}

/**
 * 更新视差位置（在相机移动时调用）
 * 视差系数越小，物体看起来越远
 */
export function updateParallax(
	layer: Container,
	cameraPosition: { centerX: number; centerY: number; zoom: number },
	config: BackgroundConfig
): void {
	// 更新星云层位置（非常远的背景，几乎不动）
	const nebulaLayer = layer.children[1] as Container;
	if (nebulaLayer) {
		nebulaLayer.position.x = -cameraPosition.centerX * 0.02;
		nebulaLayer.position.y = -cameraPosition.centerY * 0.02;
	}

	// 更新各层星空位置（视差系数很小，营造深远空间感）
	STAR_LAYERS.forEach((starLayer, index) => {
		const starContainer = layer.children[index + 2] as Container;
		if (starContainer) {
			starContainer.position.x = -cameraPosition.centerX * starLayer.parallax;
			starContainer.position.y = -cameraPosition.centerY * starLayer.parallax;
		}
	});
}

/**
 * 生成星星位置（使用种子确保一致性）
 */
function generateStarPositions(
	count: number,
	width: number,
	height: number,
	seed: number
): Array<{ x: number; y: number; size: number; brightness: number }> {
	const positions: Array<{ x: number; y: number; size: number; brightness: number }> = [];
	let random = seed;

	const lcg = () => {
		random = (random * 1664525 + 1013904223) % 4294967296;
		return random / 4294967296;
	};

	for (let i = 0; i < count; i++) {
		positions.push({
			x: lcg() * width,
			y: lcg() * height,
			size: lcg() * 1.5 + 0.5,
			brightness: lcg() * 0.5 + 0.5,
		});
	}

	return positions;
}

/**
 * 生成星云位置（使用种子确保一致性）
 */
function generateNebulaPositions(
	count: number,
	width: number,
	height: number,
	seed: number
): Array<{ x: number; y: number; radius: number; color: number }> {
	const positions: Array<{ x: number; y: number; radius: number; color: number }> = [];
	let random = seed;

	const lcg = () => {
		random = (random * 1664525 + 1013904223) % 4294967296;
		return random / 4294967296;
	};

	const colors = [0x1a2b5e, 0x2d1b5e, 0x5e1b2d, 0x1b5e5e, 0x5e2d1b];

	for (let i = 0; i < count; i++) {
		positions.push({
			x: lcg() * width,
			y: lcg() * height,
			radius: lcg() * 300 + 150,
			color: colors[Math.floor(lcg() * colors.length)],
		});
	}

	return positions;
}
