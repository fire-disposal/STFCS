/**
 * RPC Handlers - 使用新接口结构（customize/edit/game namespace）
 */

import { createRpcRegistry } from "./RpcServer.js";
import { PlayerInfoService } from "../../services/PlayerInfoService.js";
import { PlayerProfileService } from "../../services/PlayerProfileService.js";
import { ShipBuildService } from "../../services/ship/ShipBuildService.js";
import { WeaponService } from "../../services/weapon/WeaponService.js";
import { PresetService } from "../../services/preset/PresetService.js";
import { AssetService } from "../../services/AssetService.js";
import { calculateShipWeaponTargets, validateAttackAllocations, type WeaponAllocation } from "../../core/engine/rules/targeting.js";
import { calculateWeaponAttack } from "../../core/engine/rules/weapon.js";
import { calculateDamage } from "../../core/engine/rules/damage.js";
import { angleBetween } from "../../core/engine/geometry/angle.js";
import { validateMovement, validateRotation, validatePhaseAdvance, processMovement, processRotation, advancePhase } from "../../core/engine/modules/movement.js";
import { toggleShield, validateShieldToggle } from "../../core/engine/modules/shield.js";
import { ventFlux, canVent } from "../../core/engine/modules/flux.js";
import { Faction, type PlayerInfo } from "@vt/data";
import type { WsPayload, WsResponseData, CombatToken, InventoryToken, WeaponJSON } from "@vt/data";
import { createCombatToken } from "../../core/state/Token.js";
import { generateShortId } from "../utils/shortId.js";

const playerInfoService = new PlayerInfoService();
const playerProfileService = new PlayerProfileService(playerInfoService);
const shipBuildService = new ShipBuildService(playerInfoService);
const weaponService = new WeaponService(playerInfoService);
const presetService = new PresetService();
const assetService = new AssetService();

export const rpc = createRpcRegistry();

function err(message: string, code: string = "ERROR"): Error {
  return Object.assign(new Error(message), { code });
}

rpc.namespace("auth", {
  login: async (payload: unknown, ctx) => {
    const p = payload as WsPayload<"auth:login">;
    let result = await playerInfoService.findByUsername(p.playerName);
    let playerId: string;

    if (result) {
      playerId = result.file.info.playerId;
      await playerInfoService.updateInfo(playerId, { lastLogin: Date.now() });
    } else {
      playerId = generateShortId();
      await playerInfoService.create(p.playerName, playerId);
    }

    ctx.socket.data.playerId = playerId;
    ctx.socket.data.playerName = p.playerName;
    await playerProfileService.createAccount(playerId, p.playerName);
    return { playerId, playerName: p.playerName, isHost: false, role: "PLAYER" };
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
    const result = await playerInfoService.findByPlayerId(ctx.playerId);
    if (!result) throw err("玩家信息不存在", "PROFILE_NOT_FOUND");
    const info = result.file.info;
    return { profile: { playerId: info.playerId, nickname: info.displayName, avatar: info.avatar } };
  },
  update: async (payload: unknown, ctx) => {
    ctx.requireAuth();
    const p = payload as WsPayload<"profile:update">;
    const patch: Partial<PlayerInfo> = {};
    if (p.nickname !== undefined) patch.displayName = p.nickname;
    if (p.avatar !== undefined) patch.avatar = p.avatar;
    const updated = await playerInfoService.updateInfo(ctx.playerId, patch);
    if (!updated) throw err("更新失败", "UPDATE_FAILED");
    return { profile: { playerId: updated.playerId, nickname: updated.displayName, avatar: updated.avatar } };
  },
});

rpc.namespace("room", {
  create: async (payload: unknown, ctx) => {
    ctx.requireAuth();
    const p = payload as WsPayload<"room:create">;

    const existingRooms = ctx.roomManager.getAllRooms().filter(r => r.creatorId === ctx.playerId);
    if (existingRooms.length > 0) {
      throw err("你已拥有一个房间，请先删除现有房间", "ALREADY_HAS_ROOM");
    }

    const room = ctx.roomManager.createRoom({
      roomName: p.name,
      maxPlayers: p.maxPlayers ?? 4,
      mapWidth: p.mapWidth ?? 2000,
      mapHeight: p.mapHeight ?? 2000,
      creatorSessionId: ctx.playerId,
      creatorName: ctx.playerName,
    });
    if (!room) throw err("创建房间失败", "ROOM_CREATE_FAILED");

    ctx.io.emit("room:list_updated", {
      action: "created",
      room: {
        roomId: room.id,
        name: room.name,
        ownerId: ctx.playerId,
        ownerName: ctx.playerName,
        playerCount: 0,
        maxPlayers: room.maxPlayers,
        phase: room.phase,
      }
    });

    return { roomId: room.id, roomName: room.name, ownerId: ctx.playerId, isHost: true };
  },
  list: async (_, ctx) => {
    const rooms = ctx.roomManager.getAllRooms().map((r: any) => ({
      roomId: r.id,
      name: r.name,
      ownerId: r.creatorId,
      ownerName: r.creatorName ?? "未知",
      playerCount: r.playerCount,
      maxPlayers: r.maxPlayers,
      phase: r.phase,
      turnCount: r.gameState?.turnCount ?? 0,
      createdAt: r.createdAt,
    }));
    return { rooms };
  },
  join: async (payload: unknown, ctx) => {
    ctx.requireAuth();
    const p = payload as WsPayload<"room:join">;
    const room = ctx.roomManager.getRoom(p.roomId);
    if (!room) throw err("房间不存在", "ROOM_NOT_FOUND");

    const playerInfo = await playerInfoService.findByPlayerId(ctx.playerId);
    const avatar = playerInfo?.file.info.avatar ?? undefined;

    const joinSuccess = ctx.roomManager.joinRoom(p.roomId, ctx.socket.id, ctx.playerId, ctx.playerName, avatar);
    if (!joinSuccess) throw err("无法加入房间（可能已在房间中或房间已满）", "JOIN_FAILED");

    ctx.socket.join(p.roomId);
    ctx.socket.data.roomId = p.roomId;
    const isHost = room.creatorId === ctx.playerId;
    const role = isHost ? "HOST" : "PLAYER";
    ctx.socket.data.role = role;

    ctx.io.emit("room:list_updated", {
      action: "updated",
      room: {
        roomId: p.roomId,
        name: room.name,
        ownerId: room.creatorId,
        ownerName: room.creatorName,
        playerCount: room.getPlayerCount(),
        maxPlayers: room.maxPlayers,
        phase: room.phase,
      }
    });

    return {
      roomId: p.roomId,
      roomName: room.name,
      ownerId: room.creatorId,
      isHost,
      role,
      state: room.getGameState(),
    };
  },
  leave: async (_, ctx) => {
    ctx.requireRoom();
    const room = ctx.roomManager.getRoom(ctx.roomId);

    const leaveSuccess = ctx.roomManager.leaveRoom(ctx.roomId, ctx.playerId);

    ctx.socket.leave(ctx.roomId);
    ctx.socket.data.roomId = undefined;
    ctx.socket.data.role = undefined;

    if (room) {
      const playerCountAfter = room.getPlayerCount();
      ctx.io.emit("room:list_updated", {
        action: "updated",
        room: {
          roomId: ctx.roomId,
          name: room.name,
          ownerId: room.creatorId,
          ownerName: room.creatorName,
          playerCount: playerCountAfter,
          maxPlayers: room.maxPlayers,
          phase: room.phase,
        }
      });
    }

    if (!leaveSuccess) {
      console.warn(`leaveRoom returned false for player ${ctx.playerId} in room ${ctx.roomId}`);
    }
  },
  action: async (payload: unknown, ctx) => {
    ctx.requireRoom();
    const p = payload as WsPayload<"room:action">;
    const room = ctx.roomManager.getRoom(ctx.roomId);
    if (!room) throw err("房间不存在", "ROOM_NOT_FOUND");
    switch (p.action) {
      case "ready":
        room.togglePlayerReady(ctx.playerId);
        return;
      case "start":
        ctx.requireHost();
        ctx.state.changeTurn(1);
        ctx.state.changePhase("PLAYER_ACTION");
        return;
      case "kick":
        ctx.requireHost();
        if (!p.targetId) throw err("需要 targetId", "TARGET_REQUIRED");
        room.leavePlayer(p.targetId);
        ctx.state.removePlayer(p.targetId);
        return;
      case "transfer_host":
        ctx.requireHost();
        if (!p.targetId) throw err("需要 targetId", "TARGET_REQUIRED");
        room.creatorId = p.targetId;
        ctx.socket.data.role = "PLAYER";
        ctx.state.changeHost(p.targetId);
        return;
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
  delete: async (payload: unknown, ctx) => {
    ctx.requireAuth();
    const p = payload as WsPayload<"room:delete">;
    const room = ctx.roomManager.getRoom(p.roomId);
    if (!room) throw err("房间不存在", "ROOM_NOT_FOUND");
    if (room.creatorId !== ctx.playerId) throw err("只有房主可以删除房间", "NOT_HOST");
    await ctx.roomManager.removeRoom(p.roomId);
    return;
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
          ship = await shipBuildService.updateShipBuild(ctx.playerId, p.tokenId, p.token as InventoryToken);
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
          weapon = await weaponService.updateWeaponBuild(ctx.playerId, p.weaponId, p.weapon as WeaponJSON);
        } else {
          weapon = await weaponService.createWeaponBuild(ctx.playerId, p.weapon as WeaponJSON);
        }
        if (!weapon) throw err("操作失败", "UPSERT_FAILED");
        return { weapon };
      }
      case "delete": {
        if (!p.weaponId) throw err("需要 weaponId", "WEAPON_ID_REQUIRED");
        const success = await weaponService.deleteWeaponBuild(ctx.playerId, p.weaponId);
        if (!success) throw err("删除失败", "WEAPON_DELETE_FAILED");
        return;
      }
      case "copy_preset": {
        if (!p.presetId) throw err("需要 presetId", "PRESET_ID_REQUIRED");
        const weapon = await weaponService.createFromPreset(ctx.playerId, p.presetId);
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
            s.$id,
            s,
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
        const success = await playerInfoService.deleteRoomSave(ctx.playerId, p.saveId);
        if (!success) throw err("存档不存在", "SAVE_NOT_FOUND");
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
    const room = ctx.room!;
    const phase = room.getStateManager().getState().phase;

    if (phase !== "PLAYER_ACTION" && phase !== "DM_ACTION") {
      throw err("当前阶段不允许操作", "INVALID_PHASE");
    }

    if (phase === "DM_ACTION" && room.creatorId !== ctx.playerId) {
      throw err("DM回合只有房主可操作", "DM_ONLY");
    }

    if (phase === "PLAYER_ACTION" && room.creatorId !== ctx.playerId) {
      ctx.requireTokenControl(p.tokenId);
    }

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
        const direction = p.direction;

        const shieldValidation = validateShieldToggle(token, active);
        if (!shieldValidation.valid) throw err(shieldValidation.error ?? "护盾切换验证失败", "INVALID_SHIELD");

        const shieldResult = toggleShield(token, active);
        if (!shieldResult.success) throw err(shieldResult.reason ?? "护盾切换失败", "SHIELD_TOGGLE_FAILED");

        const runtime = token.runtime;
        const shieldRuntime = runtime?.shield;

        const updates: Record<string, unknown> = {
          shield: {
            ...shieldRuntime,
            active: shieldResult.newActive,
            direction: direction ?? shieldRuntime?.direction ?? 0,
          },
        };

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
        const tokenId = `token_${generateShortId()}_${Date.now()}`;

        const baseName = p.token.metadata?.name ?? p.token.$presetRef?.split(":").pop() ?? "舰船";
        const existingTokens = room.getCombatTokens();
        const sameTypeCount = existingTokens.filter(t => {
          const existingBaseName = t.metadata?.name ?? t.$presetRef?.split(":").pop() ?? "舰船";
          return existingBaseName === baseName;
        }).length;
        const displayName = `${baseName} ${sameTypeCount + 1}`;

        const createToken: CombatToken = {
          ...p.token,
          $id: tokenId,
          runtime: {
            ...p.token.runtime,
            position: p.position ?? p.token.runtime?.position ?? { x: 0, y: 0 },
            heading: p.token.runtime?.heading ?? 0,
            faction: p.faction ?? p.token.runtime?.faction ?? Faction.NEUTRAL,
            displayName,
          } as any,
          metadata: {
            ...p.token.metadata,
            owner: p.token.metadata?.owner ?? ctx.playerId,
          },
        };
        ctx.state.setToken(tokenId, createToken, ctx.editLogContext(p.reason ?? "创建舰船"));
        return { tokenId, displayName };
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
      case "rename": {
        if (!p.tokenId) throw err("需要 tokenId", "TOKEN_ID_REQUIRED");
        if (!p.displayName) throw err("需要 displayName", "DISPLAY_NAME_REQUIRED");
        const token = room.getCombatToken(p.tokenId);
        if (!token) throw err("舰船不存在", "TOKEN_NOT_FOUND");
        ctx.state.updateToken(p.tokenId, "runtime/displayName", p.displayName, ctx.editLogContext(p.reason ?? `更名为 ${p.displayName}`));
        return { tokenId: p.tokenId, displayName: p.displayName };
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
        const currentPhase = room.getStateManager().getState().phase;
        
        let nextPhase: typeof currentPhase;
        let incrementTurn = false;
        
        switch (currentPhase) {
          case "PLAYER_ACTION":
            nextPhase = "DM_ACTION";
            break;
          case "DM_ACTION":
            nextPhase = "PLAYER_ACTION";
            incrementTurn = true;
            break;
          case "TURN_END":
            nextPhase = "PLAYER_ACTION";
            incrementTurn = true;
            break;
          default:
            nextPhase = "PLAYER_ACTION";
        }
        
        ctx.state.changePhase(nextPhase);
        
        // 回合推进时重置所有玩家的准备状态
        ctx.state.resetAllPlayersReady();
        
        if (incrementTurn) {
          const newTurn = room.getStateManager().getState().turnCount + 1;
          ctx.state.changeTurn(newTurn);
          room.processTurnEndLogic();
        }
        
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
  const services = { playerProfile: playerProfileService, playerInfo: playerInfoService, shipBuild: shipBuildService, weapon: weaponService, preset: presetService, asset: assetService };
  const middleware = rpc.createMiddleware();

  roomManager.setOnRoomRemove(async (room: any, roomId: string) => {
    const gameState = room.getGameState();
    const creatorId = room.creatorId;

    if (gameState && creatorId && gameState.turnCount > 0) {
      const archiveId = `save_${roomId}_${Date.now()}`;
      const archive = {
        id: archiveId,
        name: room.name,
        saveJson: gameState,
        metadata: {
          roomId,
          roomName: room.name,
          mapWidth: gameState.mapWidth ?? 2000,
          mapHeight: gameState.mapHeight ?? 2000,
          maxPlayers: room.maxPlayers,
          playerCount: 0,
          totalTurns: gameState.turnCount,
          gameDuration: Date.now() - room.createdAt,
        },
        playerIds: Object.keys(gameState.players ?? {}),
        isAutoSave: true,
        tags: ["auto_cleanup"],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await playerInfoService.addRoomSave(creatorId, archive);
      console.log(`[RoomManager] Auto-saved room ${roomId} to archive ${archiveId} for creator ${creatorId}`);
    }

    io.emit("room:list_updated", { action: "removed", roomId });
  });

  io.on("connection", (socket: any) => {
    middleware(socket, io, roomManager, services);

    socket.on("disconnect", () => {
      const sd = socket.data as { playerId?: string; roomId?: string; role?: string };
      if (sd.roomId && sd.playerId) {
        roomManager.leaveRoom(sd.roomId, sd.playerId);
      }
      socket.data.roomId = undefined;
      socket.data.role = undefined;
    });
  });
}