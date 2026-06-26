const Conversation = require("../models/Conversation.model");
const mongoose = require("./mongoose");

async function restoreConversationForMessageRecipients(conversation, senderId, messageId) {
  const recipientIds = (conversation.members || [])
    .map((memberId) => memberId.toString())
    .filter((memberId) => memberId !== senderId);

  const update = { $set: { lastMessage: messageId } };
  if (recipientIds.length) update.$pull = { deletedFor: { $in: recipientIds } };

  if (!mongoose.Types.ObjectId.isValid(conversation._id)) {
    await Conversation.findByIdAndUpdate(conversation._id, { lastMessage: messageId });
    return;
  }

  await Conversation.updateOne({ _id: conversation._id }, update);
}

module.exports = { restoreConversationForMessageRecipients };
