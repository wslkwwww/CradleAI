const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const config = require('../config');

// 数据文件路径
const DATA_DIR = path.join(__dirname, '../../data');
const SPACES_FILE = path.join(DATA_DIR, 'huggingface_spaces.json');
const LICENSE_SPACES_FILE = path.join(DATA_DIR, 'license_space_mapping.json');

// 在内存中缓存空间数据
let spacesList = [];
let licenseSpaceMapping = {};

// 最大许可证数量限制
const MAX_LICENSES_PER_SPACE = 10;

/**
 * 初始化数据目录和文件
 */
async function initDataFiles() {
  try {
    // 确保数据目录存在
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }

    // 初始化 Hugging Face Spaces 文件
    try {
      await fs.access(SPACES_FILE);
      const spacesData = await fs.readFile(SPACES_FILE, 'utf8');
      spacesList = JSON.parse(spacesData);
    } catch (err) {
      if (err.code === 'ENOENT') {
        // 如果文件不存在，使用配置中的初始空间列表
        spacesList = config.huggingFace.spaces.map(space => ({
          url: space.url,
          password: space.password,
          assignedLicenses: 0,
          active: true
        }));
        await fs.writeFile(SPACES_FILE, JSON.stringify(spacesList, null, 2), 'utf8');
      } else {
        throw err;
      }
    }

    // 初始化许可证映射文件
    try {
      await fs.access(LICENSE_SPACES_FILE);
      const mappingData = await fs.readFile(LICENSE_SPACES_FILE, 'utf8');
      licenseSpaceMapping = JSON.parse(mappingData);
    } catch (err) {
      if (err.code === 'ENOENT') {
        licenseSpaceMapping = {};
        await fs.writeFile(LICENSE_SPACES_FILE, JSON.stringify(licenseSpaceMapping, null, 2), 'utf8');
      } else {
        throw err;
      }
    }

    logger.info('Space manager initialized', { 
      spacesCount: spacesList.length,
      mappingsCount: Object.keys(licenseSpaceMapping).length
    });
  } catch (err) {
    logger.error('Failed to initialize space manager', { error: err.message });
    throw err;
  }
}

/**
 * 保存空间列表到文件
 */
async function saveSpacesList() {
  await fs.writeFile(SPACES_FILE, JSON.stringify(spacesList, null, 2), 'utf8');
}

/**
 * 保存许可证映射到文件
 */
async function saveLicenseMapping() {
  await fs.writeFile(LICENSE_SPACES_FILE, JSON.stringify(licenseSpaceMapping, null, 2), 'utf8');
}

/**
 * 查找可用的空间
 * @returns {Object|null} 可用空间信息
 */
function findAvailableSpace() {
  // 查找分配许可证少于阈值的活动空间
  const availableSpace = spacesList.find(space => 
    space.active && space.assignedLicenses < MAX_LICENSES_PER_SPACE
  );
  
  return availableSpace || null;
}

/**
 * 为许可证分配空间
 * @param {String} licenseKey - 许可证密钥
 * @returns {Object|null} 分配的空间信息
 */
async function assignSpaceToLicense(licenseKey) {
  // 获取可用空间
  const availableSpace = findAvailableSpace();
  
  if (!availableSpace) {
    logger.error('No available space for new license', { licenseKey });
    return null;
  }
  
  // 更新空间分配信息
  availableSpace.assignedLicenses += 1;
  
  // 创建许可证到空间的映射
  licenseSpaceMapping[licenseKey] = {
    spaceIndex: spacesList.indexOf(availableSpace),
    assignedAt: new Date().toISOString()
  };
  
  // 保存更新后的数据
  await Promise.all([saveSpacesList(), saveLicenseMapping()]);
  
  logger.info('Space assigned to license', {
    licenseKey,
    spaceUrl: availableSpace.url,
    assignedLicenses: availableSpace.assignedLicenses
  });
  
  return {
    url: availableSpace.url,
    password: availableSpace.password
  };
}

/**
 * 获取或分配空间给许可证
 * @param {String} licenseKey - 许可证密钥
 * @returns {Promise<Object|null>} 空间信息
 */
async function getOrAssignSpace(licenseKey) {
  // 确保初始化
  if (spacesList.length === 0) {
    await initDataFiles();
  }
  
  logger.info('Getting or assigning Hugging Face space', { licenseKey });
  
  // 检查是否已有分配
  if (licenseSpaceMapping[licenseKey]) {
    const mapping = licenseSpaceMapping[licenseKey];
    const space = spacesList[mapping.spaceIndex];
    
    if (space && space.active) {
      logger.info('Using existing space assignment', { 
        licenseKey,
        spaceUrl: space.url,
        assignmentDate: mapping.assignedAt
      });
      
      return {
        url: space.url,
        password: space.password
      };
    }
  }
  
  // 没有分配或分配的空间不再活跃，重新分配
  logger.info('No active space assignment found, creating new assignment', { licenseKey });
  return await assignSpaceToLicense(licenseKey);
}

/**
 * 获取所有空间使用情况
 * @returns {Array} 空间使用情况列表
 */
function getSpacesUsage() {
  return spacesList.map((space, index) => ({
    index,
    url: space.url,
    active: space.active,
    assignedLicenses: space.assignedLicenses,
    isFull: space.assignedLicenses >= MAX_LICENSES_PER_SPACE
  }));
}

// 初始化
initDataFiles().catch(err => {
  logger.error('Error during space manager initialization', { error: err.message });
});

module.exports = {
  getOrAssignSpace,
  getSpacesUsage,
  initDataFiles
};
