import {
  decryptMessage,
  encryptMessage,
  generateKeypair,
  signMessage,
  verifySignature,
} from '../crypto.js';
import { initKeyExchange } from '../keyExchange.js';

const alice = await generateKeypair();
const bob = await generateKeypair();
const { sharedKey } = await initKeyExchange(alice.exchangePrivateKey, bob.exchangePublicKey);

const plaintext = 'SecureChat hello';
const encrypted = await encryptMessage(plaintext, sharedKey);
const decrypted = await decryptMessage(encrypted, sharedKey);
const signature = await signMessage(plaintext, alice.privateKey);
const verified = await verifySignature(plaintext, signature, alice.publicKey);

console.log({ encrypted, decrypted, verified });
