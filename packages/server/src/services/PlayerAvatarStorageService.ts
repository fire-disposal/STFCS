import { mkdir, readFile, rename, writeFile } from "fs/promises";
import { dirname, resolve } from "path";
import type { PlayerProfile } from "@vt/data";
import { validatePlayerProfile } from "@vt/data";
import { createLogger } from "../infra/simple-logger.js";

export interface ClientProfileView {
    nickname: string;
    avatar: string;
}

interface PersistedData {
    version: 1;
    profiles: Record<string, PlayerProfile>;
    avatars: Record<string, string>;
}

const DEFAULT_STORAGE_PATH = resolve(process.cwd(), "data", "player-profiles.json");
const MAX_AVATAR_BYTES = 256 * 1024;
const ALLOWED_PREFIX = /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i;

export class PlayerAvatarStorageService {
    private readonly logger = createLogger("avatar-storage");
    private readonly storagePath: string;
    private readonly profiles = new Map<string, PlayerProfile>();
    private readonly avatars = new Map<string, string>();
    private readonly ready: Promise<void>;

    constructor(storagePath: string = DEFAULT_STORAGE_PATH) {
        this.storagePath = storagePath;
        this.ready = this.loadFromDisk();
    }

    async getOrCreateProfile(playerName: string): Promise<PlayerProfile> {
        await this.ready;
        const key = this.normalizeKey(playerName);
        const existing = this.profiles.get(key);
        if (existing) return existing;

        const profile = this.createDefaultProfile(playerName);
        this.profiles.set(key, profile);
        await this.persistToDisk();
        return profile;
    }

    async getClientProfile(playerName: string): Promise<ClientProfileView> {
        const profile = await this.getOrCreateProfile(playerName);
        return {
            nickname: profile.displayName,
            avatar: this.avatars.get(profile.$id) ?? "",
        };
    }

    async upsertProfile(
        playerName: string,
        patch: { nickname?: string; avatar?: string }
    ): Promise<ClientProfileView> {
        const profile = await this.getOrCreateProfile(playerName);
        const now = Date.now();

        const nickname = this.normalizeNickname(patch.nickname, profile.displayName);
        const avatar = this.normalizeAvatar(patch.avatar, this.avatars.get(profile.$id) ?? "");
        const nextProfile: PlayerProfile = {
            ...profile,
            displayName: nickname,
            updatedAt: now,
            lastLogin: now,
            ...(avatar ? { avatarAssetId: this.generateAvatarAssetId(profile.$id, now) } : {}),
        };
        const validated = validatePlayerProfile(nextProfile);

        this.profiles.set(this.normalizeKey(playerName), validated);
        if (avatar) {
            this.avatars.set(validated.$id, avatar);
        } else {
            this.avatars.delete(validated.$id);
        }

        await this.persistToDisk();
        return {
            nickname: validated.displayName,
            avatar,
        };
    }

    private createDefaultProfile(playerName: string): PlayerProfile {
        const now = Date.now();
        const username = this.normalizeKey(playerName);
        const draft: PlayerProfile = {
            $id: `player:${username}`,
            username,
            displayName: playerName,
            tokens: [],
            weapons: [],
            saveIds: [],
            stats: {
                gamesPlayed: 0,
                wins: 0,
                totalDamage: 0,
            },
            createdAt: now,
            updatedAt: now,
            lastLogin: now,
        };

        return validatePlayerProfile(draft);
    }

    private normalizeKey(playerName: string): string {
        return playerName.trim().toLowerCase();
    }

    private normalizeNickname(nickname: string | undefined, fallback: string): string {
        const value = (nickname ?? fallback).trim();
        if (!value) return fallback;
        return value.slice(0, 24);
    }

    private normalizeAvatar(avatar: string | undefined, fallback: string): string {
        if (avatar === undefined) return fallback;
        const trimmed = avatar.trim();
        if (!trimmed) return "";

        if (!ALLOWED_PREFIX.test(trimmed)) {
            throw new Error("Avatar must be a base64 data URL image");
        }

        const base64 = trimmed.split(",", 2)[1];
        if (!base64) throw new Error("Invalid avatar data URL");

        const byteSize = Buffer.byteLength(base64, "base64");
        if (byteSize > MAX_AVATAR_BYTES) {
            throw new Error("Avatar image is too large");
        }

        return trimmed;
    }

    private generateAvatarAssetId(playerId: string, now: number): string {
        const random = Math.random().toString(36).slice(2, 8);
        return `asset:avatar_${playerId.replace("player:", "")}_${now}_${random}`;
    }

    private async loadFromDisk(): Promise<void> {
        try {
            const raw = await readFile(this.storagePath, "utf-8");
            const data = JSON.parse(raw) as PersistedData;
            if (data.version !== 1 || !data.profiles) return;

            for (const [key, profile] of Object.entries(data.profiles)) {
                this.profiles.set(key, validatePlayerProfile(profile));
            }

            for (const [playerId, avatar] of Object.entries(data.avatars ?? {})) {
                if (typeof avatar === "string") this.avatars.set(playerId, avatar);
            }

            this.logger.info("Avatar profiles loaded", { count: this.profiles.size });
        } catch (error: unknown) {
            const err = error as NodeJS.ErrnoException;
            if (err.code === "ENOENT") {
                this.logger.info("Avatar profile storage not found, starting fresh", {
                    path: this.storagePath,
                });
                return;
            }
            this.logger.error("Failed to load avatar profiles", error, { path: this.storagePath });
        }
    }

    private async persistToDisk(): Promise<void> {
        const dir = dirname(this.storagePath);
        await mkdir(dir, { recursive: true });

        const data: PersistedData = {
            version: 1,
            profiles: Object.fromEntries(this.profiles.entries()),
            avatars: Object.fromEntries(this.avatars.entries()),
        };
        const tempPath = `${this.storagePath}.tmp`;

        await writeFile(tempPath, JSON.stringify(data, null, 2), "utf-8");
        await rename(tempPath, this.storagePath);
    }
}
