/**
 * 舰船应用层模块
 */

export { ShipService } from './ShipService';
export type { CreateShipCommand, MoveShipCommand, MoveShipResult, IShipService } from './ShipService';
export { ShipFactory, getShipFactory, resetShipFactory } from './ShipFactory';
export type { ShipFactoryOptions } from './ShipFactory';
export { ShipInstanceService } from './ShipInstanceService';
export type { CreateShipInstanceParams, ShipInstanceResult } from './ShipInstanceService';