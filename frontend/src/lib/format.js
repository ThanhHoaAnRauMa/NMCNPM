export function userId(value) {
  return typeof value === 'string' ? value : value?._id || value?.id || ''
}

export function displayName(user) {
  return user?.displayName || user?.username || 'Nguoi dung'
}

export function isKycVerified(user) {
  const status = typeof user === 'string' ? user : user?.kycStatus
  return String(status || '').toUpperCase() === 'VERIFIED'
}

export function conversationPeer(conversation, currentUserId) {
  if (!conversation || ['GROUP', 'group'].includes(conversation.type)) return null
  return conversation.members?.find((member) => userId(member) !== currentUserId) || null
}

export function conversationTitle(conversation, currentUserId) {
  if (!conversation) return 'Chon mot cuoc tro chuyen'
  if (['GROUP', 'group'].includes(conversation.type)) return conversation.groupName || conversation.name || 'Nhom khong ten'
  const other = conversationPeer(conversation, currentUserId)
  return displayName(other)
}

export function shortTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(date)
}

export function fileSize(bytes) {
  if (!Number.isFinite(Number(bytes))) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
