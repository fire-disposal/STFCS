/**
 * 舰船应用层模块
 */

export { ShipService } from './ShipService';
export type { CreateShipCommand, MoveShipCommand, MoveShipResult, IShipService } from './ShipService';
export { ShipFactory, getShipFactory, resetShipFactory } from './ShipFactory';
export type { ShipFactoryOptions } from './ShipFactory';