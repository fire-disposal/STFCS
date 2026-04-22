/**
 * RPC Handlers - 简洁的类型安全 handler 注册
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
import { SIZE_COMPATIBILITY, Faction } from "@vt/data";
import type { WsPayload, CombatToken } from "@vt/data";
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
      ctx.state.removePlayer(ctx.playerId).commit();
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
    injectRoomCallbacks(room, ctx.io);
    ctx.socket.join(room.id);
    ctx.socket.data.roomId = room.id;
    ctx.socket.data.role = "HOST";
    ctx.state.addPlayer(ctx.playerId, { sessionId: ctx.socket.id, nickname: ctx.playerName, role: "HOST" });
    return { roomId: room.id, roomName: room.name, isHost: true };
  },
  list: async (_, ctx) => {
    const rooms = ctx.roomManager.getAllRooms().map((r: any) => ({
      roomId: r.id,
      name: r.name,
      playerCount: r.playerCount,
      maxPlayers: r.maxPlayers,
      phase: r.phase,
      turnCount: r.gameState?.turn ?? 0,
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
    ctx.state.addPlayer(ctx.playerId, { sessionId: ctx.socket.id, nickname: ctx.playerName, role });
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

rpc.namespace("token", {
  list: async (_, ctx) => {
    ctx.requireAuth();
    const ships = await playerProfileService.getPlayerShips(ctx.playerId);
    return { ships };
  },
  get: async (payload: unknown, ctx) => {
    ctx.requireAuth();
    const p = payload as WsPayload<"token:get">;
    const ship = await playerProfileService.getPlayerShip(ctx.playerId, p.tokenId);
    if (!ship) throw err("舰船不存在", "TOKEN_NOT_FOUND");
    return { ship };
  },
  create: async (payload: unknown, ctx) => {
    ctx.requireAuth();
    const p = payload as WsPayload<"token:create">;
    const ship = await shipBuildService.createShipBuild(ctx.playerId, p.token);
    return { ship };
  },
  update: async (payload: unknown, ctx) => {
    ctx.requireAuth();
    const p = payload as WsPayload<"token:update">;
    const existing = await playerProfileService.getPlayerShip(ctx.playerId, p.tokenId);
    if (!existing) throw err("舰船不存在或非本人", "TOKEN_NOT_FOUND");
    const ship = await shipBuildService.updateShipBuild(p.tokenId, p.updates);
    if (!ship) throw err("更新失败", "UPDATE_FAILED");
    return { ship };
  },
  delete: async (payload: unknown, ctx) => {
    ctx.requireAuth();
    const p = payload as WsPayload<"token:delete">;
    const success = await playerProfileService.deletePlayerShip(ctx.playerId, p.tokenId);
    if (!success) throw err("删除失败", "TOKEN_DELETE_FAILED");
  },
  copy_preset: async (payload: unknown, ctx) => {
    ctx.requireAuth();
    const p = payload as WsPayload<"token:copy_preset">;
    const ship = await shipBuildService.createFromPreset(ctx.playerId, p.presetId);
    return { ship };
  },
  mount: async (payload: unknown, ctx) => {
    ctx.requireAuth();
    const p = payload as WsPayload<"token:mount">;
    const ship = await playerProfileService.getPlayerShip(ctx.playerId, p.tokenId);
    if (!ship) throw err("舰船不存在", "TOKEN_NOT_FOUND");
    const shipJson = ship.data;
    const mountIndex = shipJson.spec.mounts?.findIndex((m: { id: string }) => m.id === p.mountId);
    if (mountIndex === undefined || mountIndex < 0) throw err("挂载点不存在", "MOUNT_NOT_FOUND");
    if (shipJson.spec.mounts && shipJson.spec.mounts[mountIndex]) {
      if (p.weaponId === null) {
        shipJson.spec.mounts[mountIndex].weapon = undefined;
      } else {
        const weapon = await playerProfileService.getPlayerWeapon(ctx.playerId, p.weaponId);
        if (!weapon) throw err("武器不存在", "WEAPON_NOT_FOUND");
        const mount = shipJson.spec.mounts[mountIndex];
        if (!SIZE_COMPATIBILITY[mount.size]?.includes(weapon.data.spec.size)) {
          throw err(`武器尺寸 ${weapon.data.spec.size} 不兼容挂载点尺寸 ${mount.size}`, "WEAPON_SIZE_INCOMPATIBLE");
        }
        shipJson.spec.mounts[mountIndex].weapon = weapon.data;
      }
    }
    const updated = await shipBuildService.updateShipBuild(p.tokenId, { data: shipJson });
    if (!updated) throw err("更新失败", "UPDATE_FAILED");
    return { ship: updated };
  },
});

rpc.namespace("weapon", {
  list: async (_, ctx) => {
    ctx.requireAuth();
    const weapons = await playerProfileService.getPlayerWeapons(ctx.playerId);
    return { weapons };
  },
  get: async (payload: unknown, ctx) => {
    ctx.requireAuth();
    const p = payload as WsPayload<"weapon:get">;
    const weapon = await playerProfileService.getPlayerWeapon(ctx.playerId, p.weaponId);
    if (!weapon) throw err("武器不存在", "WEAPON_NOT_FOUND");
    return { weapon };
  },
  create: async (payload: unknown, ctx) => {
    ctx.requireAuth();
    const p = payload as WsPayload<"weapon:create">;
    const weapon = await persistence.weapons.create({
      id: p.weapon.$id,
      data: p.weapon,
      ownerId: ctx.playerId,
      isPreset: false,
      tags: [],
      usageCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return { weapon };
  },
  update: async (payload: unknown, ctx) => {
    ctx.requireAuth();
    const p = payload as WsPayload<"weapon:update">;
    const existing = await playerProfileService.getPlayerWeapon(ctx.playerId, p.weaponId);
    if (!existing) throw err("武器不存在", "WEAPON_NOT_FOUND");
    const weapon = await persistence.weapons.update(p.weaponId, p.updates);
    if (!weapon) throw err("更新失败", "UPDATE_FAILED");
    return { weapon };
  },
  delete: async (payload: unknown, ctx) => {
    ctx.requireAuth();
    const p = payload as WsPayload<"weapon:delete">;
    const success = await playerProfileService.deletePlayerWeapon(ctx.playerId, p.weaponId);
    if (!success) throw err("删除失败", "WEAPON_DELETE_FAILED");
  },
  copy_preset: async (payload: unknown, ctx) => {
    ctx.requireAuth();
    const p = payload as WsPayload<"weapon:copy_preset">;
    const preset = await presetService.getWeaponPresetById(p.presetId);
    if (!preset) throw err("预设武器不存在", "PRESET_NOT_FOUND");
    const data = JSON.parse(JSON.stringify(preset));
    data.id = `weapon:${ctx.playerId}_${Date.now().toString(36)}`;
    const weapon = await persistence.weapons.create({
      id: data.id,
      data,
      ownerId: ctx.playerId,
      isPreset: false,
      tags: ["preset-copy"],
      usageCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return { weapon };
  },
});

rpc.namespace("save", {
  list: async (_, ctx) => {
    ctx.requireAuth();
    const saves = await playerProfileService.listSaves(ctx.playerId);
    return { saves };
  },
  create: async (payload: unknown, ctx) => {
    ctx.requireAuth();
    const p = payload as WsPayload<"save:create">;
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
  },
  load: async (payload: unknown, ctx) => {
    ctx.requireRoom();
    ctx.requireHost();
    const p = payload as WsPayload<"save:load">;
    const saves = await playerProfileService.listSaves(ctx.playerId);
    const save = saves.find(s => s.$id === p.saveId);
    if (!save) throw err("存档不存在", "SAVE_NOT_FOUND");
    const room = ctx.room!;
    const stateManager = room.getStateManager();
    stateManager.clearTokens();
    for (const token of save.tokens) {
      stateManager.createCombatTokenFromJson(token, token.runtime.position, token.runtime.heading, token.runtime.faction, ctx.playerId);
    }
    ctx.state.broadcastFull();
  },
  delete: async (payload: unknown, ctx) => {
    ctx.requireAuth();
    const p = payload as WsPayload<"save:delete">;
    const saves = await playerProfileService.listSaves(ctx.playerId);
    const save = saves.find(s => s.$id === p.saveId);
    if (!save) throw err("存档不存在", "SAVE_NOT_FOUND");
    await persistence.roomSaves.delete(p.saveId);
  },
});

rpc.namespace("asset", {
  upload: async (payload: unknown, ctx) => {
    ctx.requireAuth();
    const p = payload as WsPayload<"asset:upload">;
    const buffer = Buffer.from(p.data, "base64");
    let assetId = "";
    switch (p.type) {
      case "avatar":
        assetId = await assetService.uploadAvatar(ctx.playerId, buffer, p.filename, p.mimeType);
        break;
      case "ship_texture":
        assetId = await assetService.uploadShipTexture(ctx.playerId, buffer, p.filename, p.mimeType);
        break;
      case "weapon_texture":
        assetId = await assetService.uploadWeaponTexture(ctx.playerId, buffer, p.filename, p.mimeType);
        break;
    }
    return { assetId };
  },
  list: async (payload: unknown, _) => {
    const p = payload as WsPayload<"asset:list">;
    const assets = await assetService.listAssets(p.type, p.ownerId);
    return { assets };
  },
  batch_get: async (payload: unknown, _) => {
    const p = payload as WsPayload<"asset:batch_get">;
    const results = await assetService.batchGetAssets(p.assetIds, p.includeData);
    return { results };
  },
  delete: async (payload: unknown, ctx) => {
    ctx.requireAuth();
    const p = payload as WsPayload<"asset:delete">;
    const asset = await assetService.getAsset(p.assetId);
    if (!asset) throw err("资产不存在", "ASSET_NOT_FOUND");
    if (asset.ownerId !== ctx.playerId) throw err("非本人资产", "NOT_OWNER");
    const success = await assetService.deleteAsset(p.assetId);
    if (!success) throw err("删除失败", "ASSET_DELETE_FAILED");
  },
});

rpc.namespace("preset", {
  list_tokens: async (payload: unknown, _) => {
    const p = payload as WsPayload<"preset:list_tokens">;
    let presets;
    if (p.size) presets = await presetService.getShipPresetsBySize(p.size);
    else if (p.class) presets = await presetService.getShipPresetsByClass(p.class);
    else presets = await presetService.getShipPresets();
    return { presets };
  },
  list_weapons: async (payload: unknown, _) => {
    const p = payload as WsPayload<"preset:list_weapons">;
    let presets;
    if (p.size) presets = await presetService.getWeaponPresetsBySize(p.size);
    else if (p.damageType) presets = await presetService.getWeaponPresetsByDamageType(p.damageType);
    else presets = await presetService.getWeaponPresets();
    return { presets };
  },
  get_token: async (payload: unknown, _) => {
    const p = payload as WsPayload<"preset:get_token">;
    const preset = await presetService.getShipPresetById(p.presetId);
    if (!preset) throw err("预设舰船不存在", "PRESET_NOT_FOUND");
    return { preset };
  },
  get_weapon: async (payload: unknown, _) => {
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
        room.updateCombatTokenRuntime(p.tokenId, { position: moveResult.newPosition, movement: moveResult.newMovementState });
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
        room.updateCombatTokenRuntime(p.tokenId, { heading: rotateResult.newHeading, movement: rotateResult.newMovementState });
        ctx.state.updateTokenRuntime(p.tokenId, { heading: rotateResult.newHeading, movement: rotateResult.newMovementState });
        break;
      }
      case "shield": {
        const token = room.getCombatToken(p.tokenId);
        if (!token) throw err("舰船不存在", "TOKEN_NOT_FOUND");
        const active = p.active ?? false;
        const direction = (p as any).direction as number | undefined;
        const shieldValidation = validateShieldToggle(token, active);
        if (!shieldValidation.valid) throw err(shieldValidation.error ?? "护盾切换验证失败", "INVALID_SHIELD");
        const shieldResult = toggleShield(token, active);
        if (!shieldResult.success) throw err(shieldResult.reason ?? "护盾切换失败", "SHIELD_TOGGLE_FAILED");
        const runtime = token.runtime;
        const shieldRuntime = runtime?.shield;
        if (direction !== undefined && shieldRuntime && active) {
          shieldRuntime.direction = direction;
        }
        const updates: Record<string, unknown> = { shield: shieldRuntime };
        if (shieldResult.fluxCost && shieldResult.fluxCost > 0) {
          const newFluxSoft = (runtime?.fluxSoft ?? 0) + shieldResult.fluxCost;
          updates["fluxSoft"] = newFluxSoft;
        }
        room.updateCombatTokenRuntime(p.tokenId, updates);
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
        const runtime = token.runtime;
        room.updateCombatTokenRuntime(p.tokenId, {
          fluxSoft: 0,
          fluxHard: 0,
          venting: true,
          overloaded: runtime?.overloaded ?? false,
          shield: runtime?.shield,
        });
        ctx.state.updateTokenRuntime(p.tokenId, {
          fluxSoft: 0,
          fluxHard: 0,
          venting: true,
          overloaded: runtime?.overloaded ?? false,
        });
        break;
      }
      case "advance_phase": {
        const token = room.getCombatToken(p.tokenId);
        if (!token) throw err("舰船不存在", "TOKEN_NOT_FOUND");
        const phaseValidation = validatePhaseAdvance(token);
        if (!phaseValidation.valid) throw err(phaseValidation.error ?? "阶段推进验证失败", "INVALID_PHASE_ADVANCE");
        const phaseResult = advancePhase(token);
        room.updateCombatTokenRuntime(p.tokenId, { movement: phaseResult.newMovementState });
        ctx.state.updateTokenRuntime(p.tokenId, { movement: phaseResult.newMovementState });
        break;
      }
      case "end_turn":
        break;
      case "attack":
        if (!p.allocations || p.allocations.length === 0) {
          throw err("攻击配置无效", "INVALID_ATTACK");
        }
        const attackerToken = room.getCombatToken(p.tokenId);
        if (!attackerToken) throw err("攻击舰船不存在", "TOKEN_NOT_FOUND");

        const allocations: WeaponAllocation[] = p.allocations.map((a) => ({
          mountId: a.mountId,
          targets: a.targets.map((t) => ({ targetId: t.targetId, shotCount: t.shots })),
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
          const mount = attackerSpec.mounts?.find((m) => m.id === alloc.mountId);
          const weaponIdx = updatedWeapons.findIndex((w) => w.mountId === alloc.mountId);
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

              room.updateCombatTokenRuntime(target.targetId, {
                hull: newHull,
                armor: newArmor,
                fluxHard: newFluxHard,
                overloaded: overloaded ? true : targetRuntime.overloaded,
                overloadTime: overloaded ? 1 : targetRuntime.overloadTime,
                destroyed: destroyed ? true : targetRuntime.destroyed,
              });
              ctx.state.updateTokenRuntime(target.targetId, {
                hull: newHull,
                armor: newArmor,
                fluxHard: newFluxHard,
                overloaded,
                destroyed,
              });
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
        room.updateCombatTokenRuntime(p.tokenId, {
          fluxSoft: newAttackerFluxSoft,
          weapons: updatedWeapons,
        });
        ctx.state.updateTokenRuntime(p.tokenId, {
          fluxSoft: newAttackerFluxSoft,
          weapons: updatedWeapons,
        });
        break;
      case "end_turn":
        break;
      case "advance_phase":
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
      default:
        throw err(`未知查询类型: ${p.type}`, "UNKNOWN_QUERY_TYPE");
    }
  },
});

rpc.namespace("dm", {
  spawn: async (payload: unknown, ctx) => {
    ctx.requireHost();
    const p = payload as WsPayload<"dm:spawn">;
    const tokenId = `token_${Date.now()}`;
    const room = ctx.room!;
    room.getStateManager().createCombatTokenFromJson(p.token, p.position ?? { x: 0, y: 0 }, 0, p.faction, undefined);
    ctx.state.addToken(tokenId, p.token);
    return { tokenId };
  },
  modify: async (payload: unknown, ctx) => {
    ctx.requireHost();
    const p = payload as WsPayload<"dm:modify">;
    const room = ctx.room!;
    const token = room.getCombatToken(p.tokenId);
    if (!token) throw err("舰船不存在", "TOKEN_NOT_FOUND");
    const oldValue = token.runtime?.[p.field as keyof typeof token.runtime];
    room.updateCombatTokenRuntime(p.tokenId, { [p.field]: p.value });
    ctx.state.updateToken(p.tokenId, p.field, p.value, oldValue);
  },
  remove: async (payload: unknown, ctx) => {
    ctx.requireHost();
    const p = payload as WsPayload<"dm:remove">;
    const room = ctx.room!;
    const token = room.getCombatToken(p.tokenId);
    if (!token) throw err("舰船不存在", "TOKEN_NOT_FOUND");
    room.getStateManager().removeToken(p.tokenId);
    ctx.state.removeToken(p.tokenId);
  },
  set_modifier: async (payload: unknown, ctx) => {
    ctx.requireHost();
    const p = payload as WsPayload<"dm:set_modifier">;
    const room = ctx.room!;
    room.getStateManager().setGlobalModifier(p.key, p.value);
    ctx.state.addModifier(p.key, p.value);
  },
  force_end_turn: async (payload: unknown, ctx) => {
    ctx.requireHost();
    const p = payload as WsPayload<"dm:force_end_turn">;
    const room = ctx.room!;
    room.nextTurn();
    const state = room.getStateManager().getState();
    ctx.state.changeTurn(state.turn);
    if (p.faction) ctx.state.changeFaction(p.faction);
  },
});

rpc.on("sync:request_full", async (_, ctx) => {
  ctx.requireRoom();
  if (!ctx.room) throw err("房间不存在", "ROOM_NOT_FOUND");
  return ctx.room.getGameState();
});

function injectRoomCallbacks(room: any, io: any): void {
  const roomId = room.id;
  room.callbacks = {
    sendToPlayer: (playerId: string, message: unknown) => {
      io.to(roomId).emit("event", { targetPlayer: playerId, ...message as Record<string, unknown> });
    },
    broadcast: (message: unknown) => io.to(roomId).emit("event", message),
    broadcastToFaction: (faction: string, message: unknown) => {
      io.to(roomId).emit("event", { targetFaction: faction, ...message as Record<string, unknown> });
    },
    broadcastExcept: (excludePlayerId: string, message: unknown) => {
      io.to(roomId).emit("event", { excludePlayer: excludePlayerId, ...message as Record<string, unknown> });
    },
    broadcastToSpectators: () => {},
    broadcastToPlayers: (message: unknown) => io.to(roomId).emit("event", message),
  };
}

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