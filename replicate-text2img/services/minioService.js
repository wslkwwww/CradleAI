const Minio = require('minio');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

class MinioService {
  constructor() {
    // Parse endpoint and port correctly
    const endpointParts = config.minio.endpoint.split(':');
    const endPoint = endpointParts[0];
    const port = endpointParts.length > 1 ? parseInt(endpointParts[1], 10) : 9000;
    
    this.client = new Minio.Client({
      endPoint,
      port,
      useSSL: config.minio.useSSL,
      accessKey: config.minio.accessKey,
      secretKey: config.minio.secretKey
    });
    
    this.bucketName = config.minio.bucketName;
    this.allowedContentTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 
      'image/webp', 'image/bmp', 'image/tiff'
    ];
  }

  /**
   * Ensure that the bucket exists, create it if it doesn't
   * @returns {Promise<boolean>} - True if the bucket exists or was created
   */
  async ensureBucketExists() {
    try {
      const exists = await this.client.bucketExists(this.bucketName);
      
      if (!exists) {
        console.log(`Bucket ${this.bucketName} does not exist, creating...`);
        await this.client.makeBucket(this.bucketName);
        console.log(`Bucket ${this.bucketName} created successfully`);
      } else {
        console.log(`Bucket ${this.bucketName} already exists`);
      }
      
      return true;
    } catch (error) {
      console.error('Error ensuring bucket exists:', error);
      throw new Error(`Failed to ensure bucket exists: ${error.message}`);
    }
  }

  /**
   * Upload an image buffer to MinIO
   * @param {Buffer} imageBuffer - The image data as buffer
   * @param {string} contentType - The MIME type of the image
   * @returns {Promise<string>} - The URL of the uploaded image
   */
  async uploadImage(imageBuffer, contentType = 'image/png') {
    try {
      // Validate content type
      if (!this.allowedContentTypes.includes(contentType)) {
        throw new Error(`Unsupported content type: ${contentType}`);
      }
      
      // Ensure bucket exists
      await this.ensureBucketExists();
      
      // Generate unique object name
      const fileExtension = this.getFileExtension(contentType);
      const objectName = `replicate_${uuidv4()}${fileExtension}`;
      
      // Upload to MinIO
      await this.client.putObject(
        this.bucketName,
        objectName,
        imageBuffer,
        imageBuffer.length,
        { 'Content-Type': contentType }
      );
      
      console.log(`Image uploaded successfully as ${objectName}`);
      
      // Generate image URL - fixed to use the full endpoint
      const protocol = config.minio.useSSL ? 'https' : 'http';
      const imageUrl = `${protocol}://${config.minio.endpoint}/${this.bucketName}/${objectName}`;
      
      return imageUrl;
    } catch (error) {
      console.error('Error uploading image to MinIO:', error);
      throw new Error(`Failed to upload image to MinIO: ${error.message}`);
    }
  }

  /**
   * Get file extension based on content type
   * @param {string} contentType - The MIME type
   * @returns {string} - The file extension
   */
  getFileExtension(contentType) {
    const extensions = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/bmp': '.bmp',
      'image/tiff': '.tiff'
    };
    
    return extensions[contentType] || '.bin';
  }
}

module.exports = new MinioService();
