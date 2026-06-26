function isDuplicateKeyError(error) {
  return error?.code === 11000 || error?.code === 11001;
}

function isLegacyConversationMemberUniqueIndex(index) {
  const key = index?.key || {};
  return Boolean(index?.unique && key.members === 1 && !Object.hasOwn(key, "mode"));
}

function isParallelArrayConversationIndex(index) {
  const key = index?.key || {};
  return Boolean(key.members === 1 && (key.archivedFor === 1 || key.deletedFor === 1));
}

function isParallelArrayIndexError(error) {
  return error?.code === 171 || /cannot index parallel arrays/i.test(error?.message || "");
}

async function dropLegacyConversationMemberUniqueIndexes(Conversation) {
  let indexes;
  try {
    indexes = await Conversation.collection.indexes();
  } catch (error) {
    if (error?.code === 26) return [];
    throw error;
  }
  const legacyIndexes = indexes.filter(isLegacyConversationMemberUniqueIndex);
  for (const index of legacyIndexes) {
    await Conversation.collection.dropIndex(index.name);
  }
  return legacyIndexes.map((index) => index.name);
}

async function dropParallelArrayConversationIndexes(Conversation) {
  let indexes;
  try {
    indexes = await Conversation.collection.indexes();
  } catch (error) {
    if (error?.code === 26) return [];
    throw error;
  }
  const staleIndexes = indexes.filter(isParallelArrayConversationIndex);
  for (const index of staleIndexes) {
    await Conversation.collection.dropIndex(index.name);
  }
  return staleIndexes.map((index) => index.name);
}

let compatibilityCleanupPromise = null;

async function ensureConversationIndexesCompatible(Conversation) {
  if (!compatibilityCleanupPromise) {
    compatibilityCleanupPromise = dropParallelArrayConversationIndexes(Conversation).catch((error) => {
      compatibilityCleanupPromise = null;
      throw error;
    });
  }
  return compatibilityCleanupPromise;
}

async function createConversationWithLegacyIndexRetry(Conversation, payload) {
  await ensureConversationIndexesCompatible(Conversation);
  try {
    return await Conversation.create(payload);
  } catch (error) {
    if (isParallelArrayIndexError(error)) {
      await dropParallelArrayConversationIndexes(Conversation);
      return Conversation.create(payload);
    }
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
  dropParallelArrayConversationIndexes,
  ensureConversationIndexesCompatible,
  dropLegacyConversationMemberUniqueIndexes,
  isDuplicateKeyError,
  isLegacyConversationMemberUniqueIndex,
  isParallelArrayConversationIndex,
  isParallelArrayIndexError,
};
