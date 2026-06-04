/**
 * index.js – Public API barrel
 * Consumer chỉ cần:  import { cryptoService, CryptoService } from './crypto/index.js';
 */

// Facade chính
export { CryptoService, cryptoService } from './CryptoService.js';

// Factories (để extend từ bên ngoài)
export { AsymmetricCipherFactory }  from './asymmetric/RsaCipher.js';
export { SymmetricCipherFactory }   from './symmetric/AesCipher.js';
export { HasherFactory }            from './hash/Hasher.js';
export { OtpFactory }               from './otp/OtpGenerator.js';

// Interfaces (để implement custom strategy)
export * from './core/interfaces.js';

// Utils
export { CryptoUtils } from './core/utils.js';
