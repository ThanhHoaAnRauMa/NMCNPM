import { encryptMessage, decryptMessage } from '../crypto.js';
import { generateExchangeKeypair, initKeyExchange } from '../keyExchange.js';

const alice = await generateExchangeKeypair();
const bob = await generateExchangeKeypair();

const aliceSession = await initKeyExchange(alice.privateKey, bob.publicKey);
const bobSession = await initKeyExchange(bob.privateKey, alice.publicKey);

const encrypted = await encryptMessage('Shared secret works', aliceSession.sharedKey);
const decrypted = await decryptMessage(encrypted, bobSession.sharedKey);

console.log({
  sameSecret: aliceSession.sharedSecret === bobSession.sharedSecret,
  decrypted,
});
