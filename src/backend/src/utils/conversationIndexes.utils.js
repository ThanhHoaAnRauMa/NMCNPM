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
    let dropped;
    try {
      dropped = await dropLegacyConversationMemberUniqueIndexes(Conversation);
    } catch (migrationError) {
      error.conversationCode = "CONVERSATION_INDEX_MIGRATION_FAILED";
      error.migrationMessage = migrationError.message;
      throw error;
    }
    if (!dropped.length) throw error;
    return Conversation.create(payload);
  }
}

async function createDirectConversationWithFallback(Conversation, payload, fallbackQuery) {
  try {
    return { conversation: await createConversationWithLegacyIndexRetry(Conversation, payload), recovered: false };
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    const existing = await Conversation.findOne(fallbackQuery).sort({ createdAt: 1 });
    if (!existing) throw error;
    return {
      conversation: existing,
      recovered: true,
      recoveryCode: error.conversationCode || "CONVERSATION_DUPLICATE_INDEX",
    };
  }
}

module.exports = {
  createDirectConversationWithFallback,
  createConversationWithLegacyIndexRetry,
  dropLegacyConversationMemberUniqueIndexes,
  isDuplicateKeyError,
  isLegacyConversationMemberUniqueIndex,
};
