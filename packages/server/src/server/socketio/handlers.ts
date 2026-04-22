/**
 * RPC Handlers - 使用新接口结构（customize/edit/game namespace）
 */

import { createRpcRegistry } from "./RpcServer.js";
import { PlayerAvatarStorageService } from "../../services/PlayerAvatarStorageService.js";
import { PlayerProfileService } from "../../services/PlayerProfileService.js";
import { ShipBuildService } from "../../services/ship/ShipBuildService.js";
import { PresetService } from "../../services/preset/PresetService.js";
import { AssetService } from "../../services/AssetService.js";
import { persistence } from "../../persistence/PersistenceManager.js";
import { calculateShipWeaponTargets, validateAttackAllocations, type WeaponAllocation } from "../../core/engine/rules/targeting.js";
import { calculateWeaponAttack } from "../../core/engine/rules/weapon.js";
import { calculateDamage } from "../../core/engine/rules/damage.js";
import { angleBetween } from "../../core/engine/geometry/angle.js";
import { validateMovement, validateRotation, validatePhaseAdvance, processMovement, processRotation, advancePhase } from "../../core/engine/modules/movement.js";
import { toggleShield, validateShieldToggle } from "../../core/engine/modules/shield.js";
import { ventFlux, canVent } from "../../core/engine/modules/flux.js";
import { Faction } from "@vt/data";
import type { WsPayload, WsResponseData, CombatToken, InventoryToken, WeaponJSON } from "@vt/data";
import { createCombatToken } from "../../core/state/Token.js";

const playerAvatarStorage = new PlayerAvatarStorageService();
const assetService = new AssetService();
const playerProfileService = new PlayerProfileService(persistence);
const shipBuildService = new ShipBuildService(persistence);
const presetService = new PresetService(persistence);

export const rpc = createRpcRegistry();

function err(message: string, code: string = "ERROR"): Error {
  return Object.assign(new Error(message), { code });
}

rpc.namespace("auth", {
  login: async (payload: unknown, ctx) => {
    const p = payload as WsPayload<"auth:login">;
    ctx.socket.data.playerId = `player_${ctx.socket.id}`;
    ctx.socket.data.playerName = p.playerName;
    await playerAvatarStorage.getClientProfile(p.playerName);
    return { playerId: ctx.socket.data.playerId, playerName: p.playerName, isHost: false, role: "PLAYER" };
  },
  logout: async (_, ctx) => {
    if (ctx.roomId) {
      ctx.state.removePlayer(ctx.playerId);
      ctx.roomManager.leaveRoom(ctx.roomId, ctx.playerId);
    }
    ctx.socket.data.playerId = undefined;
    ctx.socket.data.playerName = undefined;
  },
});

rpc.namespace("profile", {
  get: async (_, ctx) => {
    ctx.requireAuth();
    const profile = await playerAvatarStorage.getClientProfile(ctx.playerName);
    return { profile };
  },
  update: async (payload: unknown, ctx) => {
    ctx.requireAuth();
    const p = payload as WsPayload<"profile:update">;
    const patch: { nickname?: string; avatar?: string } = {};
    if (p.nickname !== undefined) patch.nickname = p.nickname;
    if (p.avatar !== undefined) patch.avatar = p.avatar;
    const profile = await playerAvatarStorage.upsertProfile(ctx.playerName, patch);
    return { profile };
  },
});

rpc.namespace("room", {
  create: async (payload: unknown, ctx) => {
    ctx.requireAuth();
    const p = payload as WsPayload<"room:create">;
    const room = ctx.roomManager.createRoom({
      roomName: p.name,
      maxPlayers: p.maxPlayers ?? 4,
      mapWidth: p.mapWidth ?? 2000,
      mapHeight: p.mapHeight ?? 2000,
      creatorSessionId: ctx.playerId,
    });
    if (!room) throw err("创建房间失败", "ROOM_CREATE_FAILED");
    ctx.socket.join(room.id);
    ctx.socket.data.roomId = room.id;
    ctx.socket.data.role = "HOST";
    ctx.state.addPlayer(ctx.playerId, { sessionId: ctx.socket.id, nickname: ctx.playerName, role: "HOST", isReady: false, connected: true });
    return { roomId: room.id, roomName: room.name, isHost: true };
  },
  list: async (_, ctx) => {
    const rooms = ctx.roomManager.getAllRooms().map((r: any) => ({
      roomId: r.id,
      name: r.name,
      playerCount: r.playerCount,
      maxPlayers: r.maxPlayers,
      phase: r.phase,
      turnCount: r.gameState?.turnCount ?? 0,
      ownerId: r.creatorId,
      createdAt: r.createdAt,
    }));
    return { rooms };
  },
  join: async (payload: unknown, ctx) => {
    ctx.requireAuth();
    const p = payload as WsPayload<"room:join">;
    const room = ctx.roomManager.getRoom(p.roomId);
    if (!room) throw err("房间不存在", "ROOM_NOT_FOUND");
    ctx.roomManager.joinRoom(p.roomId, ctx.socket.id, ctx.playerId, ctx.playerName);
    ctx.socket.join(p.roomId);
    ctx.socket.data.roomId = p.roomId;
    const role = room.creatorId === ctx.playerId ? "HOST" : "PLAYER";
    ctx.socket.data.role = role;
    ctx.state.addPlayer(ctx.playerId, { sessionId: ctx.socket.id, nickname: ctx.playerName, role, isReady: false, connected: true });
    ctx.state.broadcastFull();
    return { roomId: p.roomId, roomName: room.name, isHost: role === "HOST", role };
  },
  leave: async (_, ctx) => {
    ctx.requireRoom();
    ctx.state.removePlayer(ctx.playerId);
    ctx.roomManager.leaveRoom(ctx.roomId, ctx.playerId);
    ctx.socket.leave(ctx.roomId);
    ctx.socket.data.roomId = undefined;
    ctx.socket.data.role = undefined;
  },
  action: async (payload: unknown, ctx) => {
    ctx.requireRoom();
    const p = payload as WsPayload<"room:action">;
    const room = ctx.roomManager.getRoom(ctx.roomId);
    if (!room) throw err("房间不存在", "ROOM_NOT_FOUND");
    switch (p.action) {
      case "ready":
        room.togglePlayerReady(ctx.playerId);
        break;
      case "start":
        ctx.requireHost();
        room.startGame();
        ctx.state.changePhase("PLAYER_ACTION");
        break;
      case "kick":
        ctx.requireHost();
        if (!p.targetId) throw err("需要 targetId", "TARGET_REQUIRED");
        room.leavePlayer(p.targetId);
        ctx.state.removePlayer(p.targetId);
        break;
      case "transfer_host":
        ctx.requireHost();
        if (!p.targetId) throw err("需要 targetId", "TARGET_REQUIRED");
        room.creatorId = p.targetId;
        ctx.socket.data.role = "PLAYER";
        ctx.state.changeHost(p.targetId);
        break;
    }
  },
  get_assets: async (payload: unknown, ctx) => {
    ctx.requireRoom();
    const p = payload as WsPayload<"room:get_assets">;
    const room = ctx.roomManager.getRoom(ctx.roomId);
    if (!room) throw err("房间不存在", "ROOM_NOT_FOUND");
    const assetIds: string[] = [];
    const tokens = room.getCombatTokens();
    for (const token of tokens) {
      const texture = token.spec.texture;
      if (texture?.assetId) assetIds.push(texture.assetId);
      for (const mount of token.spec.mounts ?? []) {
        if (typeof mount.weapon !== "string" && mount.weapon?.spec?.texture?.assetId) {
          assetIds.push(mount.weapon.spec.texture.assetId);
        }
      }
    }
    const assets = await assetService.batchGetAssets([...new Set(assetIds)], p.includeData);
    return { assets };
  },
});

rpc.namespace("customize", {
  token: async (payload: unknown, ctx): Promise<WsResponseData<"customize:token">> => {
    ctx.requireAuth();
    const p = payload as WsPayload<"customize:token">;
    
    switch (p.action) {
      case "list": {
        const ships = await playerProfileService.getPlayerShips(ctx.playerId);
        return { ships };
      }
      case "get": {
        if (!p.tokenId) throw err("需要 tokenId", "TOKEN_ID_REQUIRED");
        const ship = await playerProfileService.getPlayerShip(ctx.playerId, p.tokenId);
        if (!ship) throw err("舰船不存在", "TOKEN_NOT_FOUND");
        return { ship };
      }
      case "upsert": {
        if (!p.token) throw err("需要 token 数据", "TOKEN_DATA_REQUIRED");
        let ship;
        if (p.tokenId) {
          ship = await shipBuildService.updateShipBuild(p.tokenId, { data: p.token as InventoryToken });
        } else {
          ship = await shipBuildService.createShipBuild(ctx.playerId, p.token as InventoryToken);
        }
        if (!ship) throw err("操作失败", "UPSERT_FAILED");
        return { ship };
      }
      case "delete": {
        if (!p.tokenId) throw err("需要 tokenId", "TOKEN_ID_REQUIRED");
        const success = await playerProfileService.deletePlayerShip(ctx.playerId, p.tokenId);
        if (!success) throw err("删除失败", "TOKEN_DELETE_FAILED");
        return;
      }
      case "copy_preset": {
        if (!p.presetId) throw err("需要 presetId", "PRESET_ID_REQUIRED");
        const ship = await shipBuildService.createFromPreset(ctx.playerId, p.presetId);
        return { ship };
      }
      default:
        throw err("未知操作", "UNKNOWN_ACTION");
    }
  },
  
  weapon: async (payload: unknown, ctx) => {
    ctx.requireAuth();
    const p = payload as WsPayload<"customize:weapon">;
    
    switch (p.action) {
      case "list": {
        const weapons = await playerProfileService.getPlayerWeapons(ctx.playerId);
        return { weapons };
      }
      case "get": {
        if (!p.weaponId) throw err("需要 weaponId", "WEAPON_ID_REQUIRED");
        const weapon = await playerProfileService.getPlayerWeapon(ctx.playerId, p.weaponId);
        if (!weapon) throw err("武器不存在", "WEAPON_NOT_FOUND");
        return { weapon };
      }
      case "upsert": {
        if (!p.weapon) throw err("需要 weapon 数据", "WEAPON_DATA_REQUIRED");
        let weapon;
        if (p.weaponId) {
          weapon = await persistence.weapons.update(p.weaponId, { data: p.weapon as WeaponJSON });
        } else {
          weapon = await persistence.weapons.create({
            id: p.weapon.$id,
            data: p.weapon as WeaponJSON,
            ownerId: ctx.playerId,
            isPreset: false,
            tags: [],
            usageCount: 0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        }
        if (!weapon) throw err("操作失败", "UPSERT_FAILED");
        return { weapon };
      }
      case "delete": {
        if (!p.weaponId) throw err("需要 weaponId", "WEAPON_ID_REQUIRED");
        const success = await playerProfileService.deletePlayerWeapon(ctx.playerId, p.weaponId);
        if (!success) throw err("删除失败", "WEAPON_DELETE_FAILED");
        return;
      }
      case "copy_preset": {
        if (!p.presetId) throw err("需要 presetId", "PRESET_ID_REQUIRED");
        const preset = await presetService.getWeaponPresetById(p.presetId);
        if (!preset) throw err("预设武器不存在", "PRESET_NOT_FOUND");
        const data = JSON.parse(JSON.stringify(preset));
        data.$id = `weapon:${ctx.playerId}_${Date.now().toString(36)}`;
        const weapon = await persistence.weapons.create({
          id: data.$id,
          data,
          ownerId: ctx.playerId,
          isPreset: false,
          tags: ["preset-copy"],
          usageCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        return { weapon };
      }
      default:
        throw err("未知操作", "UNKNOWN_ACTION");
    }
  },
});

rpc.namespace("save", {
  action: async (payload: unknown, ctx) => {
    ctx.requireAuth();
    const p = payload as WsPayload<"save:action">;
    
    switch (p.action) {
      case "list": {
        const saves = await playerProfileService.listSaves(ctx.playerId);
        return { saves };
      }
      case "create": {
        if (!p.name) throw err("需要 name", "NAME_REQUIRED");
        const ships = await playerProfileService.getPlayerShips(ctx.playerId);
        const combatTokens: CombatToken[] = ships.map((s, i) => {
          const spacing = 200;
          const row = Math.floor(i / 3);
          const col = i % 3;
          return createCombatToken(
            s.data.$id,
            s.data,
            { x: 500 + col * spacing, y: 500 + row * spacing },
            0,
            Faction.PLAYER,
            ctx.playerId
          );
        });
        const save = await playerProfileService.createSave(ctx.playerId, p.name, combatTokens);
        return { save };
      }
      case "load": {
        ctx.requireRoom();
        ctx.requireHost();
        if (!p.saveId) throw err("需要 saveId", "SAVE_ID_REQUIRED");
        const saves = await playerProfileService.listSaves(ctx.playerId);
        const save = saves.find(s => s.$id === p.saveId);
        if (!save) throw err("存档不存在", "SAVE_NOT_FOUND");
        const stateManager = ctx.state;
        stateManager.clearTokens();
        for (const token of save.tokens) {
          stateManager.setToken(token.$id, token);
        }
        ctx.state.broadcastFull();
        return;
      }
      case "delete": {
        if (!p.saveId) throw err("需要 saveId", "SAVE_ID_REQUIRED");
        const saves = await playerProfileService.listSaves(ctx.playerId);
        const save = saves.find(s => s.$id === p.saveId);
        if (!save) throw err("存档不存在", "SAVE_NOT_FOUND");
        await persistence.roomSaves.delete(p.saveId);
        return;
      }
      default:
        throw err("未知操作", "UNKNOWN_ACTION");
    }
  },
});

rpc.namespace("asset", {
  upload: async (payload: unknown, ctx) => {
    ctx.requireAuth();
    const p = payload as WsPayload<"asset:upload">;
    const options: { name?: string; description?: string; tags?: string[] } = {};
    if (p.name !== undefined) options.name = p.name;
    if (p.description !== undefined) options.description = p.description;
    const asset = await assetService.uploadAsset(ctx.playerId, p.type, p.filename, p.mimeType, Buffer.from(p.data, "base64"), options);
    return { assetId: asset.$id };
  },
  action: async (payload: unknown, ctx) => {
    ctx.requireAuth();
    const p = payload as WsPayload<"asset:action">;
    switch (p.action) {
      case "list": {
        const assets = await assetService.listAssets(p.type, p.ownerId ?? ctx.playerId);
        return { assets };
      }
      case "batch_get": {
        if (!p.assetIds || p.assetIds.length === 0) throw err("需要 assetIds", "ASSET_IDS_REQUIRED");
        const results = await assetService.batchGetAssets(p.assetIds, p.includeData);
        return { results };
      }
      case "delete": {
        if (!p.assetId) throw err("需要 assetId", "ASSET_ID_REQUIRED");
        const success = await assetService.deleteAsset(p.assetId);
        if (!success) throw err("删除失败", "ASSET_DELETE_FAILED");
        return;
      }
      default:
        throw err("未知操作", "UNKNOWN_ACTION");
    }
  },
});

rpc.namespace("preset", {
  list_tokens: async (payload: unknown, ctx) => {
    ctx.requireAuth();
    const p = payload as WsPayload<"preset:list_tokens">;
    let presets;
    if (p.size) presets = await presetService.getShipPresetsBySize(p.size);
    else if (p.class) presets = await presetService.getShipPresetsByClass(p.class);
    else presets = await presetService.getShipPresets();
    return { presets };
  },
  list_weapons: async (payload: unknown, ctx) => {
    ctx.requireAuth();
    const p = payload as WsPayload<"preset:list_weapons">;
    let presets;
    if (p.size) presets = await presetService.getWeaponPresetsBySize(p.size);
    else if (p.damageType) presets = await presetService.getWeaponPresetsByDamageType(p.damageType);
    else presets = await presetService.getWeaponPresets();
    return { presets };
  },
  get_token: async (payload: unknown, ctx) => {
    ctx.requireAuth();
    const p = payload as WsPayload<"preset:get_token">;
    const preset = await presetService.getShipPresetById(p.presetId);
    if (!preset) throw err("预设舰船不存在", "PRESET_NOT_FOUND");
    return { preset };
  },
  get_weapon: async (payload: unknown, ctx) => {
    ctx.requireAuth();
    const p = payload as WsPayload<"preset:get_weapon">;
    const preset = await presetService.getWeaponPresetById(p.presetId);
    if (!preset) throw err("预设武器不存在", "PRESET_NOT_FOUND");
    return { preset };
  },
});

rpc.namespace("game", {
  action: async (payload: unknown, ctx) => {
    ctx.requireRoom();
    ctx.requirePlayer();
    const p = payload as WsPayload<"game:action">;
    if (ctx.room!.creatorId !== ctx.playerId) {
      ctx.requireTokenControl(p.tokenId);
    }
    const room = ctx.room!;
    
    switch (p.action) {
      case "move": {
        const token = room.getCombatToken(p.tokenId);
        if (!token) throw err("舰船不存在", "TOKEN_NOT_FOUND");
        const forward = p.forward ?? 0;
        const strafe = p.strafe ?? 0;
        const moveValidation = validateMovement(token, forward, strafe);
        if (!moveValidation.valid) throw err(moveValidation.error ?? "移动验证失败", "INVALID_MOVE");
        const moveResult = processMovement(token, { forwardDistance: forward, strafeDistance: strafe });
        ctx.state.updateTokenRuntime(p.tokenId, { position: moveResult.newPosition, movement: moveResult.newMovementState });
        break;
      }
      case "rotate": {
        const token = room.getCombatToken(p.tokenId);
        if (!token) throw err("舰船不存在", "TOKEN_NOT_FOUND");
        const angle = p.angle ?? 0;
        const rotateValidation = validateRotation(token, angle);
        if (!rotateValidation.valid) throw err(rotateValidation.error ?? "旋转验证失败", "INVALID_ROTATE");
        const rotateResult = processRotation(token, { angle });
        ctx.state.updateTokenRuntime(p.tokenId, { heading: rotateResult.newHeading, movement: rotateResult.newMovementState });
        break;
      }
      case "shield": {
        const token = room.getCombatToken(p.tokenId);
        if (!token) throw err("舰船不存在", "TOKEN_NOT_FOUND");
        const active = p.active ?? false;
        const shieldValidation = validateShieldToggle(token, active);
        if (!shieldValidation.valid) throw err(shieldValidation.error ?? "护盾切换验证失败", "INVALID_SHIELD");
        const shieldResult = toggleShield(token, active);
        if (!shieldResult.success) throw err(shieldResult.reason ?? "护盾切换失败", "SHIELD_TOGGLE_FAILED");
        const runtime = token.runtime;
        const shieldRuntime = runtime?.shield;
        const updates: Record<string, unknown> = { shield: shieldRuntime };
        if (shieldResult.fluxCost && shieldResult.fluxCost > 0) {
          const newFluxSoft = (runtime?.fluxSoft ?? 0) + shieldResult.fluxCost;
          updates["fluxSoft"] = newFluxSoft;
        }
        ctx.state.updateTokenRuntime(p.tokenId, updates);
        break;
      }
      case "vent": {
        const token = room.getCombatToken(p.tokenId);
        if (!token) throw err("舰船不存在", "TOKEN_NOT_FOUND");
        const ventCheck = canVent(token);
        if (!ventCheck.canVent) throw err(ventCheck.reason ?? "无法排散", "CANNOT_VENT");
        const ventResult = ventFlux(token);
        if (!ventResult.success) throw err(ventResult.reason ?? "排散失败", "VENT_FAILED");
        ctx.state.updateTokenRuntime(p.tokenId, {
          fluxSoft: 0,
          fluxHard: 0,
          venting: true,
        });
        break;
      }
      case "advance_phase": {
        const token = room.getCombatToken(p.tokenId);
        if (!token) throw err("舰船不存在", "TOKEN_NOT_FOUND");
        const phaseValidation = validatePhaseAdvance(token);
        if (!phaseValidation.valid) throw err(phaseValidation.error ?? "阶段推进验证失败", "INVALID_PHASE_ADVANCE");
        const phaseResult = advancePhase(token);
        ctx.state.updateTokenRuntime(p.tokenId, { movement: phaseResult.newMovementState });
        break;
      }
      case "end_turn": {
        const token = room.getCombatToken(p.tokenId);
        if (!token) throw err("舰船不存在", "TOKEN_NOT_FOUND");
        ctx.state.updateTokenRuntime(p.tokenId, { hasFired: true });
        break;
      }
      case "attack":
        if (!p.allocations || p.allocations.length === 0) {
          throw err("攻击配置无效", "INVALID_ATTACK");
        }
        const attackerToken = room.getCombatToken(p.tokenId);
        if (!attackerToken) throw err("攻击舰船不存在", "TOKEN_NOT_FOUND");

const allocations: WeaponAllocation[] = p.allocations.map((a: { mountId: string; targets: { targetId: string; shots: number }[] }) => ({
        mountId: a.mountId,
        targets: a.targets.map((t: { targetId: string; shots: number }) => ({ targetId: t.targetId, shotCount: t.shots })),
      }));

        const validation = validateAttackAllocations(attackerToken, allocations);
        if (!validation.valid) {
          throw err(validation.errors[0] ?? "攻击分配验证失败", "INVALID_ALLOCATION");
        }

        const attackerSpec = attackerToken.spec;
        const attackerRuntime = attackerToken.runtime;
        if (!attackerRuntime) throw err("攻击舰船无运行状态", "NO_RUNTIME");
        const attackerPos = attackerRuntime.position ?? { x: 0, y: 0 };
        let totalFluxCost = 0;
        const updatedWeapons = attackerRuntime.weapons ? [...attackerRuntime.weapons] : [];

for (const alloc of p.allocations) {
        const mount = attackerSpec.mounts?.find((m: { id: string }) => m.id === alloc.mountId);
        const weaponIdx = updatedWeapons.findIndex((w: { mountId: string }) => w.mountId === alloc.mountId);
        if (weaponIdx === -1 || !mount) continue;
        const weaponRuntime = updatedWeapons[weaponIdx];
        if (!weaponRuntime) continue;
        const weaponSpec = mount.weapon?.spec;
        if (!weaponSpec) continue;
        let lastHitTargetPos = attackerPos;

        for (const target of alloc.targets) {
          const targetToken = room.getCombatToken(target.targetId);
          if (!targetToken) continue;
          const targetRuntime = targetToken.runtime;
          if (!targetRuntime || targetRuntime.destroyed) continue;
          const targetPos = targetRuntime.position ?? { x: 0, y: 0 };

            const attackResult = calculateWeaponAttack(
              weaponSpec,
              weaponRuntime,
              attackerSpec,
              attackerRuntime,
              targetToken.spec,
              targetRuntime,
              attackerPos,
              targetPos,
              target.quadrant
            );

            if (attackResult.hit) {
              lastHitTargetPos = targetPos;
              const damageResult = calculateDamage(
                targetToken.spec,
                targetRuntime,
                attackResult.damage,
                weaponSpec.damageType,
                attackerPos,
                targetPos
              );

              const newHull = Math.max(0, (targetRuntime.hull ?? 0) - damageResult.hullDamage);
              const newArmor = [...(targetRuntime.armor ?? [0, 0, 0, 0, 0, 0])] as [number, number, number, number, number, number];
              if (damageResult.armorQuadrant >= 0 && damageResult.armorQuadrant < 6) {
                const quadrant = damageResult.armorQuadrant;
                newArmor[quadrant] = Math.max(0, newArmor[quadrant]! - damageResult.armorDamage);
              }
              const newFluxHard = (targetRuntime.fluxHard ?? 0) + damageResult.fluxGenerated;
              const destroyed = newHull <= 0;
              const overloaded = newFluxHard > (targetToken.spec.fluxCapacity ?? 0) && !targetRuntime.overloaded;

              ctx.state.updateTokenRuntime(target.targetId, {
                hull: newHull,
                armor: newArmor,
                fluxHard: newFluxHard,
                overloaded,
                destroyed,
              });

              ctx.broadcast("battle:log", {
                log: {
                  type: "attack",
                  attackerId: p.tokenId,
                  targetId: target.targetId,
                  weaponId: alloc.mountId,
                  damage: damageResult.hullDamage + damageResult.armorDamage,
                  timestamp: Date.now(),
                }
              });

              if (destroyed) {
                ctx.broadcast("battle:log", {
                  log: {
                    type: "destroyed",
                    tokenId: target.targetId,
                    tokenName: targetToken.metadata?.name ?? target.targetId,
                    timestamp: Date.now(),
                  }
                });
              }
            }

            totalFluxCost += weaponSpec.fluxCostPerShot ?? 0;
          }

          const weaponHeading = angleBetween(attackerPos, lastHitTargetPos);
          updatedWeapons[weaponIdx] = {
            ...weaponRuntime,
            state: "FIRED" as const,
            currentHeading: weaponHeading,
          };
        }

        const newAttackerFluxSoft = (attackerRuntime.fluxSoft ?? 0) + totalFluxCost;
        ctx.state.updateTokenRuntime(p.tokenId, {
          fluxSoft: newAttackerFluxSoft,
          weapons: updatedWeapons,
        });
        break;
    }
  },
  query: async (payload: unknown, ctx) => {
    ctx.requireRoom();
    const p = payload as WsPayload<"game:query">;
    const room = ctx.room!;
    const token = room.getCombatToken(p.tokenId);
    if (!token) throw err("舰船不存在", "TOKEN_NOT_FOUND");
    switch (p.type) {
      case "targets":
        const allTokens = room.getCombatTokens();
        const targetingResult = calculateShipWeaponTargets(token, allTokens);
        return { result: targetingResult };
      case "movement":
        return { result: token.runtime?.movement ?? { phaseAUsed: 0, phaseCUsed: 0, turnAngleUsed: 0 } };
      case "ownership":
        return { result: { ownerId: token.runtime?.ownerId ?? null, faction: token.runtime?.faction ?? null } };
      case "combat_state":
        return { result: { hull: token.runtime?.hull ?? null, flux: (token.runtime?.fluxSoft ?? 0) + (token.runtime?.fluxHard ?? 0), overloaded: token.runtime?.overloaded ?? null } };
      case "weapon_state": {
        const mountId = p.mountId;
        if (!mountId) throw err("需要 mountId", "MOUNT_ID_REQUIRED");
        const weaponRuntime = token.runtime?.weapons?.find((w: { mountId: string }) => w.mountId === mountId);
        if (!weaponRuntime) throw err("武器不存在", "WEAPON_NOT_FOUND");
        return { result: weaponRuntime };
      }
      default:
        throw err(`未知查询类型: ${p.type}`, "UNKNOWN_QUERY_TYPE");
    }
  },
});

rpc.namespace("edit", {
  token: async (payload: unknown, ctx) => {
    ctx.requireHost();
    const p = payload as WsPayload<"edit:token">;
    const room = ctx.room!;
    
    switch (p.action) {
      case "create": {
        if (!p.token) throw err("需要 token 数据", "TOKEN_DATA_REQUIRED");
        const tokenId = p.token.$id || `token_${Date.now()}`;
        const createToken: CombatToken = {
          ...p.token,
          runtime: {
            ...p.token.runtime,
            position: p.position ?? p.token.runtime?.position ?? { x: 0, y: 0 },
            heading: p.token.runtime?.heading ?? 0,
            faction: p.faction ?? p.token.runtime?.faction ?? Faction.NEUTRAL,
            ownerId: p.token.runtime?.ownerId ?? ctx.playerId,
          } as any,
        };
        ctx.state.setToken(tokenId, createToken, ctx.editLogContext(p.reason ?? "创建舰船"));
        return { tokenId };
      }
      case "modify": {
        if (!p.tokenId) throw err("需要 tokenId", "TOKEN_ID_REQUIRED");
        if (!p.path) throw err("需要 path", "PATH_REQUIRED");
        const token = room.getCombatToken(p.tokenId);
        if (!token) throw err("舰船不存在", "TOKEN_NOT_FOUND");
        ctx.state.updateToken(p.tokenId, p.path, p.value, ctx.editLogContext(p.reason));
        return;
      }
      case "remove": {
        if (!p.tokenId) throw err("需要 tokenId", "TOKEN_ID_REQUIRED");
        const token = room.getCombatToken(p.tokenId);
        if (!token) throw err("舰船不存在", "TOKEN_NOT_FOUND");
        ctx.state.removeToken(p.tokenId, ctx.editLogContext(p.reason));
        return;
      }
      case "heal": {
        if (!p.tokenId) throw err("需要 tokenId", "TOKEN_ID_REQUIRED");
        if (!p.amount) throw err("需要 amount", "AMOUNT_REQUIRED");
        const token = room.getCombatToken(p.tokenId);
        if (!token) throw err("舰船不存在", "TOKEN_NOT_FOUND");
        const newHull = Math.min(token.spec.maxHitPoints, (token.runtime?.hull ?? 0) + p.amount);
        ctx.state.updateToken(p.tokenId, "runtime/hull", newHull, ctx.editLogContext(p.reason ?? `恢复 ${p.amount} 船体`));
        return;
      }
      case "damage": {
        if (!p.tokenId) throw err("需要 tokenId", "TOKEN_ID_REQUIRED");
        if (!p.amount) throw err("需要 amount", "AMOUNT_REQUIRED");
        const token = room.getCombatToken(p.tokenId);
        if (!token) throw err("舰船不存在", "TOKEN_NOT_FOUND");
        const newHull = Math.max(0, (token.runtime?.hull ?? 0) - p.amount);
        const destroyed = newHull <= 0;
        ctx.state.updateToken(p.tokenId, "runtime/hull", newHull, ctx.editLogContext(p.reason ?? `受到 ${p.amount} 伤害`));
        if (destroyed) {
          ctx.state.updateToken(p.tokenId, "runtime/destroyed", true, ctx.editLogContext("舰船被摧毁"));
        }
        return;
      }
      case "restore": {
        if (!p.tokenId) throw err("需要 tokenId", "TOKEN_ID_REQUIRED");
        const token = room.getCombatToken(p.tokenId);
        if (!token) throw err("舰船不存在", "TOKEN_NOT_FOUND");
        ctx.state.updateTokenRuntime(p.tokenId, {
          hull: token.spec.maxHitPoints,
          armor: Array(6).fill(token.spec.armorMaxPerQuadrant) as [number, number, number, number, number, number],
          fluxSoft: 0,
          fluxHard: 0,
          overloaded: false,
          destroyed: false,
        });
        return;
      }
      case "reset": {
        if (!p.tokenId) throw err("需要 tokenId", "TOKEN_ID_REQUIRED");
        const token = room.getCombatToken(p.tokenId);
        if (!token) throw err("舰船不存在", "TOKEN_NOT_FOUND");
        ctx.state.updateToken(p.tokenId, "runtime", {
          position: token.runtime?.position ?? { x: 0, y: 0 },
          heading: 0,
          hull: token.spec.maxHitPoints,
          armor: Array(6).fill(token.spec.armorMaxPerQuadrant),
          fluxSoft: 0,
          fluxHard: 0,
          overloaded: false,
          destroyed: false,
          movement: {
            currentPhase: "A",
            hasMoved: false,
            phaseAUsed: 0,
            turnAngleUsed: 0,
            phaseCUsed: 0,
          },
          hasFired: false,
        }, ctx.editLogContext(p.reason ?? "重置状态"));
        return;
      }
      default:
        throw err("未知操作", "UNKNOWN_ACTION");
    }
  },
  
  room: async (payload: unknown, ctx) => {
    ctx.requireHost();
    const p = payload as WsPayload<"edit:room">;
    
    switch (p.action) {
      case "set_modifier": {
        if (!p.key) throw err("需要 key", "KEY_REQUIRED");
        if (!p.value) throw err("需要 value", "VALUE_REQUIRED");
        ctx.state.setGlobalModifier(p.key, p.value);
        return;
      }
      case "remove_modifier": {
        if (!p.key) throw err("需要 key", "KEY_REQUIRED");
        ctx.state.removeGlobalModifier(p.key);
        return;
      }
      case "force_end_turn": {
        const room = ctx.room!;
        room.nextTurn();
        const state = room.getStateManager().getState();
        ctx.state.changeTurn(state.turnCount);
        if (p.faction) ctx.state.changeFaction(p.faction);
        return;
      }
      case "set_phase": {
        if (!p.phase) throw err("需要 phase", "PHASE_REQUIRED");
        ctx.state.changePhase(p.phase as any);
        return;
      }
      case "set_turn": {
        if (!p.turn) throw err("需要 turn", "TURN_REQUIRED");
        ctx.state.changeTurn(p.turn);
        return;
      }
      default:
        throw err("未知操作", "UNKNOWN_ACTION");
    }
  },
});

rpc.on("sync:request_full", async (_, ctx) => {
  ctx.requireRoom();
  if (!ctx.room) throw err("房间不存在", "ROOM_NOT_FOUND");
  return ctx.room.getGameState();
});

export function setupSocketIO(io: any, roomManager: any): void {
  const services = { playerProfile: playerProfileService, shipBuild: shipBuildService, preset: presetService, asset: assetService, playerAvatar: playerAvatarStorage };
  const middleware = rpc.createMiddleware();

  io.on("connection", (socket: any) => {
    middleware(socket, io, roomManager, persistence, services);

    socket.on("disconnect", () => {
      const sd = socket.data as { playerId?: string; roomId?: string };
      if (sd.roomId && sd.playerId) {
        roomManager.leaveRoom(sd.roomId, sd.playerId);
      }
    });
  });
}