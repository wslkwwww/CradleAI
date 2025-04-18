// 导出群聊功能模块的所有组件

export * from './group-types';
export * from './group-service';
export * from './group-manager';
export { GroupScheduler } from './group-scheduler'; // Only export GroupScheduler to avoid conflict

// 基础API函数导出，方便直接调用
import { GroupManager } from './group-manager';
import { GroupService } from './group-service';
import { GroupScheduler, GroupSettings } from './group-scheduler';
import { Character, User } from '../../shared/types';
import { Group, GroupMessage } from './group-types';
import AsyncStorage from '@react-native-async-storage/async-storage';
/**
 * 创建一个新的群聊
 * @param user 当前用户
 * @param groupName 群聊名称
 * @param groupTopic 群聊主题
 * @param characters 初始角色列表
 */
export async function createUserGroup(
  user: User,
  groupName: string,
  groupTopic: string,
  characters: Character[] = []
): Promise<Group | null> {
  const manager = new GroupManager(user);
  const newGroup = await manager.createGroup(groupName, groupTopic, characters);
  
  // Ensure character data is properly loaded for immediate use
  if (newGroup && characters.length > 0) {
    console.log(`[createUserGroup] New group created with ${characters.length} characters, ensuring data consistency`);
    
    // Validate character data is immediately available
    try {
      // Force an immediate storage update to ensure consistency
      const characterIds = newGroup.groupMemberIds.filter(id => id !== user.id);
      await GroupService.getCharactersByIds(characterIds);
    } catch (error) {
      console.error('[createUserGroup] Error validating character data:', error);
    }
  }
  
  return newGroup;
}

/**
 * 向群聊发送消息
 * @param user 当前用户
 * @param groupId 群聊ID
 * @param content 消息内容
 */
export async function sendGroupMessage(
  user: User,
  groupId: string,
  content: string
): Promise<GroupMessage | null> {
  const manager = new GroupManager(user);
  return await manager.sendMessage(groupId, content);
}

/**
 * 获取用户的所有群聊
 * @param user 当前用户
 */
export async function getUserGroups(user: User): Promise<Group[]> {
  const manager = new GroupManager(user);
  return await manager.getUserGroups();
}

/**
 * 获取群聊消息
 * @param groupId 群聊ID
 * @param listener 可选的消息更新监听器
 */
export async function getGroupMessages(
  groupId: string, 
  listener?: (messages: GroupMessage[]) => void
): Promise<GroupMessage[]> {
  if (listener) {
    // 添加监听器
    GroupService.addMessageListener(groupId, listener);
  }
  return await GroupService.getGroupMessages(groupId);
}

/**
 * 添加群聊消息监听器
 * @param groupId 群聊ID
 * @param listener 消息更新监听器
 */
export function addGroupMessageListener(
  groupId: string,
  listener: (messages: GroupMessage[]) => void
): () => void {
  return GroupService.addMessageListener(groupId, listener);
}

/**
 * 移除群聊消息监听器
 * @param groupId 群聊ID
 * @param listener 消息更新监听器
 */
export function removeGroupMessageListener(
  groupId: string,
  listener: (messages: GroupMessage[]) => void
): void {
  GroupService.removeMessageListener(groupId, listener);
}

/**
 * 解散群聊
 * @param user 当前用户
 * @param groupId 群聊ID
 */
export async function disbandGroup(
  user: User,
  groupId: string
): Promise<boolean> {
  const manager = new GroupManager(user);
  return await manager.disbandGroup(groupId);
}

/**
 * 更新群聊设置
 * @param groupId 群聊ID
 * @param settings 群聊设置
 */
export async function updateGroupSettings(
  groupId: string,
  settings: GroupSettings
): Promise<void> {
  try {
    // 获取GroupScheduler实例并更新设置
    const scheduler = GroupScheduler.getInstance();
    scheduler.setGroupSettings(groupId, settings);
    
    // 同时确保设置保存到专用存储键，以便在重启应用后可以持久化
    const storageKey = `group_settings_${groupId}`;
    await AsyncStorage.setItem(storageKey, JSON.stringify(settings));
    
    console.log(`[group/index] Group settings updated and persisted for group ${groupId}:`, settings);
    
    return Promise.resolve();
  } catch (error) {
    console.error(`[group/index] Error updating group settings:`, error);
    return Promise.reject(error);
  }
}

/**
 * 获取群聊设置
 * @param groupId 群聊ID
 */
export function getGroupSettings(
  groupId: string
): GroupSettings {
  const scheduler = GroupScheduler.getInstance();
  return scheduler.getGroupSettings(groupId);
}

/**
 * 清空群聊历史消息
 * @param user 当前用户
 * @param groupId 群聊ID
 */
export async function clearGroupMessages(
  user: User,
  groupId: string
): Promise<boolean> {
  try {
    console.log(`[group/index] 清空群组 ${groupId} 的消息历史`);
    return await GroupService.clearGroupMessages(groupId, user.id);
  } catch (error) {
    console.error(`[group/index] 清空群聊消息失败:`, error);
    return false;
  }
}
