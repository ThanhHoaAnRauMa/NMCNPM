import { appendLog, clearSession, getLogs } from '../forensicLog.js';

await clearSession('conversation-demo');
await appendLog({
  conversationId: 'conversation-demo',
  messageId: 'msg-1',
  encryptedContent: 'base64-ciphertext',
  signature: 'base64-signature',
});

const logs = await getLogs('conversation-demo');
console.log(logs);
