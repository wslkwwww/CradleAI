// 导出群聊功能模块的所有组件

export * from './group-types';
export * from './group-service';
export * from './group-manager';
export * from './group-scheduler';

// 基础API函数导出，方便直接调用
import { GroupManager } from './group-manager';
import { GroupService } from './group-service';
import { Character, User } from '../../shared/types';
import { Group, GroupMessage } from './group-types';

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
  return await manager.createGroup(groupName, groupTopic, characters);
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
