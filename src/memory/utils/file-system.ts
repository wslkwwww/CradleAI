import * as FileSystem from 'expo-file-system';

/**
 * 获取数据库文件路径
 * @param filename 文件名
 * @returns 完整路径
 */
export async function getDatabasePath(filename: string): Promise<string> {
  return `${FileSystem.documentDirectory}${filename}`;
}

/**
 * 检查文件是否存在
 * @param path 文件路径
 * @returns 存在返回true，否则返回false
 */
export async function fileExists(path: string): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(path);
    return info.exists;
  } catch (error) {
    console.error("Error checking file existence:", error);
    return false;
  }
}

/**
 * 确保目录存在
 * @param directory 目录路径
 */
export async function ensureDirectoryExists(directory: string): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(directory);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    }
  } catch (error) {
    console.error("Error ensuring directory exists:", error);
    throw error;
  }
}
