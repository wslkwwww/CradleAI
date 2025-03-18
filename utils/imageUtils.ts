import * as FileSystem from 'expo-file-system';
import { Alert, Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Downloads and locally stores an image from a remote URL
 * @param imageUrl The remote URL of the image
 * @param characterId The ID of the character this image belongs to
 * @param type The type of image ('avatar', 'background')
 * @returns The local URI of the saved image
 */

/**
 * Cleans up all local images associated with a character
 * @param characterId The ID of the character
 */
export async function deleteCharacterImages(characterId: string): Promise<void> {
  try {
    const characterImagesDir = `${FileSystem.documentDirectory}characterImages/${characterId}`;
    const dirInfo = await FileSystem.getInfoAsync(characterImagesDir);
    
    if (dirInfo.exists) {
      console.log(`[ImageUtils] 删除角色图片目录: ${characterImagesDir}`);
      await FileSystem.deleteAsync(characterImagesDir, { idempotent: true });
    }
  } catch (error) {
    console.error('[ImageUtils] 删除角色图片失败:', error);
  }
}

export const downloadAndSaveImage = async (
  url: string, 
  characterId: string,
  type: 'avatar' | 'background' | 'gallery' = 'gallery'
): Promise<string | null> => {
  try {
    console.log(`[ImageUtils] 开始下载图像: ${url}`);
    
    // Create the directory path
    const dirUri = `${FileSystem.documentDirectory}characters/${characterId}`;
    const fileName = `${type}_${Date.now()}.png`;
    const fileUri = `${dirUri}/${fileName}`;
    
    // Ensure directory exists
    try {
      const dirInfo = await FileSystem.getInfoAsync(dirUri);
      if (!dirInfo.exists) {
        console.log(`[ImageUtils] 创建目录: ${dirUri}`);
        await FileSystem.makeDirectoryAsync(dirUri, { intermediates: true });
      }
    } catch (dirError) {
      console.error('[ImageUtils] 创建目录失败:', dirError);
      // Continue anyway, as the download might still work
    }
    
    // Download the file
    console.log(`[ImageUtils] 下载图像到: ${fileUri}`);
    const downloadResult = await FileSystem.downloadAsync(url, fileUri);
    
    if (downloadResult.status === 200) {
      console.log(`[ImageUtils] 图像下载成功: ${fileUri}`);
      
      // Verify the file exists
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (fileInfo.exists) {
        console.log(`[ImageUtils] 文件确认存在: ${fileUri}, 大小: ${fileInfo.size} 字节`);
        return fileUri;
      } else {
        console.error(`[ImageUtils] 下载完成但文件不存在: ${fileUri}`);
        return null;
      }
    } else {
      console.error(`[ImageUtils] 图像下载失败: HTTP ${downloadResult.status}`);
      return null;
    }
  } catch (error) {
    console.error('[ImageUtils] 下载图像时出错:', error);
    return null;
  }
};
