/**
 * Mongoose Schema 定义
 */

import mongoose from "mongoose";

const ShipBuildSchema = new mongoose.Schema({
	id: { type: String, required: true, unique: true },
	ownerId: { type: String, required: true, index: true },
	shipJson: { type: mongoose.Schema.Types.Mixed, required: true },
	customizations: { type: mongoose.Schema.Types.Mixed, default: {} },
	isPreset: { type: Boolean, required: true, default: false, index: true },
	isPublic: { type: Boolean, default: false },
	tags: { type: [String], default: [] },
	usageCount: { type: Number, default: 0 },
 createdAt: { type: Number, required: true },
 updatedAt: { type: Number, required: true },
}, { collection: "ship_builds" });

const WeaponBuildSchema = new mongoose.Schema({
	id: { type: String, required: true, unique: true },
	ownerId: { type: String, required: true, index: true },
	weaponJson: { type: mongoose.Schema.Types.Mixed, required: true },
	isPreset: { type: Boolean, required: true, default: false, index: true },
	isPublic: { type: Boolean, default: false },
	tags: { type: [String], default: [] },
	usageCount: { type: Number, default: 0 },
 createdAt: { type: Number, required: true },
 updatedAt: { type: Number, required: true },
}, { collection: "weapon_builds" });

const UserProfileSchema = new mongoose.Schema({
	id: { type: String, required: true, unique: true },
	name: { type: String, required: true },
	nickname: String,
	avatar: String,
	role: { type: String, required: true },
	faction: { type: String, required: true },
	ready: { type: Boolean, default: false },
	connected: { type: Boolean, default: false },
	pingMs: { type: Number, default: 0 },
	jitterMs: Number,
	connectionQuality: String,
	stats: { type: mongoose.Schema.Types.Mixed, default: {} },
	preferences: { type: mongoose.Schema.Types.Mixed, default: {} },
	shipBuildIds: { type: [String], default: [] },
 createdAt: { type: Number, required: true },
 updatedAt: { type: Number, required: true },
}, { collection: "user_profiles" });

const RoomArchiveSchema = new mongoose.Schema({
	id: { type: String, required: true, unique: true },
	name: { type: String, required: true },
	description: String,
	saveJson: { type: mongoose.Schema.Types.Mixed, required: true },
	metadata: { type: mongoose.Schema.Types.Mixed, required: true },
	playerIds: { type: [String], default: [] },
	isAutoSave: { type: Boolean, default: false },
	tags: { type: [String], default: [] },
 createdAt: { type: Number, required: true },
 updatedAt: { type: Number, required: true },
}, { collection: "room_archives" });

export const models = {
	ShipBuild: mongoose.model("ShipBuild", ShipBuildSchema),
	WeaponBuild: mongoose.model("WeaponBuild", WeaponBuildSchema),
	UserProfile: mongoose.model("UserProfile", UserProfileSchema),
	RoomArchive: mongoose.model("RoomArchive", RoomArchiveSchema),
};