/**
 * MongoDB 存储导出
 */

import mongoose from "mongoose";
import { models } from "./Schemas.js";
import { MongoBaseRepository } from "./MongoBaseRepository.js";
import type { ShipBuild, UserProfile, RoomArchive } from "../types.js";
import type { WeaponBuild } from "../memory/MemoryWeaponRepository.js";

export type MongoConfig = {
	uri: string;
	dbName?: string;
};

export async function connectMongo(config: MongoConfig): Promise<void> {
	await mongoose.connect(config.uri, { dbName: config.dbName ?? "stfcs" });
	console.log(`[MongoDB] Connected to ${config.dbName ?? "stfcs"}`);
}

export async function disconnectMongo(): Promise<void> {
	await mongoose.disconnect();
	console.log("[MongoDB] Disconnected");
}

export const mongoRepositories = {
	ships: new MongoBaseRepository<ShipBuild>(models.ShipBuild),
	weapons: new MongoBaseRepository<WeaponBuild>(models.WeaponBuild),
	users: new MongoBaseRepository<UserProfile>(models.UserProfile),
	roomSaves: new MongoBaseRepository<RoomArchive>(models.RoomArchive),
};