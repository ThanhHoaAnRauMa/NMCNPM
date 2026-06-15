const onlineUsers = new Map();
const offlineQueue = new Map();
const pendingPrivacy = new Map();

function isUserOnline(userId) {
  return onlineUsers.has(userId);
}

function getSocketId(userId) {
  return onlineUsers.get(userId) || null;
}

function setUserOnline(userId, socketId) {
  onlineUsers.set(userId, socketId);
}

function setUserOffline(userId) {
  onlineUsers.delete(userId);
}

function queueForOfflineUser(userId, messageData) {
  if (!offlineQueue.has(userId)) {
    offlineQueue.set(userId, []);
  }
  const queue = offlineQueue.get(userId);
  queue.push(messageData);

  if (queue.length > 100) {
    queue.shift();
  }
}

function flushOfflineQueue(userId) {
  const queue = offlineQueue.get(userId) || [];
  offlineQueue.delete(userId);
  return queue;
}

function getOnlineCount() {
  return onlineUsers.size;
}

module.exports = {
  onlineUsers,
  offlineQueue,
  pendingPrivacy,
  isUserOnline,
  getSocketId,
  setUserOnline,
  setUserOffline,
  queueForOfflineUser,
  flushOfflineQueue,
  getOnlineCount,
};
