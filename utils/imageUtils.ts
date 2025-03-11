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
export async function downloadAndSaveImage(imageUrl: string, characterId: string, type: 'avatar' | 'background'): Promise<string | null> {
  try {
    console.log(`[ImageUtils] 开始下载并保存图片: ${imageUrl}`);
    
    // Create directory if it doesn't exist
    const characterImagesDir = `${FileSystem.documentDirectory}characterImages/${characterId}`;
    const dirInfo = await FileSystem.getInfoAsync(characterImagesDir);
    
    if (!dirInfo.exists) {
      console.log(`[ImageUtils] 创建角色图片目录: ${characterImagesDir}`);
      await FileSystem.makeDirectoryAsync(characterImagesDir, { intermediates: true });
    }
    
    // Generate a unique filename based on image type and timestamp
    const fileExtension = imageUrl.split('.').pop()?.split('?')[0] || 'jpg';
    const localFilename = `${type}_${Date.now()}.${fileExtension}`;
    const localUri = `${characterImagesDir}/${localFilename}`;
    
    console.log(`[ImageUtils] 下载图片到本地路径: ${localUri}`);
    
    // Download the file
    const downloadResult = await FileSystem.downloadAsync(
      imageUrl,
      localUri
    );
    
    if (downloadResult.status !== 200) {
      throw new Error(`Download failed with status ${downloadResult.status}`);
    }
    
    console.log(`[ImageUtils] 图片下载成功: ${localUri}`);
    
    // For performance reasons, optionally resize large images
    if (type === 'background') {
      try {
        // Get file info to check size
        const fileInfo = await FileSystem.getInfoAsync(localUri);
        
        // If file is larger than 2MB, resize it
        if (fileInfo.exists && fileInfo.size && fileInfo.size > 2 * 1024 * 1024) {
          console.log(`[ImageUtils] 图片过大 (${Math.round(fileInfo.size/1024/1024)}MB)，进行压缩`);
          const manipResult = await ImageManipulator.manipulateAsync(
            localUri,
            [{ resize: { width: 1080 } }], // Resize to reasonable width
            { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
          );
          
          // Replace original with compressed version
          await FileSystem.moveAsync({
            from: manipResult.uri,
            to: localUri
          });
          
          console.log(`[ImageUtils] 图片压缩完成`);
        }
      } catch (resizeError) {
        // Log but continue - original image is still usable
        console.warn('[ImageUtils] 图片压缩失败，使用原始图片:', resizeError);
      }
    }
    
    return localUri;
  } catch (error) {
    console.error('[ImageUtils] 图片下载失败:', error);
    return null;
  }
}

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
