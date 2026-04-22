/**
 * Services 层统一导出
 */

export { PresetLoader, PresetService } from "./preset/index.js";
export { ShipBuildService } from "./ship/index.js";
export { WeaponService } from "./weapon/index.js";
export {
	ComponentService,
	componentService,
	type ComponentType,
	type ComponentSpec,
	type ComponentRuntime,
} from "./component/index.js";
export {
	ModifierService,
	modifierService,
	type ModifierType,
	type ModifierTarget,
	type ModifierDef,
	type ActiveModifier,
} from "./modifier/index.js";

export { AssetService } from "./AssetService.js";
export { PlayerInfoService } from "./PlayerInfoService.js";
export { PlayerProfileService } from "./PlayerProfileService.js";
export { SimpleObjectCreationService } from "./SimpleObjectCreationService.js";