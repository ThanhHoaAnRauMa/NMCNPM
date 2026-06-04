import { getLogs } from './forensicLog.js';

async function fetchJson(url, fetchImpl) {
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`Evidence API failed: HTTP ${response.status}`);
  return response.json();
}

export async function exportEvidence(
  conversationId,
  dateRange = {},
  { apiBaseUrl, fetchImpl = fetch } = {},
) {
  if (!conversationId) throw new TypeError('conversationId is required.');
  if (!apiBaseUrl) throw new TypeError('apiBaseUrl is required.');

  const messages = await getLogs(conversationId, dateRange);
  const encodedConversationId = encodeURIComponent(conversationId);
  const [proofData, forensicData] = await Promise.all([
    fetchJson(`${apiBaseUrl}/merkle/verify/${encodedConversationId}/0`, fetchImpl),
    fetchJson(`${apiBaseUrl}/forensics/${encodedConversationId}`, fetchImpl),
  ]);

  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    conversationId,
    dateRange,
    messages: messages.map((message) => ({
      messageId: message.messageId,
      encryptedContent: message.encryptedContent,
      signature: message.signature,
      timestamp: message.timestamp,
    })),
    merkleProof: proofData.merkleProof ?? proofData.proof ?? forensicData.merkleProof ?? [],
    rootHash: forensicData.rootHash ?? proofData.rootHash,
    txHash: forensicData.txHash ?? proofData.txHash,
    etherscanUrl: forensicData.etherscanUrl
      ?? (forensicData.txHash ? `https://sepolia.etherscan.io/tx/${forensicData.txHash}` : undefined),
  };
}
