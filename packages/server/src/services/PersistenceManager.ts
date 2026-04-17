import type { PlayerProfile, CustomVariant, GameSave, SaveMetadata } from "../schema/types.js";

/**
 * 持久化层存储接口定义
 * 
 * 规范化后端存储架构，支持未来在不改动业务逻辑的情况下切换存储实现（内存/SQLite/Postgres等）
 */
export interface IStorageProvider {
// --- 玩家档案 (Profiles) ---
getProfile(userId: string): Promise<PlayerProfile | null>;
saveProfile(profile: PlayerProfile): Promise<void>;

// --- 舰船变体 (Variants) ---
getVariantsByOwner(ownerId: string): Promise<CustomVariant[]>;
getVariant(id: string): Promise<CustomVariant | null>;
saveVariant(ownerId: string, variant: CustomVariant): Promise<void>;
deleteVariant(ownerId: string, id: string): Promise<void>;

// --- 游戏存档 (Saves) ---
getSave(id: string): Promise<GameSave | null>;
getSavesMetadata(): Promise<SaveMetadata[]>;
saveGame(id: string, saveData: GameSave): Promise<void>;
deleteSave(id: string): Promise<void>;
}

/**
 * 内存存储实现 (规范化架构)
 */
export class MemoryStorageProvider implements IStorageProvider {
private profiles = new Map<string, PlayerProfile>();
private variants = new Map<string, CustomVariant[]>(); // ownerId -> variants
private saves = new Map<string, GameSave>();

async getProfile(userId: string): Promise<PlayerProfile | null> {
return this.profiles.get(userId) || null;
}

async saveProfile(profile: PlayerProfile): Promise<void> {
this.profiles.set(profile.id, { ...profile, updatedAt: Date.now() });
}

async getVariantsByOwner(ownerId: string): Promise<CustomVariant[]> {
return this.variants.get(ownerId) || [];
}

async getVariant(id: string): Promise<CustomVariant | null> {
for (const ownerVariants of this.variants.values()) {
const found = ownerVariants.find(v => v.id === id);
if (found) return found;
}
return null;
}

async saveVariant(ownerId: string, variant: CustomVariant): Promise<void> {
const list = this.variants.get(ownerId) || [];
const index = list.findIndex(v => v.id === variant.id);

const updatedVariant = { ...variant, updatedAt: Date.now() };
if (index >= 0) {
list[index] = updatedVariant;
} else {
list.push(updatedVariant);
}
this.variants.set(ownerId, list);
}

async deleteVariant(ownerId: string, id: string): Promise<void> {
const list = this.variants.get(ownerId) || [];
this.variants.set(ownerId, list.filter(v => v.id !== id));
}

async getSave(id: string): Promise<GameSave | null> {
return this.saves.get(id) || null;
}

async getSavesMetadata(): Promise<SaveMetadata[]> {
return Array.from(this.saves.values())
.map(s => ({
id: s.id,
name: s.name,
description: s.description,
createdAt: s.createdAt,
updatedAt: s.updatedAt,
turnCount: s.turnCount
}))
.sort((a, b) => b.updatedAt - a.updatedAt);
}

async saveGame(id: string, saveData: GameSave): Promise<void> {
this.saves.set(id, { ...saveData, updatedAt: Date.now() });
}

async deleteSave(id: string): Promise<void> {
this.saves.delete(id);
}
}

/**
 * 集中持久化管理器
 */
export class PersistenceManager {
private provider: IStorageProvider;

constructor() {
// 当前使用内存存储规范，未来可轻松切换
this.provider = new MemoryStorageProvider();
}

get profiles() { return {
get: (id: string) => this.provider.getProfile(id),
save: (profile: PlayerProfile) => this.provider.saveProfile(profile),
}; }

get variants() { return {
getByOwner: (ownerId: string) => this.provider.getVariantsByOwner(ownerId),
get: (id: string) => this.provider.getVariant(id),
save: (ownerId: string, variant: CustomVariant) => this.provider.saveVariant(ownerId, variant),
delete: (ownerId: string, id: string) => this.provider.deleteVariant(ownerId, id),
}; }

get saves() { return {
get: (id: string) => this.provider.getSave(id),
list: () => this.provider.getSavesMetadata(),
save: (id: string, data: GameSave) => this.provider.saveGame(id, data),
delete: (id: string) => this.provider.deleteSave(id),
}; }
}

export const persistence = new PersistenceManager();
