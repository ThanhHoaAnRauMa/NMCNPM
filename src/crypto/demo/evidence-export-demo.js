import { appendLog, clearSession } from '../forensicLog.js';
import { exportEvidence } from '../evidenceExport.js';

const conversationId = 'conversation-demo';
await clearSession(conversationId);
await appendLog({
  conversationId,
  messageId: 'msg-1',
  encryptedContent: 'encrypted-message',
  signature: 'message-signature',
  timestamp: '2026-06-04T00:00:00.000Z',
});

const fetchImpl = async (url) => {
  if (url.includes('/merkle/verify/')) {
    return Response.json({
      rootHash: '0xroot',
      merkleProof: ['0xproof1', '0xproof2'],
      txHash: '0xtx',
    });
  }
  return Response.json({
    rootHash: '0xroot',
    merkleProof: ['0xproof1', '0xproof2'],
    txHash: '0xtx',
    etherscanUrl: 'https://sepolia.etherscan.io/tx/0xtx',
  });
};

const evidence = await exportEvidence(conversationId, {}, {
  apiBaseUrl: 'https://api.example.test',
  fetchImpl,
});

console.log(JSON.stringify(evidence, null, 2));
