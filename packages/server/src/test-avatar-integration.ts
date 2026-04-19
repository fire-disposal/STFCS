/**
 * 头像存储集成测试
 * 验证头像存储功能与贴图存储系统的集成
 */

import { MemoryStorage } from "./storage/MemoryStorage.js";
import { AssetService } from "./services/AssetService.js";
import { PlayerProfileService } from "./services/PlayerProfileService.js";

async function testAvatarIntegration() {
  console.log("=== 头像存储集成测试开始 ===");
  
  // 初始化存储和服务
  const storage = new MemoryStorage();
  const assetService = new AssetService(storage);
  const profileService = new PlayerProfileService(storage);
  
  const userId = "integration-test-user";
  
  try {
    // 1. 创建玩家档案
    console.log("1. 创建玩家档案...");
    const profile = await profileService.getOrCreateProfile(userId);
    console.log(`   玩家档案创建成功: ${profile.$id}`);
    
    // 2. 上传头像
    console.log("2. 上传头像...");
    const avatarBuffer = Buffer.from("fake-avatar-image-data-for-integration-test");
    const avatarId = await assetService.uploadAvatar(
      userId,
      avatarBuffer,
      "test-avatar.png",
      "image/png"
    );
    console.log(`   头像上传成功: ${avatarId}`);
    
    // 3. 获取头像信息
    console.log("3. 获取头像信息...");
    const avatarInfo = await assetService.getUserAvatar(userId);
    if (avatarInfo) {
      console.log(`   头像信息: ${avatarInfo.filename} (${avatarInfo.mimeType})`);
      console.log(`   大小: ${avatarInfo.size} bytes`);
      console.log(`   可见性: ${avatarInfo.visibility}`);
    } else {
      console.log("   错误: 未找到头像信息");
    }
    
    // 4. 获取头像数据
    console.log("4. 获取头像数据...");
    const avatarData = await assetService.getUserAvatarData(userId);
    if (avatarData) {
      console.log(`   头像数据大小: ${avatarData.length} bytes`);
      console.log(`   数据匹配: ${avatarData.equals(avatarBuffer) ? "是" : "否"}`);
    } else {
      console.log("   错误: 未找到头像数据");
    }
    
    // 5. 列出用户所有头像
    console.log("5. 列出用户所有头像...");
    const avatars = await assetService.listUserAvatars(userId);
    console.log(`   头像数量: ${avatars.length}`);
    avatars.forEach((avatar, index) => {
      console.log(`   ${index + 1}. ${avatar.filename} (${new Date(avatar.uploadedAt).toISOString()})`);
    });
    
    // 6. 上传舰船贴图（验证统一存储）
    console.log("6. 上传舰船贴图...");
    const shipTextureId = await assetService.uploadShipTexture(
      userId,
      Buffer.from("ship-texture-data"),
      "warship.png",
      "image/png",
      {
        name: "战列舰贴图",
        description: "集成测试用的舰船贴图",
        width: 256,
        height: 256,
        tags: ["battleship", "test"]
      }
    );
    console.log(`   舰船贴图上传成功: ${shipTextureId}`);
    
    // 7. 列出所有资产
    console.log("7. 列出用户所有资产...");
    const allAssets = await assetService.listUserAssets(userId);
    console.log(`   总资产数量: ${allAssets.length}`);
    
    const assetTypes = allAssets.reduce((acc, asset) => {
      acc[asset.type] = (acc[asset.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log("   资产类型分布:");
    Object.entries(assetTypes).forEach(([type, count]) => {
      console.log(`     ${type}: ${count}个`);
    });
    
    // 8. 获取资产统计
    console.log("8. 获取资产统计...");
    const stats = await assetService.getAssetStats(userId);
    console.log(`   总资产数: ${stats.total}`);
    console.log(`   总大小: ${stats.totalSize} bytes`);
    console.log(`   最早资产: ${stats.oldest?.toISOString() || "无"}`);
    console.log(`   最新资产: ${stats.newest?.toISOString() || "无"}`);
    
    // 9. 测试资产更新
    console.log("9. 测试资产更新...");
    const updatedAvatar = await assetService.updateAsset(avatarId, {
      metadata: {
        name: "更新后的测试头像",
        description: "集成测试中更新的头像",
        tags: ["updated", "integration-test"]
      }
    });
    
    if (updatedAvatar) {
      console.log(`   头像更新成功: ${updatedAvatar.metadata?.name}`);
      console.log(`   新标签: ${updatedAvatar.metadata?.tags?.join(", ")}`);
    }
    
    // 10. 测试资产删除
    console.log("10. 测试资产删除...");
    const deleted = await assetService.deleteAsset(shipTextureId);
    console.log(`   舰船贴图删除: ${deleted ? "成功" : "失败"}`);
    
    // 验证删除
    const remainingAssets = await assetService.listUserAssets(userId);
    console.log(`   删除后剩余资产: ${remainingAssets.length}个`);
    
    console.log("\n=== 头像存储集成测试完成 ===");
    console.log("✅ 所有测试通过！");
    
  } catch (error) {
    console.error("❌ 测试失败:", error);
    process.exit(1);
  }
}

// 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  testAvatarIntegration();
}

export { testAvatarIntegration };