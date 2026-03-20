import { Ship } from "../../domain/ship/Ship";
import type { ShipConfig, ShipMovementPhase, MovementValidationResult } from "../../domain/ship/types";
import type { ShipEvent } from "../../domain/ship/events";
import type { ShipStatus as DomainShipStatus } from "../../domain/ship/ShipStatus";
import type { ShipStatus, ShipMovement, Result } from "@vt/shared/types";
import { WS_MESSAGE_TYPES } from "@vt/shared/ws";
import type { WSMessage } from "@vt/shared/ws";
import type { RoomManager } from "../../infrastructure/ws/RoomManager";
import { BaseService } from "../common/BaseService";

export interface MoveShipCommand {
	shipId: string;
	phase: ShipMovementPhase;
	type: "straight" | "strafe" | "rotate";
	distance?: number;
	angle?: number;
}

export type MoveShipResult = Result<undefined> & { validation?: MovementValidationResult };

export interface CreateShipCommand {
	id: string;
	initialPosition: { x: number; y: number };
	initialHeading: number;
	speed: number;
	maneuverability: number;
	armor: Record<string, { maxValue: number; initialValue?: number }>;
	flux: {
		capacity: number;
		dissipation: number;
		initialSoftFlux?: number;
		initialHardFlux?: number;
	};
	shield?: {
		type: "FRONT" | "OMNI";
		radius: number;
		centerOffset: { x: number; y: number };
		coverageAngle: number;
		efficiency: number;
		maintenanceCost: number;
	};
}

export interface IShipService {
	createShip(config: CreateShipCommand): Ship;
	getShip(shipId: string): Ship | undefined;
	moveShip(shipId: string, command: MoveShipCommand): Promise<MoveShipResult>;
	toggleShield(shipId: string): Promise<boolean>;
	enableShield(shipId: string): Promise<boolean>;
	disableShield(shipId: string): Promise<boolean>;
	ventShip(shipId: string): Promise<boolean>;
	dissipateFlux(shipId: string, amount?: number): Promise<boolean>;
	completeVent(shipId: string): Promise<boolean>;
	resetOverload(shipId: string): Promise<boolean>;
	setFlux(shipId: string, softFlux: number, hardFlux: number): Promise<boolean>;
	getShipStatus(shipId: string): ShipStatus | undefined;
	subscribeToEvents(handler: (events: ShipEvent[]) => void): void;
}

export class ShipService extends BaseService implements IShipService {
	private _ships: Map<string, Ship>;
	private _eventHandlers: Array<(events: ShipEvent[]) => void>;

	constructor() {
		super();
		this._ships = new Map();
		this._eventHandlers = [];
	}

	createShip(config: CreateShipCommand): Ship {
		const domainConfig: ShipConfig = {
			id: config.id,
			initialPosition: config.initialPosition,
			initialHeading: config.initialHeading,
			speed: config.speed,
			maneuverability: config.maneuverability,
			armor: config.armor as ShipConfig["armor"],
			flux: config.flux,
			shield: config.shield
				? {
						type: config.shield.type,
						radius: config.shield.radius,
						centerOffset: config.shield.centerOffset,
						coverageAngle: config.shield.coverageAngle,
						efficiency: config.shield.efficiency,
						maintenanceCost: config.shield.maintenanceCost,
					}
				: undefined,
		};

		const ship = new Ship(domainConfig);
		this._ships.set(config.id, ship);
		return ship;
	}

	getShip(shipId: string): Ship | undefined {
		return this._ships.get(shipId);
	}

	async moveShip(shipId: string, command: MoveShipCommand): Promise<MoveShipResult> {
		const ship = this._ships.get(shipId);
		if (!ship) {
			return { success: false, error: "Ship not found" };
		}

		let displacement = { x: 0, y: 0 };
		let rotation = 0;

		if (command.type === "straight" || command.type === "strafe") {
			const distance = command.distance ?? 0;
			const headingRad = (ship.heading * Math.PI) / 180;

			if (command.type === "straight") {
				displacement = {
					x: Math.cos(headingRad) * distance,
					y: Math.sin(headingRad) * distance,
				};
			} else {
				displacement = {
					x: -Math.sin(headingRad) * distance,
					y: Math.cos(headingRad) * distance,
				};
			}
		} else if (command.type === "rotate") {
			rotation = command.angle ?? 0;
		}

		const validation = ship.validateMovement(displacement, rotation, command.phase);
		if (!validation.isValid) {
			return {
				success: false,
				error: validation.reason ?? "Unknown error",
				validation,
			};
		}

		const success = ship.move(displacement, rotation, command.phase);
		if (success) {
			this._broadcastShipEvents(ship);
		}

		return {
			success: true,
			data: undefined,
			validation,
		};
	}

	async toggleShield(shipId: string): Promise<boolean> {
		const ship = this._ships.get(shipId);
		if (!ship || !ship.shield) {
			return false;
		}

		ship.toggleShield();
		ship.payShieldMaintenance();
		this._broadcastShipEvents(ship);
		return true;
	}

	async enableShield(shipId: string): Promise<boolean> {
		const ship = this._ships.get(shipId);
		if (!ship || !ship.shield) {
			return false;
		}

		ship.enableShield();
		ship.payShieldMaintenance();
		this._broadcastShipEvents(ship);
		return true;
	}

	async disableShield(shipId: string): Promise<boolean> {
		const ship = this._ships.get(shipId);
		if (!ship || !ship.shield) {
			return false;
		}

		ship.disableShield();
		this._broadcastShipEvents(ship);
		return true;
	}

	async ventShip(shipId: string): Promise<boolean> {
		const ship = this._ships.get(shipId);
		if (!ship) {
			return false;
		}

		const success = ship.beginVent();
		if (success) {
			this._broadcastShipEvents(ship);
		}
		return success;
	}

	/**
	 * 执行辐能下降
	 */
	async dissipateFlux(shipId: string, amount?: number): Promise<boolean> {
		const ship = this._ships.get(shipId);
		if (!ship) {
			return false;
		}

		const dissipationAmount = amount ?? ship.flux.dissipation;
		ship.flux.dissipateSoftFlux(dissipationAmount);
		this._broadcastShipEvents(ship);
		return true;
	}

	/**
	 * 完成主动排散（辐能清空）
	 */
	async completeVent(shipId: string): Promise<boolean> {
		const ship = this._ships.get(shipId);
		if (!ship) {
			return false;
		}

		ship.flux.clearFlux();
		ship.endVent();
		this._broadcastShipEvents(ship);
		return true;
	}

	/**
	 * 重置过载状态
	 */
	async resetOverload(shipId: string): Promise<boolean> {
		const ship = this._ships.get(shipId);
		if (!ship) {
			return false;
		}

		// 过载恢复后，辐能降至容量的一半
		const newFlux = Math.floor(ship.flux.capacity / 2);
		ship.flux.setFlux(newFlux, 0);
		ship.recoverFromOverload();
		this._broadcastShipEvents(ship);
		return true;
	}

	/**
	 * 设置辐能值
	 */
	async setFlux(shipId: string, softFlux: number, hardFlux: number): Promise<boolean> {
		const ship = this._ships.get(shipId);
		if (!ship) {
			return false;
		}

		ship.flux.setFlux(softFlux, hardFlux);
		this._broadcastShipEvents(ship);
		return true;
	}

	getShipStatus(shipId: string): ShipStatus | undefined {
		const ship = this._ships.get(shipId);
		if (!ship) {
			return undefined;
		}

		const totalArmor = Array.from(ship.armorQuadrants.values()).reduce(
			(sum, q) => sum + q.value,
			0
		);
		const maxArmor = Array.from(ship.armorQuadrants.values()).reduce(
			(sum, q) => sum + q.maxValue,
			0
		);

		const armorQuadrantsMap: Record<string, number> = {};
		for (const [type, quadrant] of ship.armorQuadrants.entries()) {
			const key = type.toLowerCase().replace(/_/g, "_");
			armorQuadrantsMap[key] = quadrant.value;
		}

		return {
			id: ship.id,
			hull: {
				current: totalArmor,
				max: maxArmor,
			},
			armor: {
				quadrants: armorQuadrantsMap as Record<string, number>,
				maxArmor,
				maxQuadArmor: Math.max(...Object.values(armorQuadrantsMap), 0),
			},
			flux: {
				current: ship.flux.current,
				capacity: ship.flux.capacity,
				dissipation: ship.flux.dissipation,
				softFlux: ship.flux.softFlux,
				hardFlux: ship.flux.hardFlux,
			},
			fluxState: this._mapFluxState(ship.flux.state),
			shield: {
				type: ship.shield?.type === "FRONT" ? "front" : "full",
				radius: ship.shield?.radius ?? 0,
				centerOffset: ship.shield?.centerOffset ?? { x: 0, y: 0 },
				coverageAngle: ship.shield?.coverageAngle ?? 0,
				efficiency: ship.shield?.efficiency ?? 0,
				maintenanceCost: ship.shield?.maintenanceCost ?? 0,
				active: ship.shield?.isActive ?? false,
				current: 0,
				max: 0,
			},
			position: ship.position,
			heading: ship.heading,
			speed: ship.speed,
			maneuverability: ship.maneuverability,
			disabled: ship.status === "OVERLOADED" || ship.status === "DISABLED",
			actionsPerTurn: 3,
			remainingActions: 3,
		};
	}

	subscribeToEvents(handler: (events: ShipEvent[]) => void): void {
		this._eventHandlers.push(handler);
	}

	private _broadcastShipEvents(ship: Ship): void {
		const events = ship.events;
		if (events.length === 0) {
			return;
		}

		for (const event of events) {
			if (this._roomManager) {
				switch (event.type) {
					case "SHIP_MOVED": {
						const movement: ShipMovement = {
							shipId: event.shipId,
							phase: event.phase,
							type: event.phase === 2 ? "rotate" : "straight",
							angle: event.phase === 2 ? event.newHeading - event.previousHeading : undefined,
							newX: event.newPosition.x,
							newY: event.newPosition.y,
							newHeading: event.newHeading,
							timestamp: event.timestamp,
						};
						this._broadcastToShipRoom(ship.id, {
							type: WS_MESSAGE_TYPES.SHIP_MOVED,
							payload: movement,
						});
						break;
					}

					case "SHIELD_TOGGLED": {
						const status = this.getShipStatus(ship.id);
						if (status) {
							this._broadcastToShipRoom(ship.id, {
								type: WS_MESSAGE_TYPES.SHIELD_UPDATE,
								payload: {
									shipId: ship.id,
									active: event.isActive,
									type: status.shield.type,
									coverageAngle: status.shield.coverageAngle,
								},
							});
						}
						break;
					}

					case "FLUX_OVERLOADED": {
						this._broadcastToShipRoom(ship.id, {
							type: WS_MESSAGE_TYPES.FLUX_STATE,
							payload: {
								shipId: event.shipId,
								fluxState: "overloaded",
								currentFlux: event.fluxLevel,
								softFlux: event.fluxLevel,
								hardFlux: 0,
							},
						});
						break;
					}

					case "SHIELD_MAINTENANCE": {
						const status = this.getShipStatus(ship.id);
						if (status) {
							this._broadcastToShipRoom(ship.id, {
								type: WS_MESSAGE_TYPES.FLUX_STATE,
								payload: {
									shipId: ship.id,
									fluxState: this._mapFluxState(ship.flux.state),
									currentFlux: ship.flux.current,
									softFlux: ship.flux.softFlux,
									hardFlux: ship.flux.hardFlux,
								},
							});
						}
						break;
					}
				}
			}
		}

		for (const handler of this._eventHandlers) {
			handler(events);
		}

		ship.clearEvents();
	}

	private _broadcastToShipRoom(shipId: string, message: WSMessage): void {
		if (!this._roomManager) {
			return;
		}

		const room = this._roomManager.getRoom("default");
		if (room) {
			this._roomManager.broadcastToRoom("default", message);
		}
	}

	private _mapFluxState(state: DomainShipStatus): "normal" | "venting" | "overloaded" {
		switch (state) {
			case "VENTING":
				return "venting";
			case "OVERLOADED":
				return "overloaded";
			case "DISABLED":
			case "NORMAL":
				return "normal";
			default: {
				// 使用 exhaustive check 确保类型安全
				const exhaustiveCheck: never = state;
				return exhaustiveCheck;
			}
		}
	}
}

export default ShipService;
