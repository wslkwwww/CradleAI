// Matrix SDK加密模块的空实现 - 避免WASM构建问题
console.warn('[Matrix Crypto Stub] Using crypto stub - encryption is disabled');

// 空的类实现
class EmptyClass {
  constructor() {
    console.warn('Crypto disabled - Empty class created');
  }
}

// 空的函数实现
const emptyFunction = () => {
  console.warn('Crypto disabled - Empty function called');
  return null;
};

const emptyAsyncFunction = () => {
  console.warn('Crypto disabled - Empty async function called');
  return Promise.resolve(null);
};

// 使用CommonJS导出以确保兼容性
module.exports = EmptyClass;

// Matrix SDK crypto-wasm 模块的具体导出 - CommonJS方式
module.exports.RustSdkCryptoJs = EmptyClass;
module.exports.StoreHandle = EmptyClass;
module.exports.initAsync = emptyAsyncFunction;
module.exports.OlmMachine = EmptyClass;
module.exports.Device = EmptyClass;
module.exports.DeviceKeys = EmptyClass;
module.exports.CrossSigningStatus = EmptyClass;
module.exports.BackupDecryptionKey = EmptyClass;
module.exports.DecryptionResult = EmptyClass;
module.exports.EncryptionResult = EmptyClass;
module.exports.KeysImportResult = EmptyClass;
module.exports.KeysExportResult = EmptyClass;
module.exports.RoomMessageRequest = EmptyClass;
module.exports.ToDeviceRequest = EmptyClass;
module.exports.KeysUploadRequest = EmptyClass;
module.exports.KeysQueryRequest = EmptyClass;
module.exports.KeysClaimRequest = EmptyClass;
module.exports.SignatureUploadRequest = EmptyClass;
module.exports.OutgoingRequest = EmptyClass;
module.exports.RequestType = {};
module.exports.EventEncryptionAlgorithm = {};
module.exports.EncryptionSettings = EmptyClass;
module.exports.DeviceLists = EmptyClass;

// 通用的函数导出
module.exports.wasmPath = '';
module.exports.wasmURL = '';
module.exports.loadWasm = emptyAsyncFunction;
module.exports.setupWasm = emptyAsyncFunction;
module.exports.initCrypto = emptyAsyncFunction;
module.exports.createCrypto = emptyFunction;

// Olm相关的导出
module.exports.Olm = {
  init: emptyAsyncFunction,
  get_library_version: () => '0.0.0',
  Account: EmptyClass,
  Session: EmptyClass,
  Utility: EmptyClass,
  InboundGroupSession: EmptyClass,
  OutboundGroupSession: EmptyClass,
  PkEncryption: EmptyClass,
  PkDecryption: EmptyClass,
  PkSigning: EmptyClass,
  SAS: EmptyClass,
}; 