function isDuplicateKeyError(error) {
  return error?.code === 11000 || error?.code === 11001;
}

function isParallelArrayIndexError(error) {
  return error?.code === 171 && /cannot index parallel arrays/i.test(error?.message || error?.errmsg || error?.errorResponse?.errmsg || "");
}

function isLegacyConversationMemberUniqueIndex(index) {
  const key = index?.key || {};
  return Boolean(index?.unique && key.members === 1 && !Object.hasOwn(key, "mode"));
}

function isConversationParallelArrayIndex(index) {
  const key = index?.key || {};
  return Boolean(key.members === 1 && (Object.hasOwn(key, "archivedFor") || Object.hasOwn(key, "deletedFor")));
}

async function dropLegacyConversationMemberUniqueIndexes(Conversation) {
  const indexes = await Conversation.collection.indexes();
  const legacyIndexes = indexes.filter(isLegacyConversationMemberUniqueIndex);
  for (const index of legacyIndexes) {
    await Conversation.collection.dropIndex(index.name);
  }
  return legacyIndexes.map((index) => index.name);
}

async function dropConversationParallelArrayIndexes(Conversation) {
  const indexes = await Conversation.collection.indexes();
  const invalidIndexes = indexes.filter(isConversationParallelArrayIndex);
  for (const index of invalidIndexes) {
    await Conversation.collection.dropIndex(index.name);
  }
  return invalidIndexes.map((index) => index.name);
}

async function createConversationWithLegacyIndexRetry(Conversation, payload) {
  try {
    return await Conversation.create(payload);
  } catch (error) {
    const dropped = isDuplicateKeyError(error)
      ? await dropLegacyConversationMemberUniqueIndexes(Conversation)
      : isParallelArrayIndexError(error)
        ? await dropConversationParallelArrayIndexes(Conversation)
        : [];
    if (!dropped.length) throw error;
    return Conversation.create(payload);
  }
}

module.exports = {
  createConversationWithLegacyIndexRetry,
  dropConversationParallelArrayIndexes,
  dropLegacyConversationMemberUniqueIndexes,
  isConversationParallelArrayIndex,
  isLegacyConversationMemberUniqueIndex,
  isParallelArrayIndexError,
};
