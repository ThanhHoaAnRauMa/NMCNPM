function isDuplicateKeyError(error) {
  return error?.code === 11000 || error?.code === 11001;
}

function isLegacyConversationMemberUniqueIndex(index) {
  const key = index?.key || {};
  return Boolean(index?.unique && key.members === 1 && !Object.hasOwn(key, "mode"));
}

async function dropLegacyConversationMemberUniqueIndexes(Conversation) {
  const indexes = await Conversation.collection.indexes();
  const legacyIndexes = indexes.filter(isLegacyConversationMemberUniqueIndex);
  for (const index of legacyIndexes) {
    await Conversation.collection.dropIndex(index.name);
  }
  return legacyIndexes.map((index) => index.name);
}

async function createConversationWithLegacyIndexRetry(Conversation, payload) {
  try {
    return await Conversation.create(payload);
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    const dropped = await dropLegacyConversationMemberUniqueIndexes(Conversation);
    if (!dropped.length) throw error;
    return Conversation.create(payload);
  }
}

module.exports = {
  createConversationWithLegacyIndexRetry,
  dropLegacyConversationMemberUniqueIndexes,
  isLegacyConversationMemberUniqueIndex,
};
