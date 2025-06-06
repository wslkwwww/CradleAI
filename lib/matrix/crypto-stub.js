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

// 提供Matrix SDK期望的所有导出
export default EmptyClass;

// Matrix SDK crypto-wasm 模块的具体导出
export const RustSdkCryptoJs = EmptyClass;
export const StoreHandle = EmptyClass;
export const initAsync = emptyAsyncFunction;
export const OlmMachine = EmptyClass;
export const Device = EmptyClass;
export const DeviceKeys = EmptyClass;
export const CrossSigningStatus = EmptyClass;
export const BackupDecryptionKey = EmptyClass;
export const DecryptionResult = EmptyClass;
export const EncryptionResult = EmptyClass;
export const KeysImportResult = EmptyClass;
export const KeysExportResult = EmptyClass;
export const RoomMessageRequest = EmptyClass;
export const ToDeviceRequest = EmptyClass;
export const KeysUploadRequest = EmptyClass;
export const KeysQueryRequest = EmptyClass;
export const KeysClaimRequest = EmptyClass;
export const SignatureUploadRequest = EmptyClass;
export const OutgoingRequest = EmptyClass;
export const RequestType = {};
export const EventEncryptionAlgorithm = {};
export const EncryptionSettings = EmptyClass;
export const DeviceLists = EmptyClass;

// 通用的函数导出
export const wasmPath = '';
export const wasmURL = '';
export const loadWasm = emptyAsyncFunction;
export const setupWasm = emptyAsyncFunction;
export const initCrypto = emptyAsyncFunction;
export const createCrypto = emptyFunction;

// Olm相关的导出
export const Olm = {
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