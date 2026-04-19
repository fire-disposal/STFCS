/**
 * 资产服务测试
 * 测试头像和贴图存储功能
 */

import { MemoryStorage } from "../storage/MemoryStorage.js";
import { AssetService } from "./AssetService.js";

describe("AssetService", () => {
  let storage: MemoryStorage;
  let assetService: AssetService;
  
  beforeEach(() => {
    storage = new MemoryStorage();
    assetService = new AssetService(storage);
  });
  
  describe("头像上传和获取", () => {
    it("应该能上传头像并获取头像信息", async () => {
      const userId = "test-user-123";
      const buffer = Buffer.from("fake-image-data");
      const filename = "avatar.png";
      const mimeType = "image/png";
      
      // 上传头像
      const assetId = await assetService.uploadAvatar(userId, buffer, filename, mimeType);
      
      expect(assetId).toBeDefined();
      expect(assetId).toMatch(/^asset:avatar_/);
      
      // 获取头像信息
      const avatar = await assetService.getUserAvatar(userId);
      
      expect(avatar).toBeDefined();
      expect(avatar?.$id).toBe(assetId);
      expect(avatar?.type).toBe("avatar");
      expect(avatar?.filename).toBe(filename);
      expect(avatar?.mimeType).toBe(mimeType);
      expect(avatar?.ownerId).toBe(`player:${userId}`);
      expect(avatar?.visibility).toBe("public");
    });
    
    it("应该能获取用户头像数据", async () => {
      const userId = "test-user-456";
      const buffer = Buffer.from("another-fake-image");
      const filename = "profile.jpg";
      const mimeType = "image/jpeg";
      
      // 上传头像
      const assetId = await assetService.uploadAvatar(userId, buffer, filename, mimeType);
      
      // 获取头像数据
      const avatarData = await assetService.getUserAvatarData(userId);
      
      expect(avatarData).toBeDefined();
      expect(Buffer.isBuffer(avatarData)).toBe(true);
      expect(avatarData?.toString()).toBe("another-fake-image");
    });
    
    it("应该能列出用户的所有头像", async () => {
      const userId = "test-user-789";
      
      // 上传多个头像
      await assetService.uploadAvatar(
        userId, 
        Buffer.from("avatar1"), 
        "avatar1.png", 
        "image/png"
      );
      
      await new Promise(resolve => setTimeout(resolve, 10)); // 确保时间戳不同
      
      await assetService.uploadAvatar(
        userId, 
        Buffer.from("avatar2"), 
        "avatar2.jpg", 
        "image/jpeg"
      );
      
      // 列出头像
      const avatars = await assetService.listUserAvatars(userId);
      
      expect(avatars).toHaveLength(2);
      expect(avatars[0].filename).toBe("avatar2.jpg"); // 最新的在前
      expect(avatars[1].filename).toBe("avatar1.png");
    });
    
    it("应该返回null当用户没有头像时", async () => {
      const userId = "user-without-avatar";
      
      const avatar = await assetService.getUserAvatar(userId);
      const avatarData = await assetService.getUserAvatarData(userId);
      
      expect(avatar).toBeNull();
      expect(avatarData).toBeNull();
    });
  });
  
  describe("贴图上传和获取", () => {
    it("应该能上传舰船贴图", async () => {
      const userId = "ship-texture-user";
      const buffer = Buffer.from("ship-texture-data");
      const filename = "warship.png";
      const mimeType = "image/png";
      
      const assetId = await assetService.uploadShipTexture(
        userId, 
        buffer, 
        filename, 
        mimeType,
        {
          name: "战列舰贴图",
          description: "自定义战列舰外观",
          width: 256,
          height: 256,
          tags: ["battleship", "custom"]
        }
      );
      
      expect(assetId).toBeDefined();
      expect(assetId).toMatch(/^asset:ship_texture_/);
      
      const asset = await assetService.getAsset(assetId);
      expect(asset).toBeDefined();
      expect(asset?.type).toBe("ship_texture");
      expect(asset?.metadata?.name).toBe("战列舰贴图");
      expect(asset?.metadata?.tags).toContain("battleship");
      expect(asset?.visibility).toBe("private");
    });
    
    it("应该能上传自定义贴图", async () => {
      const userId = "custom-texture-user";
      const buffer = Buffer.from("custom-texture-data");
      const filename = "background.jpg";
      const mimeType = "image/jpeg";
      
      const assetId = await assetService.uploadCustomTexture(
        userId,
        buffer,
        filename,
        mimeType,
        {
          name: "游戏背景",
          description: "自定义游戏背景图片",
          width: 1920,
          height: 1080,
          tags: ["background", "ui"]
        }
      );
      
      expect(assetId).toBeDefined();
      expect(assetId).toMatch(/^asset:custom_texture_/);
      
      const asset = await assetService.getAsset(assetId);
      expect(asset).toBeDefined();
      expect(asset?.type).toBe("custom_texture");
      expect(asset?.metadata?.name).toBe("游戏背景");
      expect(asset?.metadata?.tags).toContain("background");
    });
  });
  
  describe("资产管理和搜索", () => {
    it("应该能按类型过滤资产", async () => {
      const userId = "filter-user";
      
      // 上传不同类型的资产
      await assetService.uploadAvatar(userId, Buffer.from("avatar"), "avatar.png", "image/png");
      await assetService.uploadShipTexture(userId, Buffer.from("ship"), "ship.png", "image/png");
      await assetService.uploadCustomTexture(userId, Buffer.from("custom"), "custom.png", "image/png");
      
      // 只获取头像
      const avatars = await assetService.listUserAssets(userId, { type: 'avatar' });
      expect(avatars).toHaveLength(1);
      expect(avatars[0].type).toBe("avatar");
      
      // 获取所有贴图
      const textures = await assetService.listUserAssets(userId, { 
        type: ['ship_texture', 'custom_texture'] 
      });
      expect(textures).toHaveLength(2);
      expect(textures.map(t => t.type)).toEqual(
        expect.arrayContaining(['ship_texture', 'custom_texture'])
      );
    });
    
    it("应该能按标签搜索资产", async () => {
      const userId = "tag-user";
      
      await assetService.uploadShipTexture(
        userId, 
        Buffer.from("texture1"), 
        "texture1.png", 
        "image/png",
        { tags: ["battleship", "red"] }
      );
      
      await assetService.uploadShipTexture(
        userId, 
        Buffer.from("texture2"), 
        "texture2.png", 
        "image/png",
        { tags: ["cruiser", "blue"] }
      );
      
      await assetService.uploadCustomTexture(
        userId,
        Buffer.from("texture3"),
        "texture3.png",
        "image/png",
        { tags: ["background", "red"] }
      );
      
      // 搜索红色标签的资产
      const redAssets = await assetService.listUserAssets(userId, { tags: ['red'] });
      expect(redAssets).toHaveLength(2);
      
      // 搜索舰船标签的资产
      const shipAssets = await assetService.listUserAssets(userId, { tags: ['battleship', 'cruiser'] });
      expect(shipAssets).toHaveLength(2);
    });
    
    it("应该能获取资产统计信息", async () => {
      const userId = "stats-user";
      
      // 上传多个资产
      await assetService.uploadAvatar(userId, Buffer.from("a"), "a.png", "image/png");
      await assetService.uploadShipTexture(userId, Buffer.from("b"), "b.png", "image/png");
      await assetService.uploadCustomTexture(userId, Buffer.from("c"), "c.png", "image/png");
      
      const stats = await assetService.getAssetStats(userId);
      
      expect(stats.total).toBe(3);
      expect(stats.byType.avatar).toBe(1);
      expect(stats.byType.ship_texture).toBe(1);
      expect(stats.byType.custom_texture).toBe(1);
      expect(stats.totalSize).toBe(3); // 每个buffer长度为1
    });
  });
  
  describe("资产管理操作", () => {
    it("应该能更新资产元数据", async () => {
      const userId = "update-user";
      const assetId = await assetService.uploadAvatar(
        userId, 
        Buffer.from("avatar"), 
        "oldname.png", 
        "image/png"
      );
      
      // 等待一小段时间确保时间戳不同
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const updated = await assetService.updateAsset(assetId, {
        metadata: {
          name: "新头像名称",
          description: "更新后的头像描述",
          tags: ["updated", "profile"]
        }
      });
      
      expect(updated).toBeDefined();
      expect(updated?.metadata?.name).toBe("新头像名称");
      expect(updated?.metadata?.description).toBe("更新后的头像描述");
      expect(updated?.metadata?.tags).toContain("updated");
      expect(updated?.updatedAt).toBeGreaterThan(updated?.uploadedAt || 0);
    });
    
    it("应该能删除资产", async () => {
      const userId = "delete-user";
      const assetId = await assetService.uploadAvatar(
        userId, 
        Buffer.from("avatar"), 
        "todelete.png", 
        "image/png"
      );
      
      // 确认资产存在
      const assetBefore = await assetService.getAsset(assetId);
      expect(assetBefore).toBeDefined();
      
      // 删除资产
      const deleted = await assetService.deleteAsset(assetId);
      expect(deleted).toBe(true);
      
      // 确认资产已删除
      const assetAfter = await assetService.getAsset(assetId);
      expect(assetAfter).toBeNull();
    });
    
    it("应该能共享资产", async () => {
      const ownerId = "owner-user";
      const shareUserId = "share-user";
      const assetId = await assetService.uploadShipTexture(
        ownerId, 
        Buffer.from("texture"), 
        "shared.png", 
        "image/png"
      );
      
      const sharedAsset = await assetService.shareAsset(assetId, [shareUserId]);
      
      expect(sharedAsset).toBeDefined();
      expect(sharedAsset?.visibility).toBe("shared");
      expect(sharedAsset?.sharedWith).toContain(`player:${shareUserId}`);
    });
    
    it("应该能更改资产可见性", async () => {
      const userId = "visibility-user";
      const assetId = await assetService.uploadShipTexture(
        userId, 
        Buffer.from("texture"), 
        "texture.png", 
        "image/png"
      );
      
      // 改为公开
      const publicAsset = await assetService.makeAssetPublic(assetId);
      expect(publicAsset?.visibility).toBe("public");
      
      // 改回私有
      const privateAsset = await assetService.makeAssetPrivate(assetId);
      expect(privateAsset?.visibility).toBe("private");
    });
  });
});